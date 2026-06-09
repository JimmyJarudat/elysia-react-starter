import prisma from "@/config/prisma.config";

type ConsoleLevel = "info" | "warn" | "error" | "debug";
type ConsoleSource = "request" | "auth" | "activity" | "audit" | "error" | "system";

export class LiveConsoleService {
  static normalize(input: {
    level?: string;
    source?: string;
    search?: string;
    limit?: string;
  }) {
    const levels = new Set(["all", "info", "warn", "error", "debug"]);
    const sources = new Set(["all", "request", "auth", "activity", "audit", "error", "system"]);
    const level = levels.has(input.level ?? "all") ? input.level ?? "all" : "all";
    const source = sources.has(input.source ?? "all") ? input.source ?? "all" : "all";
    const limit = Math.max(20, Math.min(Number(input.limit) || 120, 300));
    return { level, source, search: input.search?.trim() || undefined, limit };
  }

  static async list(input: {
    level?: string;
    source?: string;
    search?: string;
    limit?: string;
  }) {
    const options = this.normalize(input);
    const events = await this.getEvents({ ...options, since: null });
    return { success: true, data: { events, filters: options } };
  }

  static async getEvents(input: {
    level: string;
    source: string;
    search?: string;
    limit: number;
    since: Date | null;
  }) {
    const shouldRead = (source: ConsoleSource) => input.source === "all" || input.source === source;
    const take = input.since ? Math.min(input.limit, 100) : Math.min(input.limit, 80);
    const timestampWhere = input.since ? { timestamp: { gt: input.since } } : undefined;
    const createdAtWhere = input.since ? { created_at: { gt: input.since } } : undefined;

    const [requestRows, authRows, activityRows, auditRows, errorRows, systemRows] = await Promise.all([
      shouldRead("request")
        ? prisma.request_logs.findMany({
            where: timestampWhere,
            orderBy: { timestamp: input.since ? "asc" : "desc" },
            take,
            select: {
              id: true, timestamp: true, method: true, path: true, username: true,
              ip_address: true, status_code: true, response_time: true, error_message: true,
            },
          })
        : [],
      shouldRead("auth")
        ? prisma.auth_history.findMany({
            where: createdAtWhere,
            orderBy: { created_at: input.since ? "asc" : "desc" },
            take,
            select: {
              id: true, created_at: true, username: true, auth_type: true,
              auth_status: true, failure_reason: true, ip_address: true, browser: true, os: true,
            },
          })
        : [],
      shouldRead("activity")
        ? prisma.activity_logs.findMany({
            where: timestampWhere,
            orderBy: { timestamp: input.since ? "asc" : "desc" },
            take,
            select: {
              id: true, timestamp: true, username: true, action: true,
              resource_type: true, resource_id: true, description: true, status: true,
            },
          })
        : [],
      shouldRead("audit")
        ? prisma.audit_logs.findMany({
            where: timestampWhere,
            orderBy: { timestamp: input.since ? "asc" : "desc" },
            take,
            select: {
              id: true, timestamp: true, username: true, action: true,
              table_name: true, record_id: true, changed_fields: true,
            },
          })
        : [],
      shouldRead("error")
        ? prisma.error_logs.findMany({
            where: timestampWhere,
            orderBy: { timestamp: input.since ? "asc" : "desc" },
            take,
            select: {
              id: true, timestamp: true, level: true, message: true, source: true,
              code: true, username: true, request_path: true, request_method: true, resolved: true,
            },
          })
        : [],
      shouldRead("system")
        ? prisma.system_events.findMany({
            where: timestampWhere,
            orderBy: { timestamp: input.since ? "asc" : "desc" },
            take,
            select: {
              id: true, timestamp: true, event_type: true, event_name: true,
              status: true, duration_ms: true, message: true, triggered_by: true,
            },
          })
        : [],
    ]);

    const events = [
      ...requestRows.map((row) => {
        const status = row.status_code ?? 0;
        const level: ConsoleLevel = status >= 500 ? "error" : status >= 400 ? "warn" : "info";
        return {
          id: `request:${row.id}`,
          timestamp: row.timestamp.toISOString(),
          level,
          source: "request" as const,
          title: `${row.method} ${row.path}`,
          message: `${row.method} ${row.path} -> ${row.status_code ?? "-"}${row.response_time !== null ? ` in ${row.response_time}ms` : ""}`,
          context: {
            username: row.username, ipAddress: row.ip_address,
            statusCode: row.status_code, responseTime: row.response_time, errorMessage: row.error_message,
          },
        };
      }),
      ...authRows.map((row) => ({
        id: `auth:${row.id}`,
        timestamp: row.created_at.toISOString(),
        level: (row.auth_status.toLowerCase().includes("fail") ? "warn" : "info") as ConsoleLevel,
        source: "auth" as const,
        title: `${row.auth_type} ${row.auth_status}`,
        message: `${row.username} ${row.auth_type} ${row.auth_status}${row.failure_reason ? `: ${row.failure_reason}` : ""}`,
        context: { username: row.username, ipAddress: row.ip_address, browser: row.browser, os: row.os },
      })),
      ...activityRows.map((row) => ({
        id: `activity:${row.id.toString()}`,
        timestamp: row.timestamp.toISOString(),
        level: (row.status === "failed" ? "warn" : "info") as ConsoleLevel,
        source: "activity" as const,
        title: `${row.action} ${row.resource_type}`,
        message: row.description ?? `${row.action} ${row.resource_type}${row.resource_id ? ` #${row.resource_id}` : ""}`,
        context: { username: row.username, resourceType: row.resource_type, resourceId: row.resource_id, status: row.status },
      })),
      ...auditRows.map((row) => ({
        id: `audit:${row.id.toString()}`,
        timestamp: row.timestamp.toISOString(),
        level: "debug" as const,
        source: "audit" as const,
        title: `${row.action} ${row.table_name}`,
        message: `${row.action} ${row.table_name} record ${row.record_id}`,
        context: { username: row.username, tableName: row.table_name, recordId: row.record_id, changedFields: row.changed_fields },
      })),
      ...errorRows.map((row) => ({
        id: `error:${row.id.toString()}`,
        timestamp: row.timestamp.toISOString(),
        level: (row.level === "warn" ? "warn" : "error") as ConsoleLevel,
        source: "error" as const,
        title: row.source ?? row.code ?? "error",
        message: row.message,
        context: { username: row.username, code: row.code, requestPath: row.request_path, requestMethod: row.request_method, resolved: row.resolved },
      })),
      ...systemRows.map((row) => {
        const level: ConsoleLevel = row.status === "failed" ? "error"
          : row.status === "skipped" ? "warn"
          : row.status === "running" ? "debug"
          : "info";
        return {
          id: `system:${row.id.toString()}`,
          timestamp: row.timestamp.toISOString(),
          level,
          source: "system" as const,
          title: `${row.event_type} ${row.event_name}`,
          message: row.message ?? `${row.event_name} ${row.status}`,
          context: { eventType: row.event_type, status: row.status, durationMs: row.duration_ms, triggeredBy: row.triggered_by },
        };
      }),
    ];

    const query = input.search?.toLowerCase();
    const filtered = events
      .filter((event) => input.level === "all" || event.level === input.level)
      .filter((event) => {
        if (!query) return true;
        return [
          event.level, event.source, event.title, event.message,
          ...Object.values(event.context).map((v) => v === null || v === undefined ? "" : String(v)),
        ].some((v) => v.toLowerCase().includes(query));
      })
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    if (input.since) return filtered.slice(0, input.limit);
    return filtered.slice(-input.limit);
  }
}
