import { Elysia, t } from "elysia";
import { SessionsService } from "@/modules/sessions/sessions.service";
import { getCurrentUserFromHeaders } from "@/utils/get-current-user";

export const sessionsController = new Elysia({ prefix: "/sessions" })
  .get("/", async ({ request, query }) => {
    const user = getCurrentUserFromHeaders(request);
    return SessionsService.list(user?.sessionId ?? null, {
      search: query.search,
      status: query.status,
      page: Number(query.page),
      pageSize: Number(query.pageSize),
    });
  }, {
    query: t.Object({
      search: t.Optional(t.String()),
      status: t.Optional(t.Union([
        t.Literal("all"),
        t.Literal("active"),
        t.Literal("inactive"),
        t.Literal("expired"),
      ])),
      page: t.Optional(t.String()),
      pageSize: t.Optional(t.String()),
    }),
  })
  .delete("/:id", async ({ request, params, set }) => {
    const user = getCurrentUserFromHeaders(request);
    const result = await SessionsService.revoke(Number(params.id), user?.sessionId ?? null, user?.id);

    if (!result.success && "status" in result) {
      set.status = result.status;
    }

    return result;
  }, {
    params: t.Object({ id: t.String() }),
  });
