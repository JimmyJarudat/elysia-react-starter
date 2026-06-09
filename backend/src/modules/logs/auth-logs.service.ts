import prisma from "@/config/prisma.config";
import { buildAuthLogsExcel } from "@/templates/excel/auth-logs-excel";
import { mkdir, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export class AuthLogsService {
  private static parseDate(value?: string, boundary: "start" | "end" = "start") {
    if (!value) return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    const date = match
      ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
      : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    const d = new Date(date);
    boundary === "start" ? d.setHours(0, 0, 0, 0) : d.setHours(23, 59, 59, 999);
    return d;
  }

  private static buildWhere(opts: {
    search?: string;
    authType?: string;
    authStatus?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const start = this.parseDate(opts.startDate, "start");
    const end = this.parseDate(opts.endDate, "end");
    return {
      AND: [
        opts.search ? {
          OR: [
            { username: { contains: opts.search } },
            { ip_address: { contains: opts.search } },
            { failure_reason: { contains: opts.search } },
            { browser: { contains: opts.search } },
            { os: { contains: opts.search } },
          ],
        } : {},
        opts.authType && opts.authType !== "all" ? { auth_type: opts.authType } : {},
        opts.authStatus && opts.authStatus !== "all" ? { auth_status: opts.authStatus } : {},
        start ? { created_at: { gte: start } } : {},
        end ? { created_at: { lte: end } } : {},
      ],
    };
  }

  static async list(input: {
    search?: string;
    authType?: "all" | "LOGIN" | "LOGOUT" | "REGISTER" | "PASSWORD_RESET";
    authStatus?: "all" | "SUCCESS" | "FAILED";
    startDate?: string;
    endDate?: string;
    page?: number;
    pageSize?: number;
  } = {}) {
    const page = Number.isInteger(input.page) && input.page! > 0 ? input.page! : 1;
    const pageSize = Number.isInteger(input.pageSize) && input.pageSize! > 0
      ? Math.min(input.pageSize!, 100)
      : 20;

    const where = this.buildWhere({
      search: input.search?.trim(),
      authType: input.authType,
      authStatus: input.authStatus,
      startDate: input.startDate,
      endDate: input.endDate,
    });

    const [logs, totalItems, totalAll, success, failed] = await Promise.all([
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
        stats: { total: totalAll, success, failed },
      },
    };
  }

  static async exportExcel(input: {
    search?: string;
    authType?: "all" | "LOGIN" | "LOGOUT" | "REGISTER" | "PASSWORD_RESET";
    authStatus?: "all" | "SUCCESS" | "FAILED";
    startDate?: string;
    endDate?: string;
  } = {}) {
    const where = this.buildWhere({
      search: input.search?.trim(),
      authType: input.authType,
      authStatus: input.authStatus,
      startDate: input.startDate,
      endDate: input.endDate,
    });

    const start = this.parseDate(input.startDate, "start");
    const end = this.parseDate(input.endDate, "end");

    const [totalCount, successCount, failedCount, twoFactorCount] = await Promise.all([
      prisma.auth_history.count({ where }),
      prisma.auth_history.count({ where: { ...where, auth_status: "SUCCESS" } }),
      prisma.auth_history.count({ where: { ...where, auth_status: "FAILED" } }),
      prisma.auth_history.count({ where: { ...where, two_factor_used: true } }),
    ]);

    const batchSize = 2000;
    const exportDir = join(tmpdir(), "elysia-react-starter", "exports");
    await mkdir(exportDir, { recursive: true });

    const datePart = start && end
      ? `${start.toISOString().slice(0, 10)}_to_${end.toISOString().slice(0, 10)}`
      : `all_${new Date().toISOString().slice(0, 10)}`;
    const filename = `auth-logs_${datePart}_${Date.now()}.xlsx`;
    const filePath = join(exportDir, filename);

    const rowsGen = async function* () {
      let skip = 0;
      while (true) {
        const batch = await prisma.auth_history.findMany({
          where,
          skip,
          take: batchSize,
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
        });
        if (batch.length === 0) return;
        yield batch;
        if (batch.length < batchSize) return;
        skip += batchSize;
      }
    };

    const excel = await buildAuthLogsExcel({
      rows: rowsGen(),
      filePath,
      filename,
      totalCount,
      start: start ?? new Date(0),
      end: end ?? new Date(),
      stats: { successCount, failedCount, twoFactorCount },
      filters: {
        search: input.search,
        authType: input.authType,
        authStatus: input.authStatus,
        startDate: input.startDate,
        endDate: input.endDate,
      },
    });

    const fileInfo = await stat(excel.filePath);
    return {
      filePath: excel.filePath,
      filename: excel.filename,
      fileSize: fileInfo.size,
      totalCount,
      exportedCount: excel.exportedCount,
    };
  }
}
