import prisma from "@/config/prisma.config";
import { invalidateRouteRequirementCache } from "@/utils/cache-invalidation";

export class ApiRouteRequirementsService {
  static async list() {
    const [routes, permissions, roles] = await Promise.all([
      prisma.api_route_requirements.findMany({
        orderBy: [{ path: "asc" }, { method: "asc" }],
        include: {
          permissions: { select: { id: true, name: true, resource: true, action: true } },
          roles: { select: { id: true, name: true, priority: true } },
        },
      }),
      prisma.permissions.findMany({
        orderBy: [{ resource: "asc" }, { action: "asc" }, { id: "asc" }],
        select: { id: true, name: true, resource: true, action: true },
      }),
      prisma.roles.findMany({
        orderBy: [{ priority: "desc" }, { name: "asc" }],
        select: { id: true, name: true, priority: true },
      }),
    ]);

    return {
      success: true,
      data: {
        routes: routes.map((route) => ({
          id: route.id,
          method: route.method,
          path: route.path,
          role_id: route.role_id,
          permission_id: route.permission_id,
          is_active: route.is_active,
          created_at: route.created_at,
          updated_at: route.updated_at,
          role: route.roles,
          permission: route.permissions,
        })),
        permissions,
        roles,
      },
    };
  }

  static async update(id: number, body: {
    permission_id?: string | null;
    role_id?: string | null;
    is_active?: boolean | null;
  }) {
    const route = await prisma.api_route_requirements.update({
      where: { id },
      data: {
        ...(body.permission_id !== undefined && { permission_id: body.permission_id || null }),
        ...(body.role_id !== undefined && { role_id: body.role_id || null }),
        ...(body.is_active !== undefined && { is_active: body.is_active ?? false }),
        updated_at: new Date(),
      },
    });

    await invalidateRouteRequirementCache();

    return { success: true, data: route };
  }

  static async delete(id: number) {
    await prisma.api_route_requirements.delete({ where: { id } });
    await invalidateRouteRequirementCache();

    return { success: true };
  }
}
