import { Elysia, t } from "elysia";
import { RequestLogsService } from "@/modules/logs/request-logs.service";
import { AuthLogsService } from "@/modules/logs/auth-logs.service";
import { LiveConsoleService } from "@/modules/logs/live-console.service";
import { unlink } from "node:fs/promises";

const encoder = new TextEncoder();

const sseMessage = (event: string, data: unknown) => (
  encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
);

export const logsController = new Elysia({ prefix: "/logs" })
  .get("/request", async ({ query }) => {
    return RequestLogsService.list({
      search: query.search,
      method: query.method,
      status: query.status,
      page: Number(query.page),
      pageSize: Number(query.pageSize),
    });
  }, {
    query: t.Object({
      search: t.Optional(t.String()),
      method: t.Optional(t.Union([
        t.Literal("all"),
        t.Literal("GET"),
        t.Literal("POST"),
        t.Literal("PUT"),
        t.Literal("PATCH"),
        t.Literal("DELETE"),
      ])),
      status: t.Optional(t.Union([
        t.Literal("all"),
        t.Literal("2xx"),
        t.Literal("3xx"),
        t.Literal("4xx"),
        t.Literal("5xx"),
      ])),
      page: t.Optional(t.String()),
      pageSize: t.Optional(t.String()),
    }),
  })
  .get("/request/export", async ({ query }) => {
    const exported = await RequestLogsService.exportExcel({
      preset: query.preset,
      startDate: query.startDate,
      endDate: query.endDate,
      search: query.search,
      method: query.method,
      status: query.status,
    });

    setTimeout(() => {
      void unlink(exported.filePath).catch(() => {});
    }, 10 * 60 * 1000);

    return new Response(Bun.file(exported.filePath), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${exported.filename}"`,
        "Content-Length": String(exported.fileSize),
      },
    });
  }, {
    query: t.Object({
      preset: t.Optional(t.Union([
        t.Literal("today"),
        t.Literal("1m"),
        t.Literal("3m"),
        t.Literal("custom"),
      ])),
      startDate: t.Optional(t.String()),
      endDate: t.Optional(t.String()),
      search: t.Optional(t.String()),
      method: t.Optional(t.Union([
        t.Literal("all"),
        t.Literal("GET"),
        t.Literal("POST"),
        t.Literal("PUT"),
        t.Literal("PATCH"),
        t.Literal("DELETE"),
      ])),
      status: t.Optional(t.Union([
        t.Literal("all"),
        t.Literal("2xx"),
        t.Literal("3xx"),
        t.Literal("4xx"),
        t.Literal("5xx"),
      ])),
    }),
  })
  .get("/request/analytics", async ({ query }) => {
    return RequestLogsService.analytics(query.range ?? "24h");
  }, {
    query: t.Object({
      range: t.Optional(t.Union([t.Literal("24h"), t.Literal("7d")])),
    }),
  })
  .get("/auth", async ({ query }) => {
    return AuthLogsService.list({
      search: query.search,
      authType: query.authType,
      authStatus: query.authStatus,
      startDate: query.startDate,
      endDate: query.endDate,
      page: Number(query.page),
      pageSize: Number(query.pageSize),
    });
  }, {
    query: t.Object({
      search: t.Optional(t.String()),
      authType: t.Optional(t.Union([
        t.Literal("all"),
        t.Literal("LOGIN"),
        t.Literal("LOGOUT"),
        t.Literal("REGISTER"),
        t.Literal("PASSWORD_RESET"),
      ])),
      authStatus: t.Optional(t.Union([
        t.Literal("all"),
        t.Literal("SUCCESS"),
        t.Literal("FAILED"),
      ])),
      startDate: t.Optional(t.String()),
      endDate: t.Optional(t.String()),
      page: t.Optional(t.String()),
      pageSize: t.Optional(t.String()),
    }),
  })
  .get("/auth/export", async ({ query }) => {
    const exported = await AuthLogsService.exportExcel({
      startDate: query.startDate,
      endDate: query.endDate,
      search: query.search,
      authType: query.authType,
      authStatus: query.authStatus,
    });

    setTimeout(() => {
      void unlink(exported.filePath).catch(() => {});
    }, 10 * 60 * 1000);

    return new Response(Bun.file(exported.filePath), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${exported.filename}"`,
        "Content-Length": String(exported.fileSize),
      },
    });
  }, {
    query: t.Object({
      startDate: t.Optional(t.String()),
      endDate: t.Optional(t.String()),
      search: t.Optional(t.String()),
      authType: t.Optional(t.Union([
        t.Literal("all"),
        t.Literal("LOGIN"),
        t.Literal("LOGOUT"),
        t.Literal("REGISTER"),
        t.Literal("PASSWORD_RESET"),
      ])),
      authStatus: t.Optional(t.Union([
        t.Literal("all"),
        t.Literal("SUCCESS"),
        t.Literal("FAILED"),
      ])),
    }),
  })
  .get("/live-console", async ({ query }) => {
    return LiveConsoleService.list({
      level: query.level,
      source: query.source,
      search: query.search,
      limit: query.limit,
    });
  }, {
    query: t.Object({
      level: t.Optional(t.String()),
      source: t.Optional(t.String()),
      search: t.Optional(t.String()),
      limit: t.Optional(t.String()),
    }),
  })
  .get("/live-console/stream", ({ request, query }) => {
    const options = LiveConsoleService.normalize({
      level: query.level,
      source: query.source,
      search: query.search,
      limit: query.limit,
    });
    let heartbeatTimer: ReturnType<typeof setInterval>;
    let pollTimer: ReturnType<typeof setInterval>;
    let lastSeenAt: Date | null = null;
    let polling = false;

    const stream = new ReadableStream({
      async start(ctrl) {
        const close = () => {
          clearInterval(heartbeatTimer);
          clearInterval(pollTimer);
          try { ctrl.close(); } catch { /* already closed */ }
        };
        const send = (event: string, data: unknown) => {
          try {
            ctrl.enqueue(sseMessage(event, data));
          } catch {
            close();
          }
        };
        const updateCursor = (events: Array<{ timestamp: string }>) => {
          for (const event of events) {
            const timestamp = new Date(event.timestamp);
            if (!lastSeenAt || timestamp.getTime() > lastSeenAt.getTime()) {
              lastSeenAt = timestamp;
            }
          }
        };
        const poll = async () => {
          if (polling) return;
          polling = true;
          try {
            const events = await LiveConsoleService.getEvents({
              ...options,
              since: lastSeenAt,
            });
            if (events.length > 0) {
              updateCursor(events);
              for (const event of events) send("log", event);
            }
          } catch (error) {
            send("stream-error", {
              message: error instanceof Error ? error.message : "Unable to read live console events",
            });
          } finally {
            polling = false;
          }
        };

        ctrl.enqueue(encoder.encode(": connected\n\n"));
        send("ready", {
          connectedAt: new Date().toISOString(),
          filters: options,
          pollIntervalMs: 2_000,
        });

        const snapshot = await LiveConsoleService.getEvents({
          ...options,
          since: null,
        });
        updateCursor(snapshot);
        if (!lastSeenAt) lastSeenAt = new Date();
        send("snapshot", snapshot);

        heartbeatTimer = setInterval(() => {
          send("heartbeat", { timestamp: new Date().toISOString() });
        }, 25_000);
        pollTimer = setInterval(() => {
          void poll();
        }, 2_000);

        request.signal.addEventListener("abort", close);
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  }, {
    query: t.Object({
      level: t.Optional(t.String()),
      source: t.Optional(t.String()),
      search: t.Optional(t.String()),
      limit: t.Optional(t.String()),
    }),
  });
