import prisma from '@/config/prisma.config';
import { invalidateAccessControlCache } from '@/utils/cache-invalidation';
import { ActivityLogUtil } from '@/utils/activity-log';
import { AuditLogUtil } from '@/utils/audit-log';
import { NotificationService } from '@/modules/notifications/notification.service';

export class AccessControlService {

  static async listRoles() {
    const roles = await prisma.roles.findMany({
      orderBy: [{ priority: 'desc' }, { name: 'asc' }],
      select: { id: true, name: true, priority: true, description: true },
    });
    return { success: true, data: roles };
  }

  static async getRolesAndPermissions() {
    const [roles, permissions] = await Promise.all([
      prisma.roles.findMany({
        orderBy: [{ priority: 'desc' }, { name: 'asc' }],
        select: {
          id: true, name: true, priority: true, description: true,
          created_at: true, updated_at: true,
          user_roles: { select: { user_id: true } },
          role_permissions: {
            select: {
              permission_id: true,
              permissions: { select: { id: true, name: true, resource: true, action: true, description: true } },
            },
          },
        },
      }),
      prisma.permissions.findMany({
        orderBy: [{ resource: 'asc' }, { action: 'asc' }],
        select: {
          id: true, name: true, description: true, resource: true, action: true,
          created_at: true, updated_at: true,
          role_permissions: { select: { role_id: true } },
        },
      }),
    ]);

    const permissionItems = permissions.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      resource: p.resource,
      action: p.action,
    }));

    return {
      success: true,
      data: {
        roles: roles.map((role) => ({
          id: role.id,
          name: role.name,
          priority: role.priority ?? 0,
          description: role.description,
          userCount: role.user_roles.length,
          permissionCount: role.id === 'SUPERADMIN' ? permissionItems.length : role.role_permissions.length,
          permissions: role.id === 'SUPERADMIN'
            ? permissionItems
            : role.role_permissions.map((item) => item.permissions),
          createdAt: role.created_at,
          updatedAt: role.updated_at,
        })),
        permissions: permissions.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          resource: p.resource,
          action: p.action,
          roleCount: p.role_permissions.some((item) => item.role_id === 'SUPERADMIN')
            ? p.role_permissions.length
            : p.role_permissions.length + 1,
          roles: Array.from(new Set(['SUPERADMIN', ...p.role_permissions.map((item) => item.role_id)])),
          createdAt: p.created_at,
          updatedAt: p.updated_at,
        })),
      },
    };
  }

  // ─── Roles ──────────────────────────────────────────────────────────────────

  static async createRole(id: string, body: {
    name: string;
    priority?: number | null;
    description?: string | null;
  }, actorId?: number) {
    const exists = await prisma.roles.findUnique({ where: { id } });
    if (exists) throw new Error(`Role ID "${id}" already exists`);

    const role = await prisma.roles.create({
      data: {
        id: id.trim().toUpperCase(),
        name: body.name.trim(),
        priority: body.priority ?? 0,
        description: body.description?.trim() || null,
      },
    });
    await invalidateAccessControlCache();
    ActivityLogUtil.log({ userId: actorId, action: 'CREATE', resourceType: 'roles', resourceId: role.id, description: `Created role ${role.name}` });
    AuditLogUtil.log({ userId: actorId, action: 'CREATE', tableName: 'roles', recordId: role.id, afterData: { id: role.id, name: role.name, priority: role.priority } });
    return { success: true, data: role };
  }

  static async updateRole(id: string, body: {
    name: string;
    priority?: number | null;
    description?: string | null;
  }, actorId?: number) {
    const before = await prisma.roles.findUnique({ where: { id }, select: { name: true, priority: true, description: true } });
    const role = await prisma.roles.update({
      where: { id },
      data: {
        name: body.name.trim(),
        priority: body.priority ?? 0,
        description: body.description?.trim() || null,
        updated_at: new Date(),
      },
    });
    await invalidateAccessControlCache();
    ActivityLogUtil.log({ userId: actorId, action: 'UPDATE', resourceType: 'roles', resourceId: id, description: `Updated role ${role.name}` });
    if (before) AuditLogUtil.log({ userId: actorId, action: 'UPDATE', tableName: 'roles', recordId: id, beforeData: before, afterData: { name: role.name, priority: role.priority, description: role.description } });
    return { success: true, data: role };
  }

  static async deleteRole(id: string, actorId?: number) {
    if (id === 'SUPERADMIN') throw new Error('Cannot delete the SUPERADMIN role');

    const userCount = await prisma.user_roles.count({ where: { role_id: id } });
    if (userCount > 0) throw new Error(`Cannot delete role "${id}" — it is assigned to ${userCount} user(s)`);

    const role = await prisma.roles.findUnique({ where: { id }, select: { name: true } });

    await prisma.$transaction(async (tx) => {
      await tx.role_hierarchy.deleteMany({
        where: {
          OR: [
            { parent_role_id: id },
            { child_role_id: id },
          ],
        },
      });

      await tx.api_route_requirements.updateMany({
        where: { role_id: id },
        data: { role_id: null, updated_at: new Date() },
      });

      await tx.roles.delete({ where: { id } });
    });

    await invalidateAccessControlCache();
    ActivityLogUtil.log({ userId: actorId, action: 'DELETE', resourceType: 'roles', resourceId: id, description: `Deleted role ${role?.name ?? id}` });
    AuditLogUtil.log({ userId: actorId, action: 'DELETE', tableName: 'roles', recordId: id, beforeData: { id, name: role?.name } });
    void NotificationService.notifyAdminsRoleDeleted({ roleId: id, roleName: role?.name ?? id, actorId });
    return { success: true };
  }

  static async cloneRole(sourceId: string, newId: string, newName: string, newDescription?: string | null, actorId?: number) {
    const source = await prisma.roles.findUnique({
      where: { id: sourceId },
      include: { role_permissions: { select: { permission_id: true } } },
    });
    if (!source) throw new Error(`Role "${sourceId}" not found`);

    const exists = await prisma.roles.findUnique({ where: { id: newId } });
    if (exists) throw new Error(`Role ID "${newId}" already exists`);

    await prisma.$transaction(async (tx) => {
      await tx.roles.create({
        data: {
          id: newId.trim().toUpperCase(),
          name: newName.trim(),
          priority: source.priority ?? 0,
          description: newDescription?.trim() || source.description,
        },
      });

      if (source.role_permissions.length > 0) {
        await tx.role_permissions.createMany({
          data: source.role_permissions.map((rp) => ({
            role_id: newId.trim().toUpperCase(),
            permission_id: rp.permission_id,
          })),
        });
      }
    });

    await invalidateAccessControlCache();
    ActivityLogUtil.log({ userId: actorId, action: 'CLONE', resourceType: 'roles', resourceId: newId, description: `clone role ${sourceId} → ${newId}`, metadata: { sourceId, permissionCount: source.role_permissions.length } });
    return { success: true, clonedFrom: sourceId, newId: newId.trim().toUpperCase() };
  }

  static async bulkDeleteRoles(ids: string[], actorId?: number) {
    if (ids.includes('SUPERADMIN')) throw new Error('Cannot delete the SUPERADMIN role');

    const blocked = await prisma.user_roles.findMany({
      where: { role_id: { in: ids } },
      select: { role_id: true },
      distinct: ['role_id'],
    });

    if (blocked.length > 0) {
      const names = blocked.map((b) => b.role_id).join(', ');
      throw new Error(`Cannot delete roles that are assigned to users: ${names}`);
    }

    await prisma.$transaction(async (tx) => {
      await tx.role_hierarchy.deleteMany({
        where: {
          OR: [
            { parent_role_id: { in: ids } },
            { child_role_id: { in: ids } },
          ],
        },
      });

      await tx.api_route_requirements.updateMany({
        where: { role_id: { in: ids } },
        data: { role_id: null, updated_at: new Date() },
      });

      await tx.roles.deleteMany({ where: { id: { in: ids } } });
    });

    await invalidateAccessControlCache();
    ActivityLogUtil.log({ userId: actorId, action: 'DELETE', resourceType: 'roles', description: `Bulk deleted ${ids.length} roles`, metadata: { ids } });
    return { success: true, deleted: ids.length };
  }

  // ─── Permissions ─────────────────────────────────────────────────────────────

  static async createPermission(id: string, body: {
    name: string;
    resource: string;
    action: string;
    description?: string | null;
  }, actorId?: number) {
    const exists = await prisma.permissions.findUnique({ where: { id } });
    if (exists) throw new Error(`Permission ID "${id}" already exists`);

    const permission = await prisma.permissions.create({
      data: {
        id: id.trim(),
        name: body.name.trim(),
        resource: body.resource.trim(),
        action: body.action.trim(),
        description: body.description?.trim() || null,
      },
    });
    await invalidateAccessControlCache();
    ActivityLogUtil.log({ userId: actorId, action: 'CREATE', resourceType: 'permissions', resourceId: permission.id, description: `Created permission ${permission.name}` });
    AuditLogUtil.log({ userId: actorId, action: 'CREATE', tableName: 'permissions', recordId: permission.id, afterData: { id: permission.id, name: permission.name, resource: permission.resource, action: permission.action } });
    return { success: true, data: permission };
  }

  static async updatePermission(id: string, body: {
    name: string;
    resource: string;
    action: string;
    description?: string | null;
  }, actorId?: number) {
    const before = await prisma.permissions.findUnique({ where: { id }, select: { name: true, resource: true, action: true, description: true } });
    const permission = await prisma.permissions.update({
      where: { id },
      data: {
        name: body.name.trim(),
        resource: body.resource.trim(),
        action: body.action.trim(),
        description: body.description?.trim() || null,
        updated_at: new Date(),
      },
    });
    await invalidateAccessControlCache();
    ActivityLogUtil.log({ userId: actorId, action: 'UPDATE', resourceType: 'permissions', resourceId: id, description: `Updated permission ${permission.name}` });
    if (before) AuditLogUtil.log({ userId: actorId, action: 'UPDATE', tableName: 'permissions', recordId: id, beforeData: before, afterData: { name: permission.name, resource: permission.resource, action: permission.action } });
    return { success: true, data: permission };
  }

  static async deletePermission(id: string, actorId?: number) {
    const perm = await prisma.permissions.findUnique({ where: { id } });
    await prisma.permissions.delete({ where: { id } });
    await invalidateAccessControlCache();
    ActivityLogUtil.log({ userId: actorId, action: 'DELETE', resourceType: 'permissions', resourceId: id, description: `Deleted permission ${perm?.name ?? id}` });
    AuditLogUtil.log({ userId: actorId, action: 'DELETE', tableName: 'permissions', recordId: id, beforeData: perm });
    return { success: true };
  }

  // ─── Role Hierarchy ──────────────────────────────────────────────────────────

  static async getRoleHierarchy() {
    const rows = await prisma.role_hierarchy.findMany({
      orderBy: [{ parent_role_id: 'asc' }, { child_role_id: 'asc' }],
      include: {
        roles_role_hierarchy_parent_role_idToroles: { select: { id: true, name: true, priority: true } },
        roles_role_hierarchy_child_role_idToroles: { select: { id: true, name: true, priority: true } },
      },
    });

    return {
      success: true,
      data: rows.map((r) => ({
        parentRoleId: r.parent_role_id,
        parentRoleName: r.roles_role_hierarchy_parent_role_idToroles.name,
        parentPriority: r.roles_role_hierarchy_parent_role_idToroles.priority ?? 0,
        childRoleId: r.child_role_id,
        childRoleName: r.roles_role_hierarchy_child_role_idToroles.name,
        childPriority: r.roles_role_hierarchy_child_role_idToroles.priority ?? 0,
        createdAt: r.created_at,
      })),
    };
  }

  static async addRoleHierarchy(parentRoleId: string, childRoleId: string, actorId?: number) {
    if (parentRoleId === childRoleId) throw new Error('Parent and child role cannot be the same');

    const exists = await prisma.role_hierarchy.findUnique({
      where: { parent_role_id_child_role_id: { parent_role_id: parentRoleId, child_role_id: childRoleId } },
    });
    if (exists) throw new Error(`Hierarchy "${parentRoleId}" → "${childRoleId}" already exists`);

    // ป้องกัน circular — ถ้า child เป็น parent ของ parent อยู่แล้ว
    const circular = await prisma.role_hierarchy.findUnique({
      where: { parent_role_id_child_role_id: { parent_role_id: childRoleId, child_role_id: parentRoleId } },
    });
    if (circular) throw new Error('Circular hierarchy detected — child is already a parent of this role');

    const row = await prisma.role_hierarchy.create({
      data: { parent_role_id: parentRoleId, child_role_id: childRoleId },
    });
    await invalidateAccessControlCache();
    ActivityLogUtil.log({ userId: actorId, action: 'UPDATE', resourceType: 'role_hierarchy', description: `Added role hierarchy ${parentRoleId} -> ${childRoleId}` });
    AuditLogUtil.log({ userId: actorId, action: 'CREATE', tableName: 'role_hierarchy', recordId: `${parentRoleId}:${childRoleId}`, afterData: row });
    return { success: true, data: row };
  }

  static async removeRoleHierarchy(parentRoleId: string, childRoleId: string, actorId?: number) {
    const existing = await prisma.role_hierarchy.findUnique({
      where: { parent_role_id_child_role_id: { parent_role_id: parentRoleId, child_role_id: childRoleId } },
    });
    await prisma.role_hierarchy.delete({
      where: { parent_role_id_child_role_id: { parent_role_id: parentRoleId, child_role_id: childRoleId } },
    });
    await invalidateAccessControlCache();
    ActivityLogUtil.log({ userId: actorId, action: 'DELETE', resourceType: 'role_hierarchy', description: `Deleted role hierarchy ${parentRoleId} -> ${childRoleId}` });
    AuditLogUtil.log({ userId: actorId, action: 'DELETE', tableName: 'role_hierarchy', recordId: `${parentRoleId}:${childRoleId}`, beforeData: existing });
    return { success: true };
  }

  // ─── Role Permissions ────────────────────────────────────────────────────────

  static async updateRolePermissions(roleId: string, permissionIds: string[], actorId?: number) {
    const role = await prisma.roles.findUnique({ where: { id: roleId } });
    if (!role) throw new Error(`Role "${roleId}" not found`);

    const before = await prisma.role_permissions.findMany({ where: { role_id: roleId }, select: { permission_id: true } });
    const beforeIds = before.map((r) => r.permission_id);

    await prisma.$transaction(async (tx) => {
      await tx.role_permissions.deleteMany({ where: { role_id: roleId } });
      if (permissionIds.length > 0) {
        await tx.role_permissions.createMany({
          data: permissionIds.map((permission_id) => ({ role_id: roleId, permission_id })),
        });
      }
    });

    await invalidateAccessControlCache();
    ActivityLogUtil.log({ userId: actorId, action: 'UPDATE', resourceType: 'role_permissions', resourceId: roleId, description: `Updated permissions for role ${role.name}`, metadata: { permissionCount: permissionIds.length } });
    AuditLogUtil.log({ userId: actorId, action: 'UPDATE', tableName: 'role_permissions', recordId: roleId, beforeData: { permissionIds: beforeIds }, afterData: { permissionIds } });
    return { success: true };
  }
}
