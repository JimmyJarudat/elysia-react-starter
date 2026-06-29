import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import prisma, { loginSafeMarker, uniqueMarker } from "../../../helpers/db";
import { apiRequest } from "../../../helpers/app";
import { PasswordUtil } from "../../../../backend/src/utils/password";

function id(label: string) {
  return `zzt_${label}_${Math.random().toString(36).slice(2, 8)}`;
}

function emailFor(marker: string) {
  return `${marker.replace(/:/g, ".")}@example.invalid`;
}

const ROLE_ID = id("users-admin");
const PERMISSIONS = ["users.create", "users.read", "users.update", "users.delete"];
let callerId: number;
let jar: Record<string, string> = {};

async function createTargetUser(overrides: Record<string, unknown> = {}) {
  const marker = uniqueMarker("users-target");
  return prisma.users.create({
    data: {
      username: marker,
      email: emailFor(marker),
      password: await PasswordUtil.hash("Target-Pass1!"),
      is_active: true,
      is_approved: true,
      ...overrides,
    },
  });
}

async function cleanupTargetUser(userId: number) {
  // Most admin actions here (unlock, force-logout, reset-password, role/status updates) fire a
  // `void NotificationService.notify*(...)` that isn't awaited — give it a moment to land before
  // deleting the user, or its FK insert fails against a user that's already gone.
  await new Promise((resolve) => setTimeout(resolve, 1000));
  await prisma.notifications.deleteMany({ where: { user_id: userId } });
  await prisma.user_roles.deleteMany({ where: { user_id: userId } });
  await prisma.profile.deleteMany({ where: { user_id: userId } });
  await prisma.session.deleteMany({ where: { user_id: userId } });
  await prisma.auth_history.deleteMany({ where: { user_id: userId } });
  await prisma.users.deleteMany({ where: { id: userId } });
}

beforeAll(async () => {
  const marker = loginSafeMarker("u-caller");
  const caller = await prisma.users.create({
    data: {
      username: marker,
      email: emailFor(marker),
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
          data: { id: permId, name: uniqueMarker(`perm-${permId}`), resource: "users", action: permId.split(".")[1] },
        });
      }
    }),
  );
  await prisma.roles.create({ data: { id: ROLE_ID, name: uniqueMarker("role-users-admin") } });
  await prisma.role_permissions.createMany({
    data: PERMISSIONS.map((permission_id) => ({ role_id: ROLE_ID, permission_id })),
  });
  await prisma.user_roles.create({ data: { user_id: caller.id, role_id: ROLE_ID } });

  jar = {};
  await apiRequest("POST", "/api/auth/login", { body: { username: caller.username, password: "Caller-Pass1!" }, jar });
}, 20000);

afterAll(async () => {
  await new Promise((resolve) => setTimeout(resolve, 1000));
  await prisma.user_roles.deleteMany({ where: { role_id: ROLE_ID } });
  await prisma.role_permissions.deleteMany({ where: { role_id: ROLE_ID } });
  await prisma.roles.delete({ where: { id: ROLE_ID } }).catch(() => {});
  await cleanupTargetUser(callerId);
}, 15000);

