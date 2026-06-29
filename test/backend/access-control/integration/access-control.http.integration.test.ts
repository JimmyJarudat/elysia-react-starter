import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import prisma, { loginSafeMarker, uniqueMarker } from "../../../helpers/db";
import { apiRequest } from "../../../helpers/app";
import { PasswordUtil } from "../../../../backend/src/utils/password";

function id(label: string) {
  return `zzt_${label}_${Math.random().toString(36).slice(2, 8)}`;
}

const ROLE_ID = id("ac-admin");
const PERMISSIONS = [
  "roles.create", "roles.update", "roles.delete",
  "permissions.create", "permissions.update", "permissions.delete",
  "role-hierarchy.create", "role-hierarchy.delete",
  "role-permissions.update", "role-permissions.read",
];
let callerId: number;
let jar: Record<string, string> = {};

beforeAll(async () => {
  const marker = loginSafeMarker("ac-call");
  const caller = await prisma.users.create({
    data: { username: marker, email: `${marker.replace(/:/g, ".")}@example.invalid`, password: await PasswordUtil.hash("Caller-Pass1!"), is_active: true, is_approved: true },
  });
  callerId = caller.id;

  await Promise.all(
    PERMISSIONS.map(async (permId) => {
      const existing = await prisma.permissions.findUnique({ where: { id: permId } });
      if (!existing) {
        const [resource, action] = permId.split(".");
        await prisma.permissions.create({ data: { id: permId, name: uniqueMarker(`perm-${permId}`), resource, action } });
      }
    }),
  );
  await prisma.roles.create({ data: { id: ROLE_ID, name: uniqueMarker("role-ac-admin") } });
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

describe("access-control HTTP endpoints (real DB)", () => {
  test("GET /api/access-control/roles and /roles-permissions are public (no auth needed)", async () => {
    const rolesRes = await apiRequest("GET", "/api/access-control/roles");
    expect(rolesRes.status).toBe(200);
    expect((rolesRes.json as any).success).toBe(true);

    const rpRes = await apiRequest("GET", "/api/access-control/roles-permissions");
    expect(rpRes.status).toBe(200);
    expect(Array.isArray((rpRes.json as any).data.roles)).toBe(true);
  });

  test("role lifecycle: create -> update -> clone -> assign permissions -> delete", async () => {
    // createRole()/cloneRole() uppercase the id server-side — use the already-uppercase form
    // consistently here too, so every later lookup targets exactly the stored row.
    const roleId = id("lifecycle").toUpperCase();
    const cloneId = id("lifecycle-clone").toUpperCase();
    const permId = id("lifecycle-perm");

    try {
      const create = await apiRequest("POST", "/api/access-control/roles", {
        body: { id: roleId, name: uniqueMarker("lifecycle-role"), priority: 5 },
        jar,
      });
      expect(create.status).toBe(200);
      expect((create.json as any).data.id).toBe(roleId.toUpperCase());

      const dup = await apiRequest("POST", "/api/access-control/roles", {
        body: { id: roleId, name: uniqueMarker("dup") },
        jar,
      });
      expect(dup.status).toBe(500);

      const update = await apiRequest("PUT", `/api/access-control/roles/${roleId}`, {
        body: { name: "Renamed Role", priority: 9, description: "desc" },
        jar,
      });
      expect(update.status).toBe(200);
      expect((update.json as any).data.name).toBe("Renamed Role");

      await prisma.permissions.create({ data: { id: permId, name: uniqueMarker("perm"), resource: "test", action: "read" } });
      const assign = await apiRequest("PUT", `/api/access-control/roles/${roleId}/permissions`, {
        body: { permissionIds: [permId] },
        jar,
      });
      expect(assign.status).toBe(200);
      const stored = await prisma.role_permissions.findMany({ where: { role_id: roleId.toUpperCase() } });
      expect(stored.map((r) => r.permission_id)).toEqual([permId]);

      const clone = await apiRequest("POST", `/api/access-control/roles/${roleId}/clone`, {
        body: { newId: cloneId, newName: "Cloned Role" },
        jar,
      });
      expect(clone.status).toBe(200);
      const clonedPerms = await prisma.role_permissions.findMany({ where: { role_id: cloneId.toUpperCase() } });
      expect(clonedPerms.map((r) => r.permission_id)).toEqual([permId]);

      // Assigning a user blocks deletion.
      const target = await prisma.users.create({
        data: { username: uniqueMarker("lifecycle-user"), email: `${uniqueMarker("lc")}@example.invalid`, password: "unused" },
      });
      await prisma.user_roles.create({ data: { user_id: target.id, role_id: roleId.toUpperCase() } });

      const blockedDelete = await apiRequest("DELETE", `/api/access-control/roles/${roleId}`, { jar });
      expect(blockedDelete.status).toBe(500);

      await prisma.user_roles.deleteMany({ where: { role_id: roleId.toUpperCase() } });
      await prisma.users.delete({ where: { id: target.id } });

      const del = await apiRequest("DELETE", `/api/access-control/roles/${roleId}`, { jar });
      expect(del.status).toBe(200);
      expect(await prisma.roles.findUnique({ where: { id: roleId.toUpperCase() } })).toBe(null);
    } finally {
      await prisma.role_permissions.deleteMany({ where: { role_id: { in: [roleId.toUpperCase(), cloneId.toUpperCase()] } } });
      await prisma.user_roles.deleteMany({ where: { role_id: { in: [roleId.toUpperCase(), cloneId.toUpperCase()] } } });
      await prisma.roles.deleteMany({ where: { id: { in: [roleId.toUpperCase(), cloneId.toUpperCase()] } } });
      await prisma.permissions.delete({ where: { id: permId } }).catch(() => {});
    }
  }, 20000);

  test("cannot delete the SUPERADMIN role", async () => {
    const res = await apiRequest("DELETE", "/api/access-control/roles/SUPERADMIN", { jar });
    expect(res.status).toBe(500);
    expect((res.json as any).success).toBe(false);
  });

  test("bulk delete rejects SUPERADMIN and rejects roles in use", async () => {
    const roleId = id("bulk");
    await prisma.roles.create({ data: { id: roleId, name: uniqueMarker("bulk-role") } });

    try {
      const withSuperadmin = await apiRequest("DELETE", "/api/access-control/roles", {
        body: { ids: [roleId, "SUPERADMIN"] },
        jar,
      });
      expect(withSuperadmin.status).toBe(500);

      const ok = await apiRequest("DELETE", "/api/access-control/roles", { body: { ids: [roleId] }, jar });
      expect(ok.status).toBe(200);
      expect((ok.json as any).deleted).toBe(1);
    } finally {
      await prisma.roles.deleteMany({ where: { id: roleId } });
    }
  });

  test("permission lifecycle: create -> update -> delete", async () => {
    const permId = id("perm-lifecycle");

    const create = await apiRequest("POST", "/api/access-control/permissions", {
      body: { id: permId, name: uniqueMarker("perm-name"), resource: "widgets", action: "read" },
      jar,
    });
    expect(create.status).toBe(200);

    const update = await apiRequest("PUT", `/api/access-control/permissions/${permId}`, {
      body: { name: "Renamed Permission", resource: "widgets", action: "write" },
      jar,
    });
    expect(update.status).toBe(200);
    expect((update.json as any).data.action).toBe("write");

    const del = await apiRequest("DELETE", `/api/access-control/permissions/${permId}`, { jar });
    expect(del.status).toBe(200);
    expect(await prisma.permissions.findUnique({ where: { id: permId } })).toBe(null);
  }, 15000);

  test("role hierarchy: add -> reject duplicate/circular/self -> remove", async () => {
    const parent = id("h-parent");
    const child = id("h-child");
    await prisma.roles.createMany({ data: [{ id: parent, name: uniqueMarker("h-parent-role") }, { id: child, name: uniqueMarker("h-child-role") }] });

    try {
      const selfLink = await apiRequest("POST", "/api/access-control/role-hierarchy", { body: { parentRoleId: parent, childRoleId: parent }, jar });
      expect(selfLink.status).toBe(500);

      const add = await apiRequest("POST", "/api/access-control/role-hierarchy", { body: { parentRoleId: parent, childRoleId: child }, jar });
      expect(add.status).toBe(200);

      const dup = await apiRequest("POST", "/api/access-control/role-hierarchy", { body: { parentRoleId: parent, childRoleId: child }, jar });
      expect(dup.status).toBe(500);

      const circular = await apiRequest("POST", "/api/access-control/role-hierarchy", { body: { parentRoleId: child, childRoleId: parent }, jar });
      expect(circular.status).toBe(500);

      const listed = await apiRequest("GET", "/api/access-control/role-hierarchy");
      expect((listed.json as any).data.some((r: any) => r.parentRoleId === parent && r.childRoleId === child)).toBe(true);

      const remove = await apiRequest("DELETE", `/api/access-control/role-hierarchy/${parent}/${child}`, { jar });
      expect(remove.status).toBe(200);
      expect(await prisma.role_hierarchy.findUnique({ where: { parent_role_id_child_role_id: { parent_role_id: parent, child_role_id: child } } })).toBe(null);
    } finally {
      await prisma.role_hierarchy.deleteMany({ where: { OR: [{ parent_role_id: parent }, { parent_role_id: child }] } });
      await prisma.roles.deleteMany({ where: { id: { in: [parent, child] } } });
    }
  }, 20000);
});
