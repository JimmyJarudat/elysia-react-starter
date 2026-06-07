import { Elysia, t } from "elysia";
import { RequestLogsService } from "@/modules/logs/request-logs.service";

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
  .get("/request/analytics", async ({ query }) => {
    return RequestLogsService.analytics(query.range ?? "24h");
  }, {
    query: t.Object({
      range: t.Optional(t.Union([t.Literal("24h"), t.Literal("7d")])),
    }),
  });
