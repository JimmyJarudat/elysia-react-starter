import { describe, expect, test } from "bun:test";
import prisma, { uniqueMarker } from "../../helpers/db";
import { apiRequest } from "../../helpers/app";
import { PasswordUtil } from "../../../backend/src/utils/password";

function emailFor(marker: string) {
  return `${marker.replace(/:/g, ".")}@example.invalid`;
}

async function createUser(overrides: Record<string, unknown> = {}) {
  const marker = uniqueMarker("auth-reset");
  return prisma.users.create({
    data: {
      username: marker,
      email: emailFor(marker),
      password: await PasswordUtil.hash("Original-Pass1!"),
      is_active: true,
      is_approved: true,
      ...overrides,
    },
  });
}

async function cleanupUser(userId: number) {
  // resetPassword() fires `void NotificationService.notifyPasswordChanged(...)` fire-and-forget
  // on success — give it a moment so it doesn't try to insert a notification for a user we've
  // already deleted (which would surface as an FK error attributed to a later test).
  await new Promise((resolve) => setTimeout(resolve, 1200));
  await prisma.notifications.deleteMany({ where: { user_id: userId } });
  await prisma.password_history.deleteMany({ where: { user_id: userId } });
  await prisma.users.delete({ where: { id: userId } });
}

describe("GET /api/auth/password-policy (read-only, public)", () => {
  test("returns the active password policy shape", async () => {
    const res = await apiRequest("GET", "/api/auth/password-policy");

    expect(res.status).toBe(200);
    const body = res.json as any;
    expect(body.success).toBe(true);
    expect(typeof body.data.minLength).toBe("number");
  });
});

describe("POST /api/auth/forgot-password (real DB)", () => {
  test("returns a generic not-found message for an unknown identifier", async () => {
    const res = await apiRequest("POST", "/api/auth/forgot-password", {
      body: { identifier: uniqueMarker("no-such") },
    });

    expect(res.status).toBe(404);
    expect((res.json as any).success).toBe(false);
  });

  test("offers a main/recovery choice when the user has a recovery email", async () => {
    const user = await createUser({ recovery_email: emailFor(uniqueMarker("recovery")) });

    try {
      const res = await apiRequest("POST", "/api/auth/forgot-password", {
        body: { identifier: user.username },
      });

      expect(res.status).toBe(200);
      const body = res.json as any;
      expect(body.success).toBe(true);
      expect(body.needChoice).toBe(true);
      expect(body.data.mainEmail).toContain("@");
      expect(body.data.recoveryEmail).toContain("@");

      // The lookup-only call must not have written a reset token.
      const reloaded = await prisma.users.findUnique({ where: { id: user.id } });
      expect(reloaded?.password_reset_token).toBe(null);
    } finally {
      await cleanupUser(user.id);
    }
  });

  test("sends directly to the main email and stores a reset token when there is no recovery email", async () => {
    const user = await createUser();

    try {
      const res = await apiRequest("POST", "/api/auth/forgot-password", {
        body: { identifier: user.email },
      });

      expect(res.status).toBe(200);
      expect((res.json as any).success).toBe(true);

      const reloaded = await prisma.users.findUnique({ where: { id: user.id } });
      expect(reloaded?.password_reset_token).toBeTruthy();
      expect(reloaded?.password_reset_expiry).toBeTruthy();
    } finally {
      await cleanupUser(user.id);
    }
  }, 15000);

  test("rejects emailType=recovery when no recovery email is configured", async () => {
    const user = await createUser();

    try {
      const res = await apiRequest("POST", "/api/auth/forgot-password", {
        body: { identifier: user.username, emailType: "recovery" },
      });

      expect(res.status).toBe(400);
      expect((res.json as any).success).toBe(false);
    } finally {
      await cleanupUser(user.id);
    }
  });
});

describe("POST /api/auth/reset-password (real DB)", () => {
  test("resets the password for a valid, unexpired token", async () => {
    const user = await createUser();
    const token = uniqueMarker("reset-token").replace(/:/g, "-");

    await prisma.users.update({
      where: { id: user.id },
      data: { password_reset_token: token, password_reset_expiry: new Date(Date.now() + 60_000) },
    });

    try {
      const res = await apiRequest("POST", "/api/auth/reset-password", {
        body: { token, newPassword: "Brand-N3w-Pass!" },
      });

      expect(res.status).toBe(200);
      expect((res.json as any).success).toBe(true);

      const reloaded = await prisma.users.findUnique({ where: { id: user.id } });
      expect(reloaded?.password_reset_token).toBe(null);
      expect(await PasswordUtil.compare("Brand-N3w-Pass!", reloaded!.password)).toBe(true);
    } finally {
      await cleanupUser(user.id);
    }
  }, 15000);

  test("rejects an unknown or already-used token", async () => {
    const res = await apiRequest("POST", "/api/auth/reset-password", {
      body: { token: uniqueMarker("missing-token").replace(/:/g, "-"), newPassword: "Whatever-Pass1!" },
    });

    expect(res.status).toBe(400);
    expect((res.json as any).success).toBe(false);
  });

  test("rejects an expired token", async () => {
    const user = await createUser();
    const token = uniqueMarker("expired-token").replace(/:/g, "-");

    await prisma.users.update({
      where: { id: user.id },
      data: { password_reset_token: token, password_reset_expiry: new Date(Date.now() - 60_000) },
    });

    try {
      const res = await apiRequest("POST", "/api/auth/reset-password", {
        body: { token, newPassword: "Whatever-Pass1!" },
      });

      expect(res.status).toBe(400);
      expect((res.json as any).success).toBe(false);
    } finally {
      await cleanupUser(user.id);
    }
  });

  test("rejects reusing the current password", async () => {
    const user = await createUser();
    const token = uniqueMarker("same-pass-token").replace(/:/g, "-");

    await prisma.users.update({
      where: { id: user.id },
      data: { password_reset_token: token, password_reset_expiry: new Date(Date.now() + 60_000) },
    });

    try {
      const res = await apiRequest("POST", "/api/auth/reset-password", {
        body: { token, newPassword: "Original-Pass1!" },
      });

      expect(res.status).toBe(400);
      expect((res.json as any).success).toBe(false);
    } finally {
      await cleanupUser(user.id);
    }
  }, 15000);
});
