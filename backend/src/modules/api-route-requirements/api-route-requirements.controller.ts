import { Elysia, t } from "elysia";
import { ApiRouteRequirementsService } from "@/modules/api-route-requirements/api-route-requirements.service";
import { getCurrentUserFromHeaders } from "@/utils/get-current-user";

export const apiRouteRequirementsController = new Elysia({ prefix: "/api-route-requirements" })
  .get("/", async () => {
    return ApiRouteRequirementsService.list();
  })
  .get("/export", async ({ query }) => {
    const exported = await ApiRouteRequirementsService.exportExcel({
      search: query.search,
      method: query.method,
      resource: query.resource,
      status: query.status,
    });

    return new Response(exported.buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${exported.filename}"`,
      },
    });
  }, {
    query: t.Object({
      search: t.Optional(t.String()),
      method: t.Optional(t.String()),
      resource: t.Optional(t.String()),
      status: t.Optional(t.Union([t.Literal("all"), t.Literal("active"), t.Literal("inactive")])),
    }),
  })
  .put("/:id", async ({ params, body, request }) => {
    return ApiRouteRequirementsService.update(Number(params.id), body, getCurrentUserFromHeaders(request)?.id);
  }, {
    params: t.Object({ id: t.String() }),
    body: t.Object({
      permission_id: t.Optional(t.Nullable(t.String())),
      role_id: t.Optional(t.Nullable(t.String())),
      is_active: t.Optional(t.Boolean()),
    }),
  })
  .delete("/:id", async ({ params, request }) => {
    return ApiRouteRequirementsService.delete(Number(params.id), getCurrentUserFromHeaders(request)?.id);
  }, {
    params: t.Object({ id: t.String() }),
  });
