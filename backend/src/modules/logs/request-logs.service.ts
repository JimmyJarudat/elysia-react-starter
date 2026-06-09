import prisma from "@/config/prisma.config";
import { buildRequestLogsExcel } from "@/templates/excel/request-logs-excel";
import { buildLogOrderBy } from "@/modules/logs/log-sort";
import { mkdir, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const requestLogSortFields = {
  timestamp: "timestamp",
  method: "method",
  path: "path",
  username: "username",
  statusCode: "status_code",
  responseTime: "response_time",
} as const;

export class RequestLogsService {
  static async list(input: {
    search?: string;
    method?: "all" | "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    status?: "all" | "2xx" | "3xx" | "4xx" | "5xx";
    page?: number;
    pageSize?: number;
    sortBy?: string;
    sortOrder?: string;
  } = {}) {
    const page = Number.isInteger(input.page) && input.page! > 0 ? input.page! : 1;
    const pageSize = Number.isInteger(input.pageSize) && input.pageSize! > 0
      ? Math.min(input.pageSize!, 100)
      : 20;
    const search = input.search?.trim();
    const method = input.method && input.method !== "all" ? input.method : undefined;
    const status = input.status ?? "all";
    const statusRanges = {
      "2xx": [200, 299],
      "3xx": [300, 399],
      "4xx": [400, 499],
      "5xx": [500, 599],
    } as const;

    const where = {
      AND: [
        search ? {
          OR: [
            { path: { contains: search } },
            { url: { contains: search } },
            { ip_address: { contains: search } },
            { username: { contains: search } },
            { user_agent: { contains: search } },
          ],
        } : {},
        method ? { method } : {},
        status !== "all"
          ? { status_code: { gte: statusRanges[status][0], lte: statusRanges[status][1] } }
          : {},
      ],
    };

    const [logs, totalItems, totalAll, success, clientError, serverError] = await Promise.all([
      prisma.request_logs.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: buildLogOrderBy(input.sortBy, input.sortOrder, requestLogSortFields, "timestamp"),
        select: {
          id: true,
          timestamp: true,
          method: true,
          path: true,
          query_params: true,
          user_id: true,
          username: true,
          ip_address: true,
          browser: true,
          os: true,
          device_type: true,
          status_code: true,
          response_time: true,
          error_message: true,
        },
      }),
      prisma.request_logs.count({ where }),
      prisma.request_logs.count(),
      prisma.request_logs.count({ where: { status_code: { gte: 200, lte: 399 } } }),
      prisma.request_logs.count({ where: { status_code: { gte: 400, lte: 499 } } }),
      prisma.request_logs.count({ where: { status_code: { gte: 500, lte: 599 } } }),
    ]);

    return {
      success: true,
      data: {
        logs: logs.map((log) => ({
          id: log.id,
          timestamp: log.timestamp,
          method: log.method,
          path: log.path,
          queryParams: log.query_params,
          userId: log.user_id,
          username: log.username,
          ipAddress: log.ip_address,
          browser: log.browser,
          os: log.os,
          deviceType: log.device_type,
          statusCode: log.status_code,
          responseTime: log.response_time,
          errorMessage: log.error_message,
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
          clientError,
          serverError,
        },
      },
    };
  }

  static async analytics(range: "24h" | "7d" = "24h") {
    const recordLimit = 20000;
    const bucketCount = range === "24h" ? 24 : 7;
    const bucketMs = range === "24h" ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    const since = new Date(Date.now() - bucketCount * bucketMs);
    const percentile = (sorted: number[], p: number): number | null => {
      if (sorted.length === 0) return null;
      const index = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
      return sorted[index];
    };

    const records = await prisma.request_logs.findMany({
      where: { timestamp: { gte: since } },
      orderBy: { timestamp: "asc" },
      take: recordLimit,
      select: {
        timestamp: true,
        method: true,
        path: true,
        status_code: true,
        response_time: true,
      },
    });

    const trend = Array.from({ length: bucketCount }, (_, index) => ({
      bucket: new Date(since.getTime() + index * bucketMs).toISOString(),
      total: 0,
      errors: 0,
    }));

    const pathStats = new Map<string, { count: number; errorCount: number; responseTimeSum: number; responseTimeSamples: number }>();
    const statusCounts = new Map<number, number>();
    const methodCounts = new Map<string, number>();
    const responseTimes: number[] = [];

    for (const record of records) {
      const bucketIndex = Math.min(bucketCount - 1, Math.max(0, Math.floor((record.timestamp.getTime() - since.getTime()) / bucketMs)));
      const isError = (record.status_code ?? 0) >= 400;
      trend[bucketIndex].total += 1;
      if (isError) trend[bucketIndex].errors += 1;

      const path = pathStats.get(record.path) ?? { count: 0, errorCount: 0, responseTimeSum: 0, responseTimeSamples: 0 };
      path.count += 1;
      if (isError) path.errorCount += 1;
      if (record.response_time !== null) {
        path.responseTimeSum += record.response_time;
        path.responseTimeSamples += 1;
      }
      pathStats.set(record.path, path);

      if (record.status_code !== null) {
        statusCounts.set(record.status_code, (statusCounts.get(record.status_code) ?? 0) + 1);
      }
      methodCounts.set(record.method, (methodCounts.get(record.method) ?? 0) + 1);

      if (record.response_time !== null) {
        responseTimes.push(record.response_time);
      }
    }

    const topPaths = [...pathStats.entries()]
      .map(([path, stat]) => ({
        path,
        count: stat.count,
        errorCount: stat.errorCount,
        avgResponseTime: stat.responseTimeSamples > 0 ? Math.round(stat.responseTimeSum / stat.responseTimeSamples) : null,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const statusBreakdown = [...statusCounts.entries()]
      .map(([statusCode, count]) => ({ statusCode, count }))
      .sort((a, b) => b.count - a.count);

    const methodBreakdown = [...methodCounts.entries()]
      .map(([method, count]) => ({ method, count }))
      .sort((a, b) => b.count - a.count);

    responseTimes.sort((a, b) => a - b);
    const responseTimeSum = responseTimes.reduce((sum, value) => sum + value, 0);

    return {
      success: true,
      data: {
        range,
        since: since.toISOString(),
        recordCount: records.length,
        trend,
        topPaths,
        statusBreakdown,
        methodBreakdown,
        responseTime: {
          p50: percentile(responseTimes, 50),
          p95: percentile(responseTimes, 95),
          p99: percentile(responseTimes, 99),
          avg: responseTimes.length > 0 ? Math.round(responseTimeSum / responseTimes.length) : null,
          max: responseTimes.length > 0 ? responseTimes[responseTimes.length - 1] : null,
        },
      },
    };
  }

  static async exportExcel(input: {
    preset?: "today" | "1m" | "3m" | "custom";
    startDate?: string;
    endDate?: string;
    search?: string;
    method?: "all" | "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    status?: "all" | "2xx" | "3xx" | "4xx" | "5xx";
  } = {}) {
    const today = new Date();
    const preset = input.preset ?? "today";
    const statusRanges = {
      "2xx": [200, 299],
      "3xx": [300, 399],
      "4xx": [400, 499],
      "5xx": [500, 599],
    } as const;
    const startOfDay = (date: Date) => {
      const next = new Date(date);
      next.setHours(0, 0, 0, 0);
      return next;
    };
    const endOfDay = (date: Date) => {
      const next = new Date(date);
      next.setHours(23, 59, 59, 999);
      return next;
    };
    const parseDateOnly = (value?: string, boundary: "start" | "end" = "start") => {
      if (!value) return null;
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
      if (match) {
        const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
        return boundary === "start" ? startOfDay(date) : endOfDay(date);
      }

      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return null;
      return boundary === "start" ? startOfDay(date) : endOfDay(date);
    };

    let start = startOfDay(today);
    let end = endOfDay(today);

    if (preset === "custom") {
      const customStart = parseDateOnly(input.startDate, "start");
      const customEnd = parseDateOnly(input.endDate, "end");
      if (!customStart || !customEnd) throw new Error("startDate and endDate are required for custom export.");
      if (customStart.getTime() > customEnd.getTime()) throw new Error("startDate must be before or equal to endDate.");
      start = customStart;
      end = customEnd;
    } else if (preset === "1m" || preset === "3m") {
      start = startOfDay(today);
      start.setMonth(start.getMonth() - (preset === "1m" ? 1 : 3));
    }

    const search = input.search?.trim();
    const method = input.method && input.method !== "all" ? input.method : undefined;
    const status = input.status ?? "all";
    const where = {
      AND: [
        search ? {
          OR: [
            { path: { contains: search } },
            { url: { contains: search } },
            { ip_address: { contains: search } },
            { username: { contains: search } },
            { user_agent: { contains: search } },
          ],
        } : {},
        method ? { method } : {},
        status !== "all"
          ? { status_code: { gte: statusRanges[status][0], lte: statusRanges[status][1] } }
          : {},
        { timestamp: { gte: start, lte: end } },
      ],
    };

    const totalCount = await prisma.request_logs.count({ where });
    const batchSize = 2000;
    const exportDir = join(tmpdir(), "elysia-react-starter", "exports");
    await mkdir(exportDir, { recursive: true });

    const datePart = `${start.toISOString().slice(0, 10)}_to_${end.toISOString().slice(0, 10)}`;
    const filename = `request-logs_${datePart}_${Date.now()}.xlsx`;
    const filePath = join(exportDir, filename);
    const rows = async function* () {
      let skip = 0;

      while (true) {
        const batch = await prisma.request_logs.findMany({
          where,
          skip,
          take: batchSize,
          orderBy: { timestamp: "desc" },
          select: {
            id: true,
            timestamp: true,
            method: true,
            url: true,
            path: true,
            query_params: true,
            user_id: true,
            username: true,
            ip_address: true,
            user_agent: true,
            browser: true,
            os: true,
            device_type: true,
            platform: true,
            status_code: true,
            response_time: true,
            request_size: true,
            error_message: true,
            error_stack: true,
            referer: true,
            session_id: true,
          },
        });

        if (batch.length === 0) return;
        yield batch;
        if (batch.length < batchSize) return;
        skip += batchSize;
      }
    };

    const excel = await buildRequestLogsExcel({
      rows: rows(),
      filePath,
      filename,
      totalCount,
      preset,
      start,
      end,
      filters: {
        search: input.search,
        method: input.method,
        status: input.status,
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
