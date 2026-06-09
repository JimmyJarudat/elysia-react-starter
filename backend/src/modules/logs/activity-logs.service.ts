import prisma from "@/config/prisma.config";
import { buildActivityLogsExcel } from "@/templates/excel/activity-logs-excel";
import { ActivityLogUtil } from "@/utils/activity-log";
import { mkdir, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export class ActivityLogsService {
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
    resourceType?: string;
    status?: string;
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
            { action: { contains: opts.search } },
            { resource_type: { contains: opts.search } },
            { resource_id: { contains: opts.search } },
            { description: { contains: opts.search } },
            { ip_address: { contains: opts.search } },
            { metadata: { contains: opts.search } },
          ],
        } : {},
        opts.action && opts.action !== "all" ? { action: opts.action } : {},
        opts.resourceType ? { resource_type: opts.resourceType } : {},
        opts.status && opts.status !== "all" ? { status: opts.status } : {},
        start ? { timestamp: { gte: start } } : {},
        end ? { timestamp: { lte: end } } : {},
      ],
    };
  }

  static async list(input: {
    search?: string;
    action?: string;
    resourceType?: string;
    status?: "all" | "success" | "failed";
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
      resourceType: input.resourceType?.trim(),
      status: input.status,
      startDate: input.startDate,
      endDate: input.endDate,
    });

    const [logs, totalItems, totalAll, success, failed, exportCount] = await Promise.all([
      prisma.activity_logs.findMany({
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
          resource_type: true,
          resource_id: true,
          description: true,
          ip_address: true,
          user_agent: true,
          status: true,
          metadata: true,
        },
      }),
      prisma.activity_logs.count({ where }),
      prisma.activity_logs.count(),
      prisma.activity_logs.count({ where: { status: "success" } }),
      prisma.activity_logs.count({ where: { status: "failed" } }),
      prisma.activity_logs.count({ where: { action: "EXPORT" } }),
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
          resourceType: log.resource_type,
          resourceId: log.resource_id,
          description: log.description,
          ipAddress: log.ip_address,
          userAgent: log.user_agent,
          status: log.status,
          metadata: log.metadata,
        })),
        pagination: {
          page,
          pageSize,
          totalItems,
          totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
        },
        stats: { total: totalAll, success, failed, export: exportCount },
      },
    };
  }

  static async resourceTypes() {
    const resources = await prisma.activity_logs.groupBy({
      by: ["resource_type"],
      _count: { _all: true },
      orderBy: { resource_type: "asc" },
    });

    return {
      success: true,
      data: resources.map((resource) => ({
        resourceType: resource.resource_type,
        count: resource._count._all,
      })),
    };
  }

  static async exportExcel(input: {
    search?: string;
    action?: string;
    resourceType?: string;
    status?: "all" | "success" | "failed";
    startDate?: string;
    endDate?: string;
    actorId?: number | null;
    actorUsername?: string | null;
  } = {}) {
    const where = this.buildWhere({
      search: input.search?.trim(),
      action: input.action,
      resourceType: input.resourceType?.trim(),
      status: input.status,
      startDate: input.startDate,
      endDate: input.endDate,
    });

    const start = this.parseDate(input.startDate, "start");
    const end = this.parseDate(input.endDate, "end");

    const [totalCount, successCount, failedCount, exportCount] = await Promise.all([
      prisma.activity_logs.count({ where }),
      prisma.activity_logs.count({ where: { ...where, status: "success" } }),
      prisma.activity_logs.count({ where: { ...where, status: "failed" } }),
      prisma.activity_logs.count({ where: { ...where, action: "EXPORT" } }),
    ]);

    const batchSize = 2000;
    const exportDir = join(tmpdir(), "elysia-react-starter", "exports");
    await mkdir(exportDir, { recursive: true });

    const datePart = start && end
      ? `${start.toISOString().slice(0, 10)}_to_${end.toISOString().slice(0, 10)}`
      : `all_${new Date().toISOString().slice(0, 10)}`;
    const filename = `activity-logs_${datePart}_${Date.now()}.xlsx`;
    const filePath = join(exportDir, filename);

    const rowsGen = async function* () {
      let skip = 0;
      while (true) {
        const batch = await prisma.activity_logs.findMany({
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
            resource_type: true,
            resource_id: true,
            description: true,
            ip_address: true,
            user_agent: true,
            status: true,
            metadata: true,
          },
        });
        if (batch.length === 0) return;
        yield batch;
        if (batch.length < batchSize) return;
        skip += batchSize;
      }
    };

    const excel = await buildActivityLogsExcel({
      rows: rowsGen(),
      filePath,
      filename,
      totalCount,
      start: start ?? new Date(0),
      end: end ?? new Date(),
      stats: { successCount, failedCount, exportCount },
      filters: {
        search: input.search,
        action: input.action,
        resourceType: input.resourceType,
        status: input.status,
        startDate: input.startDate,
        endDate: input.endDate,
      },
    });

    const fileInfo = await stat(excel.filePath);
    ActivityLogUtil.log({
      userId: input.actorId,
      username: input.actorUsername,
      action: "EXPORT",
      resourceType: "activity_logs",
      description: "Exported activity logs to Excel",
      metadata: {
        filters: {
          search: input.search ?? null,
          action: input.action ?? null,
          resourceType: input.resourceType ?? null,
          status: input.status ?? null,
          startDate: input.startDate ?? null,
          endDate: input.endDate ?? null,
        },
        totalCount,
        exportedCount: excel.exportedCount,
        filename: excel.filename,
      },
    });

    return {
      filePath: excel.filePath,
      filename: excel.filename,
      fileSize: fileInfo.size,
      totalCount,
      exportedCount: excel.exportedCount,
    };
  }
}
