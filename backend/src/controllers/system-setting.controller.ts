import { Elysia, t } from "elysia";
import { SystemSettingService } from "@/services/system-setting.service";

const identityBody = t.Object({
  systemName: t.Optional(t.String()),
  systemSubtitle: t.Optional(t.String()),
  logoUrl: t.Optional(t.String()),
  faviconUrl: t.Optional(t.String()),
  logo: t.Optional(t.File()),
  favicon: t.Optional(t.File()),
});

export const systemSettingController = new Elysia({ prefix: "/system-setting" })
  .get("/identity", async () => SystemSettingService.getIdentity())
  .put("/identity", async ({ body, request }) => {
    const userIdHeader = request.headers.get("x-user-id");
    const userId = userIdHeader ? Number(userIdHeader) : undefined;
    const validUserId = typeof userId === "number" && Number.isInteger(userId) && userId > 0
      ? userId
      : undefined;

    return SystemSettingService.updateIdentity({
      ...body,
      userId: validUserId,
    });
  }, { body: identityBody });