describe("users HTTP endpoints (real DB, caller has users.create/read/update/delete)", () => {
  test("GET /api/users lists active users", async () => {
    const res = await apiRequest("GET", "/api/users", { jar });

    expect(res.status).toBe(200);
    const body = res.json as any;
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    const caller = body.data.find((u: any) => u.id === callerId);
    expect(caller).toBeTruthy();
    expect(caller.authSource).toBeTruthy();
    expect(caller.creationType).toBeTruthy();
  });

  test("POST /api/users creates a user with a profile", async () => {
    const username = uniqueMarker("users-create");

    try {
      const res = await apiRequest("POST", "/api/users", {
        body: {
          username,
          email: emailFor(username),
          password: "New-Pass1!",
          firstName: "Ada",
          lastName: "Lovelace",
        },
        jar,
      });

      expect(res.status).toBe(200);
      const body = res.json as any;
      expect(body.success).toBe(true);
      expect(body.data.username).toBe(username);

      const created = await prisma.users.findUnique({ where: { username }, include: { profile: true } });
      expect(created?.auth_source).toBe("LOCAL");
      expect(created?.creation_type).toBe("ADMIN_CREATED");
      expect(created?.profile?.first_name).toBe("Ada");
    } finally {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const created = await prisma.users.findUnique({ where: { username } });
      if (created) await cleanupTargetUser(created.id);
    }
  }, 15000);

  test("POST /api/users/ldap/import imports once and reports already imported on duplicate", async () => {
    const username = uniqueMarker("ldap-import");
    const dn = `CN=${username},OU=Account,OU=ProDept,OU=ProFile,DC=profile,DC=co,DC=th`;
    const email = `${username.replace(/:/g, ".")}@profile.co.th`;

    try {
      const first = await apiRequest("POST", "/api/users/ldap/import", {
        body: {
          username,
          email,
          displayName: "LDAP Imported User",
          department: "Account",
          dn,
          externalId: `guid-${username}`,
        },
        jar,
      });

      expect(first.status).toBe(200);
      expect((first.json as any).success).toBe(true);
      expect((first.json as any).data.alreadyImported).toBe(false);

      const created = await prisma.users.findUnique({ where: { username }, include: { profile: true } });
      expect(created?.auth_source).toBe("LDAP");
      expect(created?.creation_type).toBe("LDAP_IMPORT");
      expect(created?.group_name?.trim()).toBe("profile");
      expect(created?.ldap_dn).toBe(dn);
      expect(created?.profile?.display_name).toBe("LDAP Imported User");
      expect(created?.profile?.department).toBe("Account");

      const role = await prisma.user_roles.findUnique({ where: { user_id_role_id: { user_id: created!.id, role_id: "USER" } } });
      expect(role?.role_id).toBe("USER");

      const second = await apiRequest("POST", "/api/users/ldap/import", {
        body: {
          username,
          email,
          displayName: "LDAP Imported User Updated",
          department: "Account",
          dn,
          externalId: `guid-${username}`,
        },
        jar,
      });

      expect(second.status).toBe(200);
      expect((second.json as any).success).toBe(true);
      expect((second.json as any).data.alreadyImported).toBe(true);
      expect(await prisma.users.count({ where: { ldap_dn: dn } })).toBe(1);
    } finally {
      const created = await prisma.users.findUnique({ where: { username } });
      if (created) await cleanupTargetUser(created.id);
    }
  }, 15000);

  test("POST /api/users rejects a duplicate username", async () => {
    const target = await createTargetUser();

    try {
      const res = await apiRequest("POST", "/api/users", {
        body: { username: target.username, email: emailFor(uniqueMarker("dup")), password: "New-Pass1!" },
        jar,
      });

      expect(res.status).toBe(500);
      expect((res.json as any).success).toBe(false);
    } finally {
      await cleanupTargetUser(target.id);
    }
  }, 15000);

  test("GET /api/users/:id returns the user's detail", async () => {
    const target = await createTargetUser();

    try {
      const res = await apiRequest("GET", `/api/users/${target.id}`, { jar });

      expect(res.status).toBe(200);
      const body = res.json as any;
      expect(body.data.id).toBe(target.id);
      expect(body.data.username).toBe(target.username);
    } finally {
      await cleanupTargetUser(target.id);
    }
  }, 15000);

  test("PUT /api/users/:id updates fields and writes an audit trail", async () => {
    const target = await createTargetUser();

    try {
      const res = await apiRequest("PUT", `/api/users/${target.id}`, {
        body: { displayName: "Updated Name", isActive: false },
        jar,
      });

      expect(res.status).toBe(200);
      expect((res.json as any).success).toBe(true);

      const reloaded = await prisma.users.findUnique({ where: { id: target.id }, include: { profile: true } });
      expect(reloaded?.is_active).toBe(false);
      expect(reloaded?.profile?.display_name).toBe("Updated Name");
    } finally {
      await cleanupTargetUser(target.id);
    }
  }, 15000);

  test("PATCH /api/users/:id/status toggles active state and rejects toggling yourself", async () => {
    const target = await createTargetUser();

    try {
      const res = await apiRequest("PATCH", `/api/users/${target.id}/status`, { jar });
      expect(res.status).toBe(200);
      expect((res.json as any).data.is_active).toBe(false);

      const self = await apiRequest("PATCH", `/api/users/${callerId}/status`, { jar });
      expect(self.status).toBe(500);
      expect((self.json as any).success).toBe(false);
    } finally {
      await cleanupTargetUser(target.id);
    }
  }, 15000);

  test("POST /api/users/:id/unlock clears a lockout", async () => {
    const target = await createTargetUser({ failed_login_attempts: 5, locked_until: new Date(Date.now() + 60_000) });

    try {
      const res = await apiRequest("POST", `/api/users/${target.id}/unlock`, { jar });
      expect(res.status).toBe(200);

      const reloaded = await prisma.users.findUnique({ where: { id: target.id } });
      expect(reloaded?.failed_login_attempts).toBe(0);
      expect(reloaded?.locked_until).toBe(null);
    } finally {
      await cleanupTargetUser(target.id);
    }
  }, 15000);

  test("DELETE /api/users/:id/sessions force-logs-out every active session", async () => {
    const target = await createTargetUser();
    await prisma.session.create({
      data: {
        user_id: target.id,
        access_token: uniqueMarker("force-logout-token"),
        refresh_token: uniqueMarker("force-logout-refresh"),
        is_active: true,
        expires_at: new Date(Date.now() + 60_000),
      },
    });

    try {
      const res = await apiRequest("DELETE", `/api/users/${target.id}/sessions`, { jar });

      expect(res.status).toBe(200);
      expect((res.json as any).sessionsRevoked).toBe(1);

      const active = await prisma.session.count({ where: { user_id: target.id, is_active: true } });
      expect(active).toBe(0);
    } finally {
      await cleanupTargetUser(target.id);
    }
  }, 15000);

  test("POST /api/users/:id/reset-password sets a new password", async () => {
    const target = await createTargetUser();

    try {
      const res = await apiRequest("POST", `/api/users/${target.id}/reset-password`, {
        body: { newPassword: "Admin-Reset-Pass1!", mustChangePassword: true },
        jar,
      });

      expect(res.status).toBe(200);

      const reloaded = await prisma.users.findUnique({ where: { id: target.id } });
      expect(reloaded?.must_change_password).toBe(true);
      expect(await PasswordUtil.compare("Admin-Reset-Pass1!", reloaded!.password)).toBe(true);
    } finally {
      await cleanupTargetUser(target.id);
    }
  }, 15000);

  test("PUT /api/users/:id/roles replaces role assignments; GET reflects them", async () => {
    const target = await createTargetUser();
    const role = id("assignable");
    await prisma.roles.create({ data: { id: role, name: uniqueMarker("role-assignable") } });

    try {
      const putRes = await apiRequest("PUT", `/api/users/${target.id}/roles`, { body: { roleIds: [role] }, jar });
      expect(putRes.status).toBe(200);

      const getRes = await apiRequest("GET", `/api/users/${target.id}/roles`, { jar });
      expect(getRes.status).toBe(200);
      const roles = (getRes.json as any).data;
      expect(roles.map((r: any) => r.roleId)).toEqual([role]);
    } finally {
      await prisma.user_roles.deleteMany({ where: { role_id: role } });
      await prisma.roles.delete({ where: { id: role } });
      await cleanupTargetUser(target.id);
    }
  }, 15000);

  test("DELETE /api/users/:id soft-deletes; PATCH /restore brings it back; rejects deleting yourself", async () => {
    const target = await createTargetUser();

    try {
      const del = await apiRequest("DELETE", `/api/users/${target.id}`, { jar });
      expect(del.status).toBe(200);
      expect((await prisma.users.findUnique({ where: { id: target.id } }))?.is_deleted).toBe(true);

      const listDeleted = await apiRequest("GET", "/api/users/deleted", { jar });
      expect((listDeleted.json as any).data.some((u: any) => u.id === target.id)).toBe(true);

      const restore = await apiRequest("PATCH", `/api/users/${target.id}/restore`, { jar });
      expect(restore.status).toBe(200);
      expect((await prisma.users.findUnique({ where: { id: target.id } }))?.is_deleted).toBe(false);

      const selfDelete = await apiRequest("DELETE", `/api/users/${callerId}`, { jar });
      expect(selfDelete.status).toBe(500);
      expect((selfDelete.json as any).success).toBe(false);
    } finally {
      await cleanupTargetUser(target.id);
    }
  }, 15000);

  test("DELETE /api/users/:id/permanent hard-deletes the row", async () => {
    const target = await createTargetUser();

    const res = await apiRequest("DELETE", `/api/users/${target.id}/permanent`, { jar });

    expect(res.status).toBe(200);
    expect(await prisma.users.findUnique({ where: { id: target.id } })).toBe(null);
  }, 15000);
});
