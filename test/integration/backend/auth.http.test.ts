import { describe, expect, test } from "bun:test";
import prisma, { uniqueMarker } from "../../helpers/db";
import { apiRequest } from "../../helpers/app";
import { PasswordUtil } from "../../../backend/src/utils/password";

function emailFor(marker: string) {
  return `${marker.replace(/:/g, ".")}@example.invalid`;
}

async function createLoginableUser(password: string, overrides: { is_approved?: boolean } = {}) {
  const marker = uniqueMarker("auth-http");
  return prisma.users.create({
    data: {
      username: marker,
      email: emailFor(marker),
      password: await PasswordUtil.hash(password),
      is_active: true,
      is_approved: overrides.is_approved ?? true,
    },
  });
}

async function cleanupUser(userId: number) {
  // Background notifications/auth-history writes (fired via setTimeout or fire-and-forget
  // `.create().catch()` in AuthService) may still be in flight right after the response
  // returns — give them a moment before deleting the user.
  await new Promise((resolve) => setTimeout(resolve, 800));
  await prisma.notifications.deleteMany({ where: { user_id: userId } });
  await prisma.session.deleteMany({ where: { user_id: userId } });
  await prisma.auth_history.deleteMany({ where: { user_id: userId } });
  await prisma.users.delete({ where: { id: userId } }); // cascades notification_settings
}

describe("auth HTTP flow (real DB, via app.handle() — no real network port)", () => {
  test("register returns the disabled-registration response (self_registration_enabled=false in this env)", async () => {
    const res = await apiRequest("POST", "/api/auth/register", {
      body: {
        username: uniqueMarker("reg"),
        email: "nobody@example.invalid",
        password: "Sup3r$ecret1",
      },
    });

    expect(res.status).toBe(403);
    expect(res.json).toEqual({ success: false, status: 403, message: "Registration is currently disabled" });
  });

  test("login -> me -> refresh-token -> logout full cycle", async () => {
    const password = "C0rrect-Passw0rd!";
    const user = await createLoginableUser(password);
    const jar: Record<string, string> = {};

    try {
      const loginRes = await apiRequest("POST", "/api/auth/login", {
        body: { username: user.username, password },
        jar,
      });

      expect(loginRes.status).toBe(200);
      const loginBody = loginRes.json as any;
      expect(loginBody.success).toBe(true);
      expect(loginBody.user.id).toBe(user.id);
      expect(loginBody.user.username).toBe(user.username);
      expect(loginBody.refreshToken).toBeUndefined(); // moved into an httpOnly cookie, not the body
      expect(jar.accessToken).toBeTruthy();
      expect(jar.refreshToken).toBeTruthy();

      const meRes = await apiRequest("GET", "/api/auth/me", { jar });
      expect(meRes.status).toBe(200);
      const meBody = meRes.json as any;
      expect(meBody.success).toBe(true);
      expect(meBody.user.id).toBe(user.id);

      const refreshRes = await apiRequest("POST", "/api/auth/refresh-token", { jar });
      expect(refreshRes.status).toBe(200);
      expect((refreshRes.json as any).success).toBe(true);
      expect(jar.accessToken).toBeTruthy();

      const logoutRes = await apiRequest("POST", "/api/auth/logout", { jar });
      expect(logoutRes.status).toBe(200);
      expect(logoutRes.json).toEqual({ success: true, status: 200, message: "Logout successful" });

      const meAfterLogout = await apiRequest("GET", "/api/auth/me", { jar });
      expect((meAfterLogout.json as any).success).toBe(false);
      expect((meAfterLogout.json as any).user).toBe(null);
    } finally {
      await cleanupUser(user.id);
    }
  }, 20000);

  test("login rejects an incorrect password without leaking which field was wrong", async () => {
    const user = await createLoginableUser("Correct-Pass1!");

    try {
      const res = await apiRequest("POST", "/api/auth/login", {
        body: { username: user.username, password: "Wrong-Pass1!" },
      });

      expect(res.status).toBe(401);
      expect(res.json).toMatchObject({ success: false, status: 401 });
    } finally {
      await cleanupUser(user.id);
    }
  }, 15000);

  test("login rejects a username that does not exist", async () => {
    const username = uniqueMarker("no-user");

    try {
      const res = await apiRequest("POST", "/api/auth/login", {
        body: { username, password: "Whatever123!" },
      });

      expect(res.status).toBe(401);
      expect(res.json).toMatchObject({ success: false, status: 401 });
    } finally {
      // No user row is ever created for this case, but AuthHistoryUtil.log() still fires
      // a fire-and-forget USER_NOT_FOUND row (user_id: null) — clean it up by username.
      await new Promise((resolve) => setTimeout(resolve, 500));
      await prisma.auth_history.deleteMany({ where: { username } });
    }
  });

  test("login rejects an account pending approval", async () => {
    const password = "Correct-Pass1!";
    const user = await createLoginableUser(password, { is_approved: false });

    try {
      const res = await apiRequest("POST", "/api/auth/login", {
        body: { username: user.username, password },
      });

      expect(res.status).toBe(403);
      expect(res.json).toMatchObject({ success: false, status: 403 });
    } finally {
      await cleanupUser(user.id);
    }
  }, 15000);

  test("me with no cookies returns no user instead of an error", async () => {
    const res = await apiRequest("GET", "/api/auth/me");

    expect(res.status).toBe(200);
    expect(res.json).toEqual({ success: false, status: 200, user: null });
  });

  test("a protected route rejects requests with no auth cookie/token", async () => {
    const res = await apiRequest("GET", "/api/users");

    expect(res.status).toBe(401);
    expect((res.json as any).success).toBe(false);
  });
});
