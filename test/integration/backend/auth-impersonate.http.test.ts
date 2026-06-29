import { describe, expect, test } from "bun:test";
import prisma, { loginSafeMarker, uniqueMarker } from "../../helpers/db";
import { apiRequest } from "../../helpers/app";
import { PasswordUtil } from "../../../backend/src/utils/password";

function id(label: string) {
  return `zzt_${label}_${Math.random().toString(36).slice(2, 8)}`;
}

async function createUser(password: string) {
  const marker = loginSafeMarker("auth-imp");
  return prisma.users.create({
    data: {
      username: marker,
      email: `${marker.replace(/:/g, ".")}@example.invalid`,
      password: await PasswordUtil.hash(password),
      is_active: true,
      is_approved: true,
    },
  });
}

async function loginAndGetJar(username: string, password: string) {
  const jar: Record<string, string> = {};
  await apiRequest("POST", "/api/auth/login", { body: { username, password }, jar });
  return jar;
}

async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 800));
}

describe("POST /api/auth/impersonate/:userId (real DB, requires users.impersonate)", () => {
  test("a caller with users.impersonate can impersonate another active user", async () => {
    const password = "Caller-Pass1!";
    const caller = await createUser(password);
    const target = await createUser("Target-Pass1!");
    const role = id("impersonator");
    const permission = "users.impersonate";

    const existingPermission = await prisma.permissions.findUnique({ where: { id: permission } });
    if (!existingPermission) {
      await prisma.permissions.create({
        data: { id: permission, name: uniqueMarker("perm-impersonate"), resource: "users", action: "impersonate" },
      });
    }
    await prisma.roles.create({ data: { id: role, name: uniqueMarker("role-impersonate") } });
    await prisma.role_permissions.create({ data: { role_id: role, permission_id: permission } });
    await prisma.user_roles.create({ data: { user_id: caller.id, role_id: role } });

    try {
      const jar = await loginAndGetJar(caller.username, password);
      expect(jar.accessToken).toBeTruthy();

      const res = await apiRequest("POST", `/api/auth/impersonate/${target.id}`, { jar });

      expect(res.status).toBe(200);
      expect((res.json as any).success).toBe(true);
      expect(jar.accessToken).toBeTruthy();
      expect(jar.refreshToken).toBeTruthy();

      const targetSession = await prisma.session.findFirst({ where: { user_id: target.id, is_active: true } });
      expect(targetSession).toBeTruthy();
    } finally {
      await settle();
      await prisma.user_roles.deleteMany({ where: { role_id: role } });
      await prisma.role_permissions.deleteMany({ where: { role_id: role } });
      await prisma.roles.delete({ where: { id: role } });
      await prisma.notifications.deleteMany({ where: { user_id: { in: [caller.id, target.id] } } });
      await prisma.session.deleteMany({ where: { user_id: { in: [caller.id, target.id] } } });
      await prisma.auth_history.deleteMany({ where: { user_id: { in: [caller.id, target.id] } } });
      await prisma.users.deleteMany({ where: { id: { in: [caller.id, target.id] } } });
    }
  }, 20000);

  test("a caller without users.impersonate gets 403", async () => {
    const password = "Caller-Pass1!";
    const caller = await createUser(password);
    const target = await createUser("Target-Pass1!");

    try {
      const jar = await loginAndGetJar(caller.username, password);

      const res = await apiRequest("POST", `/api/auth/impersonate/${target.id}`, { jar });

      expect(res.status).toBe(403);
      expect((res.json as any).success).toBe(false);
    } finally {
      await settle();
      await prisma.notifications.deleteMany({ where: { user_id: { in: [caller.id, target.id] } } });
      await prisma.session.deleteMany({ where: { user_id: { in: [caller.id, target.id] } } });
      await prisma.auth_history.deleteMany({ where: { user_id: { in: [caller.id, target.id] } } });
      await prisma.users.deleteMany({ where: { id: { in: [caller.id, target.id] } } });
    }
  }, 15000);

  test("impersonating a nonexistent user returns 404", async () => {
    const password = "Caller-Pass1!";
    const caller = await createUser(password);
    const role = id("impersonator2");
    const permission = "users.impersonate";

    const existingPermission = await prisma.permissions.findUnique({ where: { id: permission } });
    if (!existingPermission) {
      await prisma.permissions.create({
        data: { id: permission, name: uniqueMarker("perm-impersonate2"), resource: "users", action: "impersonate" },
      });
    }
    await prisma.roles.create({ data: { id: role, name: uniqueMarker("role-impersonate2") } });
    await prisma.role_permissions.create({ data: { role_id: role, permission_id: permission } });
    await prisma.user_roles.create({ data: { user_id: caller.id, role_id: role } });

    try {
      const jar = await loginAndGetJar(caller.username, password);
      const missingUserId = 999_999_999;

      const res = await apiRequest("POST", `/api/auth/impersonate/${missingUserId}`, { jar });

      expect(res.status).toBe(404);
      expect((res.json as any).success).toBe(false);
    } finally {
      await settle();
      await prisma.user_roles.deleteMany({ where: { role_id: role } });
      await prisma.role_permissions.deleteMany({ where: { role_id: role } });
      await prisma.roles.delete({ where: { id: role } });
      await prisma.notifications.deleteMany({ where: { user_id: caller.id } });
      await prisma.session.deleteMany({ where: { user_id: caller.id } });
      await prisma.auth_history.deleteMany({ where: { user_id: caller.id } });
      await prisma.users.delete({ where: { id: caller.id } });
    }
  }, 15000);
});
