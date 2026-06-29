import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import prisma, { loginSafeMarker, uniqueMarker } from "../../helpers/db";
import { apiRequest } from "../../helpers/app";
import { PasswordUtil } from "../../../backend/src/utils/password";

function id(label: string) {
  return `zzt_${label}_${Math.random().toString(36).slice(2, 8)}`;
}

const ROLE_ID = id("sessions-admin");
const PERMISSIONS = ["sessions.read", "sessions.delete"];
let callerId: number;
let jar: Record<string, string> = {};

beforeAll(async () => {
  const marker = loginSafeMarker("sess-call");
  const caller = await prisma.users.create({
    data: {
      username: marker,
      email: `${marker.replace(/:/g, ".")}@example.invalid`,
      password: await PasswordUtil.hash("Caller-Pass1!"),
      is_active: true,
      is_approved: true,
    },
  });
  callerId = caller.id;

  await Promise.all(
    PERMISSIONS.map(async (permId) => {
      const existing = await prisma.permissions.findUnique({ where: { id: permId } });
      if (!existing) {
        await prisma.permissions.create({
          data: { id: permId, name: uniqueMarker(`perm-${permId}`), resource: "sessions", action: permId.split(".")[1] },
        });
      }
    }),
  );
  await prisma.roles.create({ data: { id: ROLE_ID, name: uniqueMarker("role-sessions-admin") } });
  await prisma.role_permissions.createMany({ data: PERMISSIONS.map((permission_id) => ({ role_id: ROLE_ID, permission_id })) });
  await prisma.user_roles.create({ data: { user_id: caller.id, role_id: ROLE_ID } });

  jar = {};
  await apiRequest("POST", "/api/auth/login", { body: { username: caller.username, password: "Caller-Pass1!" }, jar });
}, 20000);

afterAll(async () => {
  await new Promise((resolve) => setTimeout(resolve, 1000));
  await prisma.user_roles.deleteMany({ where: { role_id: ROLE_ID } });
  await prisma.role_permissions.deleteMany({ where: { role_id: ROLE_ID } });
  await prisma.roles.delete({ where: { id: ROLE_ID } }).catch(() => {});
  await prisma.notifications.deleteMany({ where: { user_id: callerId } });
  await prisma.session.deleteMany({ where: { user_id: callerId } });
  await prisma.auth_history.deleteMany({ where: { user_id: callerId } });
  await prisma.users.delete({ where: { id: callerId } });
}, 15000);

async function createOtherUserWithSession() {
  const marker = uniqueMarker("sess-target");
  const user = await prisma.users.create({
    data: { username: marker, email: `${marker.replace(/:/g, ".")}@example.invalid`, password: "unused", is_active: true, is_approved: true },
  });
  const session = await prisma.session.create({
    data: {
      user_id: user.id,
      access_token: uniqueMarker("sess-token"),
      refresh_token: uniqueMarker("sess-refresh"),
      is_active: true,
      ip_address: "203.0.113.10",
      expires_at: new Date(Date.now() + 60_000),
    },
  });
  return { user, session };
}

async function cleanupOther(userId: number) {
  await new Promise((resolve) => setTimeout(resolve, 1000));
  await prisma.notifications.deleteMany({ where: { user_id: userId } });
  await prisma.session.deleteMany({ where: { user_id: userId } });
  await prisma.users.delete({ where: { id: userId } });
}

describe("sessions HTTP endpoints (real DB, caller has sessions.read/delete)", () => {
  test("GET /api/sessions lists sessions with pagination and stats", async () => {
    const { user, session } = await createOtherUserWithSession();

    try {
      const res = await apiRequest("GET", "/api/sessions?pageSize=100", { jar });

      expect(res.status).toBe(200);
      const body = res.json as any;
      expect(body.success).toBe(true);
      expect(body.data.sessions.some((s: any) => s.id === session.id)).toBe(true);
      expect(typeof body.data.stats.total).toBe("number");
    } finally {
      await cleanupOther(user.id);
    }
  }, 15000);

  test("GET /api/sessions filters by search term (IP address)", async () => {
    const { user, session } = await createOtherUserWithSession();

    try {
      const res = await apiRequest("GET", "/api/sessions?search=203.0.113.10&pageSize=100", { jar });

      expect(res.status).toBe(200);
      const ids = (res.json as any).data.sessions.map((s: any) => s.id);
      expect(ids).toContain(session.id);
    } finally {
      await cleanupOther(user.id);
    }
  }, 15000);

  test("DELETE /api/sessions/:id revokes another user's session", async () => {
    const { user, session } = await createOtherUserWithSession();

    try {
      const res = await apiRequest("DELETE", `/api/sessions/${session.id}`, { jar });

      expect(res.status).toBe(200);
      expect((res.json as any).success).toBe(true);

      const reloaded = await prisma.session.findUnique({ where: { id: session.id } });
      expect(reloaded?.is_active).toBe(false);
      expect(reloaded?.revocation_reason).toBe("ADMIN_REVOKED");
    } finally {
      await cleanupOther(user.id);
    }
  }, 15000);

  test("DELETE /api/sessions/:id is idempotent for an already-inactive session", async () => {
    const { user, session } = await createOtherUserWithSession();
    await prisma.session.update({ where: { id: session.id }, data: { is_active: false } });

    try {
      const res = await apiRequest("DELETE", `/api/sessions/${session.id}`, { jar });

      expect(res.status).toBe(200);
      expect((res.json as any).message).toBe("Session already inactive");
    } finally {
      await cleanupOther(user.id);
    }
  }, 15000);

  test("DELETE /api/sessions/:id returns 404 for a nonexistent session", async () => {
    const res = await apiRequest("DELETE", "/api/sessions/999999999", { jar });

    expect(res.status).toBe(404);
    expect((res.json as any).success).toBe(false);
  });
});
