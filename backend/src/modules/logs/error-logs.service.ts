import prisma from "@/config/prisma.config";
import { buildErrorLogsExcel } from "@/templates/excel/error-logs-excel";
import { buildLogOrderBy } from "@/modules/logs/log-sort";
import { mkdir, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const errorLogSortFields = {
  timestamp: "timestamp",
  level: "level",
  source: "source",
  username: "username",
  resolved: "resolved",
} as const;

export class ErrorLogsService {
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
    level?: string;
    resolved?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const start = this.parseDate(opts.startDate, "start");
    const end = this.parseDate(opts.endDate, "end");
    return {
      AND: [
        opts.search ? {
          OR: [
            { message: { contains: opts.search } },
            { source: { contains: opts.search } },
            { code: { contains: opts.search } },
            { username: { contains: opts.search } },
            { request_path: { contains: opts.search } },
          ],
        } : {},
        opts.level && opts.level !== "all" ? { level: opts.level } : {},
        opts.resolved === "resolved" ? { resolved: true }
          : opts.resolved === "unresolved" ? { resolved: false }
          : {},
        start ? { timestamp: { gte: start } } : {},
        end ? { timestamp: { lte: end } } : {},
      ],
    };
  }

  static async list(input: {
    search?: string;
    level?: "all" | "error" | "warn" | "fatal";
    resolved?: "all" | "resolved" | "unresolved";
    startDate?: string;
    endDate?: string;
    page?: number;
    pageSize?: number;
    sortBy?: string;
    sortOrder?: string;
  } = {}) {
    const page = Number.isInteger(input.page) && input.page! > 0 ? input.page! : 1;
    const pageSize = Number.isInteger(input.pageSize) && input.pageSize! > 0
      ? Math.min(input.pageSize!, 100)
      : 20;

    const where = this.buildWhere({
      search: input.search?.trim(),
      level: input.level,
      resolved: input.resolved,
      startDate: input.startDate,
      endDate: input.endDate,
    });

    const [logs, totalItems, totalAll, errorCount, warnCount, fatalCount, unresolvedCount] = await Promise.all([
      prisma.error_logs.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: buildLogOrderBy(input.sortBy, input.sortOrder, errorLogSortFields, "timestamp"),
        select: {
          id: true,
          timestamp: true,
          level: true,
          message: true,
          source: true,
          code: true,
          user_id: true,
          username: true,
          request_path: true,
          request_method: true,
          ip_address: true,
          resolved: true,
          resolved_at: true,
        },
      }),
      prisma.error_logs.count({ where }),
      prisma.error_logs.count(),
      prisma.error_logs.count({ where: { level: "error" } }),
      prisma.error_logs.count({ where: { level: "warn" } }),
      prisma.error_logs.count({ where: { level: "fatal" } }),
      prisma.error_logs.count({ where: { resolved: false } }),
    ]);

    return {
      success: true,
      data: {
        logs: logs.map((log) => ({
          id: log.id.toString(),
          timestamp: log.timestamp,
          level: log.level,
          message: log.message,
          source: log.source,
          code: log.code,
          userId: log.user_id,
          username: log.username,
          requestPath: log.request_path,
          requestMethod: log.request_method,
          ipAddress: log.ip_address,
          resolved: log.resolved,
          resolvedAt: log.resolved_at,
        })),
        pagination: {
          page,
          pageSize,
          totalItems,
          totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
        },
        stats: { total: totalAll, error: errorCount, warn: warnCount, fatal: fatalCount, unresolved: unresolvedCount },
      },
    };
  }

  static async resolve(id: string, resolved: boolean) {
    const log = await prisma.error_logs.update({
      where: { id: BigInt(id) },
      data: { resolved, resolved_at: resolved ? new Date() : null },
      select: { id: true, resolved: true, resolved_at: true },
    });
    return {
      success: true,
      data: { id: log.id.toString(), resolved: log.resolved, resolvedAt: log.resolved_at },
    };
  }

  static async exportExcel(input: {
    search?: string;
    level?: "all" | "error" | "warn" | "fatal";
    resolved?: "all" | "resolved" | "unresolved";
    startDate?: string;
    endDate?: string;
  } = {}) {
    const where = this.buildWhere({
      search: input.search?.trim(),
      level: input.level,
      resolved: input.resolved,
      startDate: input.startDate,
      endDate: input.endDate,
    });

    const start = this.parseDate(input.startDate, "start");
    const end = this.parseDate(input.endDate, "end");

    const [totalCount, errorCount, warnCount, fatalCount, resolvedCount] = await Promise.all([
      prisma.error_logs.count({ where }),
      prisma.error_logs.count({ where: { ...where, level: "error" } }),
      prisma.error_logs.count({ where: { ...where, level: "warn" } }),
      prisma.error_logs.count({ where: { ...where, level: "fatal" } }),
      prisma.error_logs.count({ where: { ...where, resolved: true } }),
    ]);

    const batchSize = 1000;
    const exportDir = join(tmpdir(), "elysia-react-starter", "exports");
    await mkdir(exportDir, { recursive: true });

    const datePart = start && end
      ? `${start.toISOString().slice(0, 10)}_to_${end.toISOString().slice(0, 10)}`
      : `all_${new Date().toISOString().slice(0, 10)}`;
    const filename = `error-logs_${datePart}_${Date.now()}.xlsx`;
    const filePath = join(exportDir, filename);

    const rowsGen = async function* () {
      let skip = 0;
      while (true) {
        const batch = await prisma.error_logs.findMany({
          where,
          skip,
          take: batchSize,
          orderBy: { timestamp: "desc" },
          select: {
            id: true,
            timestamp: true,
            level: true,
            message: true,
            stack_trace: true,
            source: true,
            code: true,
            user_id: true,
            username: true,
            request_path: true,
            request_method: true,
            ip_address: true,
            context: true,
            resolved: true,
            resolved_at: true,
          },
        });
        if (batch.length === 0) return;
        yield batch;
        if (batch.length < batchSize) return;
        skip += batchSize;
      }
    };

    const excel = await buildErrorLogsExcel({
      rows: rowsGen(),
      filePath,
      filename,
      totalCount,
      start: start ?? new Date(0),
      end: end ?? new Date(),
      stats: { errorCount, warnCount, fatalCount, resolvedCount },
      filters: {
        search: input.search,
        level: input.level,
        resolved: input.resolved,
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
