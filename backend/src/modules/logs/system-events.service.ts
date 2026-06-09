import prisma from "@/config/prisma.config";
import { buildSystemEventsExcel } from "@/templates/excel/system-events-excel";
import { mkdir, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export class SystemEventsService {
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
    eventType?: string;
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
            { event_name: { contains: opts.search } },
            { event_type: { contains: opts.search } },
            { message: { contains: opts.search } },
            { triggered_by: { contains: opts.search } },
          ],
        } : {},
        opts.eventType && opts.eventType !== "all" ? { event_type: opts.eventType } : {},
        opts.status && opts.status !== "all" ? { status: opts.status } : {},
        start ? { timestamp: { gte: start } } : {},
        end ? { timestamp: { lte: end } } : {},
      ],
    };
  }

  static async list(input: {
    search?: string;
    eventType?: string;
    status?: "all" | "success" | "failed" | "running" | "skipped";
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
      eventType: input.eventType,
      status: input.status,
      startDate: input.startDate,
      endDate: input.endDate,
    });

    const [events, totalItems, totalAll, successCount, failedCount, runningCount] = await Promise.all([
      prisma.system_events.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { timestamp: "desc" },
        select: {
          id: true,
          timestamp: true,
          event_type: true,
          event_name: true,
          status: true,
          duration_ms: true,
          message: true,
          triggered_by: true,
        },
      }),
      prisma.system_events.count({ where }),
      prisma.system_events.count(),
      prisma.system_events.count({ where: { status: "success" } }),
      prisma.system_events.count({ where: { status: "failed" } }),
      prisma.system_events.count({ where: { status: "running" } }),
    ]);

    const eventTypes = await prisma.system_events.findMany({
      distinct: ["event_type"],
      select: { event_type: true },
      orderBy: { event_type: "asc" },
    });

    return {
      success: true,
      data: {
        events: events.map((e) => ({
          id: e.id.toString(),
          timestamp: e.timestamp,
          eventType: e.event_type,
          eventName: e.event_name,
          status: e.status,
          durationMs: e.duration_ms,
          message: e.message,
          triggeredBy: e.triggered_by,
        })),
        pagination: {
          page,
          pageSize,
          totalItems,
          totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
        },
        stats: { total: totalAll, success: successCount, failed: failedCount, running: runningCount },
        eventTypes: eventTypes.map((e) => e.event_type),
      },
    };
  }

  static async exportExcel(input: {
    search?: string;
    eventType?: string;
    status?: "all" | "success" | "failed" | "running" | "skipped";
    startDate?: string;
    endDate?: string;
  } = {}) {
    const where = this.buildWhere({
      search: input.search?.trim(),
      eventType: input.eventType,
      status: input.status,
      startDate: input.startDate,
      endDate: input.endDate,
    });

    const start = this.parseDate(input.startDate, "start");
    const end = this.parseDate(input.endDate, "end");

    const [totalCount, successCount, failedCount, skippedCount] = await Promise.all([
      prisma.system_events.count({ where }),
      prisma.system_events.count({ where: { ...where, status: "success" } }),
      prisma.system_events.count({ where: { ...where, status: "failed" } }),
      prisma.system_events.count({ where: { ...where, status: "skipped" } }),
    ]);

    const batchSize = 1000;
    const exportDir = join(tmpdir(), "elysia-react-starter", "exports");
    await mkdir(exportDir, { recursive: true });

    const datePart = start && end
      ? `${start.toISOString().slice(0, 10)}_to_${end.toISOString().slice(0, 10)}`
      : `all_${new Date().toISOString().slice(0, 10)}`;
    const filename = `system-events_${datePart}_${Date.now()}.xlsx`;
    const filePath = join(exportDir, filename);

    const rowsGen = async function* () {
      let skip = 0;
      while (true) {
        const batch = await prisma.system_events.findMany({
          where,
          skip,
          take: batchSize,
          orderBy: { timestamp: "desc" },
          select: {
            id: true,
            timestamp: true,
            event_type: true,
            event_name: true,
            status: true,
            duration_ms: true,
            message: true,
            details: true,
            triggered_by: true,
          },
        });
        if (batch.length === 0) return;
        yield batch;
        if (batch.length < batchSize) return;
        skip += batchSize;
      }
    };

    const excel = await buildSystemEventsExcel({
      rows: rowsGen(),
      filePath,
      filename,
      totalCount,
      start: start ?? new Date(0),
      end: end ?? new Date(),
      stats: { successCount, failedCount, skippedCount },
      filters: {
        search: input.search,
        eventType: input.eventType,
        status: input.status,
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
