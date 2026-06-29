import { describe, expect, test } from "bun:test";
import prisma, { uniqueMarker } from "../../helpers/db";
import {
  getPermissionIdsForRoles,
  getUserRolesAndPermissions,
  resolveRoleHierarchy,
} from "../../../backend/src/utils/get-user-role-permission";

function id(label: string) {
  // role/permission ids are VARCHAR(50); keep the disposable id short.
  return `zzt_${label}_${Math.random().toString(36).slice(2, 8)}`;
}

describe("backend resolveRoleHierarchy / getPermissionIdsForRoles (real DB)", () => {
  test("expands a role hierarchy and collects permissions through descendants", async () => {
    const parentRole = id("parent");
    const childRole = id("child");
    const grandchildRole = id("grandchild");
    const childPerm = id("perm-child");
    const grandchildPerm = id("perm-gc");

    await prisma.roles.createMany({
      data: [
        { id: parentRole, name: uniqueMarker("parent-role") },
        { id: childRole, name: uniqueMarker("child-role") },
        { id: grandchildRole, name: uniqueMarker("grandchild-role") },
      ],
    });
    await prisma.role_hierarchy.createMany({
      data: [
        { parent_role_id: parentRole, child_role_id: childRole },
        { parent_role_id: childRole, child_role_id: grandchildRole },
      ],
    });
    await prisma.permissions.createMany({
      data: [
        { id: childPerm, name: uniqueMarker("child-perm"), resource: "test", action: "read" },
        { id: grandchildPerm, name: uniqueMarker("gc-perm"), resource: "test", action: "write" },
      ],
    });
    await prisma.role_permissions.createMany({
      data: [
        { role_id: childRole, permission_id: childPerm },
        { role_id: grandchildRole, permission_id: grandchildPerm },
      ],
    });

    try {
      const allRoles = await resolveRoleHierarchy([parentRole]);
      expect(new Set(allRoles)).toEqual(new Set([parentRole, childRole, grandchildRole]));

      const permissionIds = await getPermissionIdsForRoles([parentRole]);
      expect(permissionIds).toEqual([childPerm, grandchildPerm].sort());
    } finally {
      await prisma.role_permissions.deleteMany({ where: { role_id: { in: [parentRole, childRole, grandchildRole] } } });
      await prisma.role_hierarchy.deleteMany({ where: { parent_role_id: { in: [parentRole, childRole] } } });
      await prisma.permissions.deleteMany({ where: { id: { in: [childPerm, grandchildPerm] } } });
      await prisma.roles.deleteMany({ where: { id: { in: [parentRole, childRole, grandchildRole] } } });
    }
  });

  test("resolveRoleHierarchy returns just the direct roles when there is no hierarchy", async () => {
    const role = id("standalone");

    expect(await resolveRoleHierarchy([role])).toEqual([role]);
  });

  test("resolveRoleHierarchy returns an empty array for no direct roles", async () => {
    expect(await resolveRoleHierarchy([])).toEqual([]);
  });

  test("getPermissionIdsForRoles bypasses role lookup and returns every permission for SUPERADMIN", async () => {
    const [bypassed, allPermissions] = await Promise.all([
      getPermissionIdsForRoles(["SUPERADMIN"]),
      prisma.permissions.findMany({ select: { id: true } }),
    ]);

    expect(bypassed).toEqual(Array.from(new Set(allPermissions.map((p) => p.id))).sort());
  });
});

describe("backend getUserRolesAndPermissions (real DB)", () => {
  test("collects a user's direct role and its permissions", async () => {
    const role = id("user-role");
    const permission = id("user-perm");
    const marker = uniqueMarker("get-user-role-permission");

    const [user] = await Promise.all([
      prisma.users.create({ data: { username: marker, email: `${marker}@example.invalid`, password: "unused" } }),
      prisma.roles.create({ data: { id: role, name: uniqueMarker("role-name") } }),
      prisma.permissions.create({
        data: { id: permission, name: uniqueMarker("perm-name"), resource: "test", action: "read" },
      }),
    ]);
    await Promise.all([
      prisma.role_permissions.create({ data: { role_id: role, permission_id: permission } }),
      prisma.user_roles.create({ data: { user_id: user.id, role_id: role } }),
    ]);

    try {
      const result = await getUserRolesAndPermissions(user.id);

      expect(result.roles).toEqual([role]);
      expect(result.permissions).toEqual([permission]);
    } finally {
      await prisma.user_roles.deleteMany({ where: { user_id: user.id } });
      await prisma.role_permissions.deleteMany({ where: { role_id: role } });
      await Promise.all([
        prisma.permissions.delete({ where: { id: permission } }),
        prisma.roles.delete({ where: { id: role } }),
        prisma.users.delete({ where: { id: user.id } }),
      ]);
    }
  }, 15000);

  test("returns empty roles/permissions for a user with no role assignments", async () => {
    const marker = uniqueMarker("get-user-role-permission-none");
    const user = await prisma.users.create({
      data: { username: marker, email: `${marker}@example.invalid`, password: "unused" },
    });

    try {
      expect(await getUserRolesAndPermissions(user.id)).toEqual({ roles: [], permissions: [] });
    } finally {
      await prisma.users.delete({ where: { id: user.id } });
    }
  });
});
