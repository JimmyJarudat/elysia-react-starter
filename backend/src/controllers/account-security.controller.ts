import { Elysia, t } from "elysia";
import { AccountSecurityService } from "@/services/account-security.service";
import { getCurrentUserFromHeaders } from "@/utils/get-current-user";

export const accountSecurityController = new Elysia({ prefix: "/account-security" })
  .get("/notifications", async ({ request, set }) => {
    const user = getCurrentUserFromHeaders(request);
    if (!user?.id) {
      set.status = 401;
      return { success: false, message: "Authentication required" };
    }

    return AccountSecurityService.getNotificationSettings(user.id);
  })
  .put("/notifications", async ({ request, body, set }) => {
    const user = getCurrentUserFromHeaders(request);
    if (!user?.id) {
      set.status = 401;
      return { success: false, message: "Authentication required" };
    }

    return AccountSecurityService.updateNotificationSettings(user.id, body);
  }, {
    body: t.Object({
      loginNotifications: t.Boolean(),
      securityNotifications: t.Boolean(),
      systemNotifications: t.Boolean(),
      emailNotifications: t.Boolean(),
      soundNotifications: t.Boolean(),
    }),
  })
  .get("/emails", async ({ request, set }) => {
    const user = getCurrentUserFromHeaders(request);
    if (!user?.id) {
      set.status = 401;
      return { success: false, message: "Authentication required" };
    }
    const result = await AccountSecurityService.getEmailSettings(user.id);
    if (!result.success && "status" in result) set.status = result.status;
    return result;
  })
  .post("/emails/send-code", async ({ request, body, set }) => {
    const user = getCurrentUserFromHeaders(request);
    if (!user?.id) {
      set.status = 401;
      return { success: false, message: "Authentication required" };
    }
    const result = await AccountSecurityService.sendEmailVerificationCode(user.id, body);
    if (!result.success && "status" in result) set.status = result.status;
    return result;
  }, {
    body: t.Object({
      type: t.Union([t.Literal("PRIMARY_VERIFY"), t.Literal("PRIMARY_CHANGE"), t.Literal("RECOVERY_VERIFY"), t.Literal("RECOVERY_CHANGE")]),
      email: t.Optional(t.String()),
    }),
  })
  .post("/emails/verify-code", async ({ request, body, set }) => {
    const user = getCurrentUserFromHeaders(request);
    if (!user?.id) {
      set.status = 401;
      return { success: false, message: "Authentication required" };
    }
    const result = await AccountSecurityService.verifyEmailCode(user.id, body);
    if (!result.success && "status" in result) set.status = result.status;
    return result;
  }, {
    body: t.Object({
      type: t.Union([t.Literal("PRIMARY_VERIFY"), t.Literal("PRIMARY_CHANGE"), t.Literal("RECOVERY_VERIFY"), t.Literal("RECOVERY_CHANGE")]),
      code: t.String({ minLength: 6, maxLength: 6 }),
    }),
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
