import prisma from "@/config/prisma.config";
import { invalidateAuthUserCache } from "@/utils/cache-invalidation";
import { formatLocation } from "@/utils/format-location";
import { markUserOffline } from "@/utils/online-presence";
import { NotificationService } from "@/modules/notifications/notification.service";
import { ActivityLogUtil } from "@/utils/activity-log";

type SessionStatusFilter = "all" | "active" | "inactive" | "expired";
type SessionSortOrder = "asc" | "desc";
type SessionSortField = "lastUsedAt" | "createdAt" | "expiresAt" | "username" | "ipAddress" | "loginSource" | "isActive";

interface ListSessionsInput {
  search?: string;
  status?: SessionStatusFilter;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: string;
}

export class SessionsService {
  private static buildOrderBy(sortBy?: string, sortOrder?: string) {
    const order: SessionSortOrder = sortOrder === "asc" ? "asc" : "desc";
    const field = sortBy as SessionSortField | undefined;

    switch (field) {
      case "createdAt":
        return [{ created_at: order }, { id: "desc" as const }];
      case "expiresAt":
        return [{ expires_at: order }, { id: "desc" as const }];
      case "username":
        return [{ users: { username: order } }, { id: "desc" as const }];
      case "ipAddress":
        return [{ ip_address: order }, { id: "desc" as const }];
      case "loginSource":
        return [{ login_source: order }, { id: "desc" as const }];
      case "isActive":
        return [{ is_active: order }, { id: "desc" as const }];
      case "lastUsedAt":
        return [{ last_used_at: order }, { id: "desc" as const }];
      default:
        return [{ is_active: "desc" as const }, { last_used_at: "desc" as const }, { created_at: "desc" as const }];
    }
  }

  static async list(currentSessionId: number | null, input: ListSessionsInput = {}) {
    const page = Number.isInteger(input.page) && input.page! > 0 ? input.page! : 1;
    const pageSize = Number.isInteger(input.pageSize) && input.pageSize! > 0
      ? Math.min(input.pageSize!, 100)
      : 20;
    const search = input.search?.trim();
    const status = input.status ?? "all";
    const now = new Date();

    const searchWhere = search ? {
      OR: [
        { ip_address: { contains: search } },
        { user_agent: { contains: search } },
        { device_info: { contains: search } },
        { location: { contains: search } },
        { login_source: { contains: search } },
        { session_type: { contains: search } },
        { users: { username: { contains: search } } },
        { users: { email: { contains: search } } },
        { users: { profile: { is: { first_name: { contains: search } } } } },
        { users: { profile: { is: { last_name: { contains: search } } } } },
        { users: { profile: { is: { display_name: { contains: search } } } } },
        { users: { user_roles_user_roles_user_idTousers: { some: { role_id: { contains: search } } } } },
      ],
    } : {};

    const statusWhere =
      status === "active"
        ? { is_active: true, expires_at: { gt: now } }
        : status === "expired"
          ? { is_active: true, expires_at: { lte: now } }
          : status === "inactive"
            ? { is_active: false }
            : {};

    const where = { AND: [searchWhere, statusWhere] };

    const [sessions, totalItems, totalAll, active, expired] = await Promise.all([
      prisma.session.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: this.buildOrderBy(input.sortBy, input.sortOrder),
        select: {
          id: true,
          user_id: true,
          ip_address: true,
          user_agent: true,
          device_info: true,
          location: true,
          login_source: true,
          session_type: true,
          is_active: true,
          revocation_reason: true,
          created_at: true,
          updated_at: true,
          expires_at: true,
          last_used_at: true,
          users: {
            select: {
              id: true,
              username: true,
              email: true,
              is_active: true,
              is_deleted: true,
              profile: {
                select: {
                  first_name: true,
                  last_name: true,
                  display_name: true,
                  avatar_url: true,
                },
              },
              user_roles_user_roles_user_idTousers: {
                select: { role_id: true },
              },
            },
          },
        },
      }),
      prisma.session.count({ where }),
      prisma.session.count(),
      prisma.session.count({ where: { is_active: true, expires_at: { gt: now } } }),
      prisma.session.count({ where: { is_active: true, expires_at: { lte: now } } }),
    ]);

    return {
      success: true,
      data: {
        sessions: sessions.map((session) => ({
          id: session.id,
          userId: session.user_id,
          ipAddress: session.ip_address,
          userAgent: session.user_agent,
          deviceInfo: session.device_info,
          location: formatLocation(session.location),
          loginSource: session.login_source,
          sessionType: session.session_type,
          isActive: Boolean(session.is_active),
          revocationReason: session.revocation_reason,
          createdAt: session.created_at,
          updatedAt: session.updated_at,
          expiresAt: session.expires_at,
          lastUsedAt: session.last_used_at,
          isCurrent: currentSessionId === session.id,
          canRevoke: Boolean(session.is_active) && currentSessionId !== session.id,
          user: {
            id: session.users.id,
            username: session.users.username,
            email: session.users.email,
            isActive: session.users.is_active,
            isDeleted: session.users.is_deleted,
            roles: session.users.user_roles_user_roles_user_idTousers.map((role) => role.role_id),
            profile: {
              firstName: session.users.profile?.first_name ?? null,
              lastName: session.users.profile?.last_name ?? null,
              displayName: session.users.profile?.display_name ?? null,
              avatarUrl: session.users.profile?.avatar_url ?? null,
            },
          },
        })),
        pagination: {
          page,
          pageSize,
          totalItems,
          totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
        },
        stats: {
          total: totalAll,
          active,
          expired,
          revoked: totalAll - active - expired,
        },
      },
    };
  }

  static async revoke(sessionId: number, currentSessionId: number | null, actorId?: number) {
    if (!Number.isInteger(sessionId)) {
      return { success: false, status: 400, message: "Invalid session id" };
    }

    if (currentSessionId === sessionId) {
      return { success: false, status: 400, message: "ไม่สามารถปิด session ปัจจุบันของตัวเองได้" };
    }

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      select: { id: true, user_id: true, is_active: true },
    });

    if (!session) {
      return { success: false, status: 404, message: "Session not found" };
    }

    if (!session.is_active) {
      return { success: true, message: "Session already inactive" };
    }

    await prisma.session.update({
      where: { id: sessionId },
      data: {
        is_active: false,
        revocation_reason: "ADMIN_REVOKED",
        updated_at: new Date(),
      },
    });

    try { await invalidateAuthUserCache(session.user_id); } catch { /* non-critical */ }
    await this.markOfflineIfNoActiveSessions(session.user_id);

    void NotificationService.notifySessionRevoked({ userId: session.user_id });
    ActivityLogUtil.log({ userId: actorId, action: 'REVOKE', resourceType: 'sessions', resourceId: sessionId, description: `Revoked session #${sessionId} for user #${session.user_id}` });

    return { success: true, message: "Session revoked" };
  }

  private static async markOfflineIfNoActiveSessions(userId: number) {
    const activeSessions = await prisma.session.count({
      where: {
        user_id: userId,
        is_active: true,
        expires_at: { gt: new Date() },
      },
    });

    if (activeSessions === 0) {
      await markUserOffline(userId);
    }
  }
}
