import { Elysia, t } from "elysia";
import { AccountSecurityService } from "@/services/account-security.service";
import { getCurrentUserFromHeaders } from "@/utils/get-current-user";

export const accountSecurityController = new Elysia({ prefix: "/account-security" })
  .get("/password-policy", async () => {
    return AccountSecurityService.getPasswordPolicy();
  })
  .put("/password", async ({ request, body, set }) => {
    const user = getCurrentUserFromHeaders(request);
    if (!user?.id) {
      set.status = 401;
      return { success: false, message: "Authentication required" };
    }

    const result = await AccountSecurityService.changePassword(user.id, {
      ...body,
      ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
        || request.headers.get("x-real-ip"),
      userAgent: request.headers.get("user-agent"),
    });
    if (!result.success && "status" in result) set.status = result.status;
    return result;
  }, {
    body: t.Object({
      currentPassword: t.String({ minLength: 1 }),
      newPassword: t.String({ minLength: 1 }),
    }),
  });
