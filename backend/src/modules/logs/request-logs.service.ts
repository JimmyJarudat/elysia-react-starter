import prisma from "@/config/prisma.config";

type MethodFilter = "all" | "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
type StatusFilter = "all" | "2xx" | "3xx" | "4xx" | "5xx";

interface ListRequestLogsInput {
  search?: string;
  method?: MethodFilter;
  status?: StatusFilter;
  page?: number;
  pageSize?: number;
}

const STATUS_RANGES: Record<Exclude<StatusFilter, "all">, [number, number]> = {
  "2xx": [200, 299],
  "3xx": [300, 399],
  "4xx": [400, 499],
  "5xx": [500, 599],
};

export class RequestLogsService {
  static async list(input: ListRequestLogsInput = {}) {
    const page = Number.isInteger(input.page) && input.page! > 0 ? input.page! : 1;
    const pageSize = Number.isInteger(input.pageSize) && input.pageSize! > 0
      ? Math.min(input.pageSize!, 100)
      : 20;
    const search = input.search?.trim();
    const method = input.method && input.method !== "all" ? input.method : undefined;
    const status = input.status ?? "all";

    const searchWhere = search ? {
      OR: [
        { path: { contains: search } },
        { url: { contains: search } },
        { ip_address: { contains: search } },
        { username: { contains: search } },
        { user_agent: { contains: search } },
      ],
    } : {};

    const methodWhere = method ? { method } : {};

    const statusWhere = status !== "all"
      ? { status_code: { gte: STATUS_RANGES[status][0], lte: STATUS_RANGES[status][1] } }
      : {};

    const where = { AND: [searchWhere, methodWhere, statusWhere] };

    const [logs, totalItems, totalAll, success, clientError, serverError] = await Promise.all([
      prisma.request_logs.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { timestamp: "desc" },
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
}
