import prisma from '@/config/prisma.config';

export class AccessControlService {
  static async getRolesAndPermissions() {
    const [roles, permissions] = await Promise.all([
      prisma.roles.findMany({
        orderBy: [{ priority: 'desc' }, { name: 'asc' }],
        select: {
          id: true,
          name: true,
          priority: true,
          description: true,
          created_at: true,
          updated_at: true,
          user_roles: {
            select: {
              user_id: true,
            },
          },
          role_permissions: {
            select: {
              permission_id: true,
              permissions: {
                select: {
                  id: true,
                  name: true,
                  resource: true,
                  action: true,
                  description: true,
                },
              },
            },
          },
        },
      }),
      prisma.permissions.findMany({
        orderBy: [{ resource: 'asc' }, { action: 'asc' }],
        select: {
          id: true,
          name: true,
          description: true,
          resource: true,
          action: true,
          created_at: true,
          updated_at: true,
          role_permissions: {
            select: {
              role_id: true,
            },
          },
        },
      }),
    ]);

    return {
      success: true,
      data: {
        roles: roles.map((role) => ({
          id: role.id,
          name: role.name,
          priority: role.priority ?? 0,
          description: role.description,
          userCount: role.user_roles.length,
          permissionCount: role.role_permissions.length,
          permissions: role.role_permissions.map((item) => item.permissions),
          createdAt: role.created_at,
          updatedAt: role.updated_at,
        })),
        permissions: permissions.map((permission) => ({
          id: permission.id,
          name: permission.name,
          description: permission.description,
          resource: permission.resource,
          action: permission.action,
          roleCount: permission.role_permissions.length,
          roles: permission.role_permissions.map((item) => item.role_id),
          createdAt: permission.created_at,
          updatedAt: permission.updated_at,
        })),
      },
    };
  }
}
