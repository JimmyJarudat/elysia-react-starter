import prisma from "@/config/prisma.config";

type AuthTypeFilter = "all" | "LOGIN" | "LOGOUT" | "REGISTER" | "PASSWORD_RESET";
type AuthStatusFilter = "all" | "SUCCESS" | "FAILED";

export class AuthLogsService {
  static async list(input: {
    search?: string;
    authType?: AuthTypeFilter;
    authStatus?: AuthStatusFilter;
    page?: number;
    pageSize?: number;
  } = {}) {
    const page = Number.isInteger(input.page) && input.page! > 0 ? input.page! : 1;
    const pageSize = Number.isInteger(input.pageSize) && input.pageSize! > 0
      ? Math.min(input.pageSize!, 100)
      : 20;
    const search = input.search?.trim();
    const authType = input.authType && input.authType !== "all" ? input.authType : undefined;
    const authStatus = input.authStatus && input.authStatus !== "all" ? input.authStatus : undefined;

    const where = {
      AND: [
        search ? {
          OR: [
            { username: { contains: search } },
            { ip_address: { contains: search } },
            { failure_reason: { contains: search } },
            { browser: { contains: search } },
            { os: { contains: search } },
          ],
        } : {},
        authType ? { auth_type: authType } : {},
        authStatus ? { auth_status: authStatus } : {},
      ],
    };

    const [logs, totalItems, totalAll, success, failed, blocked] = await Promise.all([
      prisma.auth_history.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { created_at: "desc" },
        select: {
          id: true,
          created_at: true,
          user_id: true,
          username: true,
          auth_type: true,
          auth_status: true,
          failure_reason: true,
          ip_address: true,
          browser: true,
          os: true,
          device_info: true,
          auth_source: true,
          two_factor_used: true,
          remember_me: true,
          session_duration: true,
          logout_time: true,
        },
      }),
      prisma.auth_history.count({ where }),
      prisma.auth_history.count(),
      prisma.auth_history.count({ where: { auth_status: "SUCCESS" } }),
      prisma.auth_history.count({ where: { auth_status: "FAILED" } }),
      prisma.auth_history.count({ where: { auth_status: "BLOCKED" } }),
    ]);

    return {
      success: true,
      data: {
        logs: logs.map((log) => ({
          id: log.id,
          createdAt: log.created_at,
          userId: log.user_id,
          username: log.username,
          authType: log.auth_type,
          authStatus: log.auth_status,
          failureReason: log.failure_reason,
          ipAddress: log.ip_address,
          browser: log.browser,
          os: log.os,
          deviceInfo: log.device_info,
          authSource: log.auth_source,
          twoFactorUsed: log.two_factor_used,
          rememberMe: log.remember_me,
          sessionDuration: log.session_duration,
          logoutTime: log.logout_time,
        })),
        pagination: {
          page,
          pageSize,
          totalItems,
          totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
        },
        stats: {
          total: totalAll,
          success,
          failed,
          blocked,
        },
      },
    };
  }
}
