import { Elysia, t } from "elysia";
import { ApiRouteRequirementsService } from "@/services/api-route-requirements.service";

const updateBody = t.Object({
  permission_id: t.Optional(t.Nullable(t.String())),
  role_id: t.Optional(t.Nullable(t.String())),
  is_active: t.Optional(t.Boolean()),
});

export const apiRouteRequirementsController = new Elysia({ prefix: "/api-route-requirements" })
  .get("/", async () => ApiRouteRequirementsService.list())
  .put("/:id", async ({ params, body }) =>
    ApiRouteRequirementsService.update(Number(params.id), body), {
    params: t.Object({ id: t.String() }),
    body: updateBody,
  })
  .delete("/:id", async ({ params }) =>
    ApiRouteRequirementsService.delete(Number(params.id)), {
    params: t.Object({ id: t.String() }),
  });
