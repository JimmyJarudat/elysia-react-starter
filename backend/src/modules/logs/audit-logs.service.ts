import prisma from "@/config/prisma.config";
import { buildAuditLogsExcel } from "@/templates/excel/audit-logs-excel";
import { mkdir, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export class AuditLogsService {
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
    action?: string;
    tableName?: string;
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
            { table_name: { contains: opts.search } },
            { record_id: { contains: opts.search } },
            { changed_fields: { contains: opts.search } },
          ],
        } : {},
        opts.action && opts.action !== "all" ? { action: opts.action } : {},
        opts.tableName ? { table_name: { contains: opts.tableName } } : {},
        start ? { timestamp: { gte: start } } : {},
        end ? { timestamp: { lte: end } } : {},
      ],
    };
  }

  static async list(input: {
    search?: string;
    action?: "all" | "CREATE" | "UPDATE" | "DELETE";
    tableName?: string;
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
      action: input.action,
      tableName: input.tableName?.trim(),
      startDate: input.startDate,
      endDate: input.endDate,
    });

    const [logs, totalItems, totalAll, createCount, updateCount, deleteCount] = await Promise.all([
      prisma.audit_logs.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { timestamp: "desc" },
        select: {
          id: true,
          timestamp: true,
          user_id: true,
          username: true,
          action: true,
          table_name: true,
          record_id: true,
          changed_fields: true,
          ip_address: true,
          request_id: true,
        },
      }),
      prisma.audit_logs.count({ where }),
      prisma.audit_logs.count(),
      prisma.audit_logs.count({ where: { action: "CREATE" } }),
      prisma.audit_logs.count({ where: { action: "UPDATE" } }),
      prisma.audit_logs.count({ where: { action: "DELETE" } }),
    ]);

    return {
      success: true,
      data: {
        logs: logs.map((log) => ({
          id: log.id.toString(),
          timestamp: log.timestamp,
          userId: log.user_id,
          username: log.username,
          action: log.action,
          tableName: log.table_name,
          recordId: log.record_id,
          changedFields: log.changed_fields,
          ipAddress: log.ip_address,
          requestId: log.request_id,
        })),
        pagination: {
          page,
          pageSize,
          totalItems,
          totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
        },
        stats: { total: totalAll, create: createCount, update: updateCount, delete: deleteCount },
      },
    };
  }

  static async exportExcel(input: {
    search?: string;
    action?: "all" | "CREATE" | "UPDATE" | "DELETE";
    tableName?: string;
    startDate?: string;
    endDate?: string;
  } = {}) {
    const where = this.buildWhere({
      search: input.search?.trim(),
      action: input.action,
      tableName: input.tableName?.trim(),
      startDate: input.startDate,
      endDate: input.endDate,
    });

    const start = this.parseDate(input.startDate, "start");
    const end = this.parseDate(input.endDate, "end");

    const [totalCount, createCount, updateCount, deleteCount] = await Promise.all([
      prisma.audit_logs.count({ where }),
      prisma.audit_logs.count({ where: { ...where, action: "CREATE" } }),
      prisma.audit_logs.count({ where: { ...where, action: "UPDATE" } }),
      prisma.audit_logs.count({ where: { ...where, action: "DELETE" } }),
    ]);

    const batchSize = 500;
    const exportDir = join(tmpdir(), "elysia-react-starter", "exports");
    await mkdir(exportDir, { recursive: true });

    const datePart = start && end
      ? `${start.toISOString().slice(0, 10)}_to_${end.toISOString().slice(0, 10)}`
      : `all_${new Date().toISOString().slice(0, 10)}`;
    const filename = `audit-logs_${datePart}_${Date.now()}.xlsx`;
    const filePath = join(exportDir, filename);

    const rowsGen = async function* () {
      let skip = 0;
      while (true) {
        const batch = await prisma.audit_logs.findMany({
          where,
          skip,
          take: batchSize,
          orderBy: { timestamp: "desc" },
          select: {
            id: true,
            timestamp: true,
            user_id: true,
            username: true,
            action: true,
            table_name: true,
            record_id: true,
            before_data: true,
            after_data: true,
            changed_fields: true,
            ip_address: true,
            request_id: true,
          },
        });
        if (batch.length === 0) return;
        yield batch;
        if (batch.length < batchSize) return;
        skip += batchSize;
      }
    };

    const excel = await buildAuditLogsExcel({
      rows: rowsGen(),
      filePath,
      filename,
      totalCount,
      start: start ?? new Date(0),
      end: end ?? new Date(),
      stats: { createCount, updateCount, deleteCount },
      filters: {
        search: input.search,
        action: input.action,
        tableName: input.tableName,
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
