import { Elysia, t } from "elysia";
import { ApiRouteRequirementsService } from "@/services/api-route-requirements.service";

export const apiRouteRequirementsController = new Elysia({ prefix: "/api-route-requirements" })
  .get("/", async () => {
    return ApiRouteRequirementsService.list();
  })
  .put("/:id", async ({ params, body }) => {
    return ApiRouteRequirementsService.update(Number(params.id), body);
  }, {
    params: t.Object({ id: t.String() }),
    body: t.Object({
      permission_id: t.Optional(t.Nullable(t.String())),
      role_id: t.Optional(t.Nullable(t.String())),
      is_active: t.Optional(t.Boolean()),
    }),
  })
  .delete("/:id", async ({ params }) => {
    return ApiRouteRequirementsService.delete(Number(params.id));
  }, {
    params: t.Object({ id: t.String() }),
  });
