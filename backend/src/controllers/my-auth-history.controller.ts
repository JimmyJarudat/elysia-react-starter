import { Elysia, t } from "elysia";
import { MyAuthHistoryService } from "@/services/my-auth-history.service";
import { getCurrentUserFromHeaders } from "@/utils/get-current-user";

export const myAuthHistoryController = new Elysia({ prefix: "/my-auth-history" })
  .get("/", async ({ request, set }) => {
    const user = getCurrentUserFromHeaders(request);
    if (!user) {
      set.status = 401;
      return { success: false, message: "Unauthorized" };
    }

    return MyAuthHistoryService.getOverview(user.id, user.sessionId ?? null);
  })

  .delete("/sessions/:id", async ({ request, params, set }) => {
    const user = getCurrentUserFromHeaders(request);
    if (!user) {
      set.status = 401;
      return { success: false, message: "Unauthorized" };
    }

    const result = await MyAuthHistoryService.revokeSession(
      user.id,
      user.sessionId ?? null,
      Number(params.id),
    );

    if (!result.success && "status" in result) {
      set.status = result.status;
    }

    return result;
  }, {
    params: t.Object({ id: t.String() }),
  });
