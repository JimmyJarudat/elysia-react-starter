import prisma from "@/config/prisma.config";
import { invalidateRouteRequirementCache } from "@/utils/cache-invalidation";
import { ActivityLogUtil } from "@/utils/activity-log";
import { AuditLogUtil } from "@/utils/audit-log";
import { buildApiRouteRequirementsExcel } from "@/templates/excel/api-route-requirements-excel";

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

  static async exportExcel(filters: {
    search?: string;
    method?: string;
    resource?: string;
    status?: string;
  }) {
    const routes = await prisma.api_route_requirements.findMany({
      orderBy: [{ path: "asc" }, { method: "asc" }],
      include: {
        permissions: { select: { id: true, name: true, resource: true, action: true } },
        roles: { select: { id: true, name: true, priority: true } },
      },
    });
    const query = filters.search?.trim().toLowerCase() ?? "";
    const rows = routes.map((route) => ({
      id: route.id,
      method: route.method,
      path: route.path,
      roleId: route.role_id,
      roleName: route.roles?.name ?? null,
      rolePriority: route.roles?.priority ?? null,
      permissionId: route.permission_id,
      permissionName: route.permissions?.name ?? null,
      resource: route.permissions?.resource ?? null,
      action: route.permissions?.action ?? null,
      isActive: route.is_active,
      createdAt: route.created_at,
      updatedAt: route.updated_at,
    })).filter((route) => {
      const matchesSearch = !query || [
        route.method,
        route.path,
        route.permissionId,
        route.permissionName,
        route.resource,
        route.action,
        route.roleId,
        route.roleName,
      ].filter(Boolean).some((value) => String(value).toLowerCase().includes(query));
      const matchesStatus =
        !filters.status ||
        filters.status === "all" ||
        (filters.status === "active" && route.isActive) ||
        (filters.status === "inactive" && !route.isActive);
      const matchesMethod = !filters.method || filters.method === "all" || route.method === filters.method;
      const matchesResource = !filters.resource || filters.resource === "all" || route.resource === filters.resource;

      return matchesSearch && matchesStatus && matchesMethod && matchesResource;
    });

    return buildApiRouteRequirementsExcel({
      rows,
      totalCount: routes.length,
      filters: {
        search: filters.search,
        method: filters.method ?? "all",
        resource: filters.resource ?? "all",
        status: filters.status ?? "all",
      },
    });
  }

  static async update(id: number, body: {
    permission_id?: string | null;
    role_id?: string | null;
    is_active?: boolean | null;
  }, actorId?: number) {
    const existing = await prisma.api_route_requirements.findUnique({ where: { id } });
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
    ActivityLogUtil.log({ userId: actorId, action: "UPDATE", resourceType: "api_route_requirements", resourceId: route.id, description: `Updated API requirement ${route.method} ${route.path}` });
    AuditLogUtil.log({ userId: actorId, action: "UPDATE", tableName: "api_route_requirements", recordId: route.id, beforeData: existing, afterData: route });

    return { success: true, data: route };
  }

  static async delete(id: number, actorId?: number) {
    const existing = await prisma.api_route_requirements.findUniqueOrThrow({ where: { id } });
    await prisma.api_route_requirements.delete({ where: { id } });
    await invalidateRouteRequirementCache();
    ActivityLogUtil.log({ userId: actorId, action: "DELETE", resourceType: "api_route_requirements", resourceId: existing.id, description: `Deleted API requirement ${existing.method} ${existing.path}` });
    AuditLogUtil.log({ userId: actorId, action: "DELETE", tableName: "api_route_requirements", recordId: existing.id, beforeData: existing });

    return { success: true };
  }
}
