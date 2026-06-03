import prisma from "@/config/prisma.config";

export async function resolveRoleHierarchy(directRoleIds: string[]): Promise<string[]> {
  if (directRoleIds.length === 0) return [];

  const allHierarchy = await prisma.role_hierarchy.findMany({
    select: { parent_role_id: true, child_role_id: true },
  });

  // parent → [children] : parent role includes children's permissions
  const childrenOf = new Map<string, string[]>();
  for (const { parent_role_id, child_role_id } of allHierarchy) {
    if (!childrenOf.has(parent_role_id)) childrenOf.set(parent_role_id, []);
    childrenOf.get(parent_role_id)!.push(child_role_id);
  }

  // BFS ขยาย roles จาก hierarchy
  const allRoles = new Set<string>(directRoleIds);
  const queue = [...directRoleIds];

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const child of childrenOf.get(current) ?? []) {
      if (!allRoles.has(child)) {
        allRoles.add(child);
        queue.push(child);
      }
    }
  }

  return Array.from(allRoles);
}

export async function getPermissionIdsForRoles(directRoleIds: string[]) {
  const allRoleIds = await resolveRoleHierarchy(directRoleIds);

  if (allRoleIds.includes("SUPERADMIN")) {
    const allPermissions = await prisma.permissions.findMany({
      select: { id: true },
    });

    return Array.from(new Set(allPermissions.map((permission) => permission.id))).sort();
  }

  const rolePerms = await prisma.role_permissions.findMany({
    where: { role_id: { in: allRoleIds } },
    select: { permission_id: true },
  });

  return Array.from(new Set(rolePerms.map((rp) => rp.permission_id))).sort();
}

export async function getUserRolesAndPermissions(userId: number) {
  const userRoleRows = await prisma.user_roles.findMany({
    where: { user_id: userId },
    select: { role_id: true },
  });
  const directRoleIds = userRoleRows.map((ur) => ur.role_id);
  const permissions = await getPermissionIdsForRoles(directRoleIds);

  return {
    roles: directRoleIds,
    permissions,
  };
}
