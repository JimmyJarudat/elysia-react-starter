import { Elysia, t } from "elysia";
import { SystemSettingService } from "@/services/system-setting.service";

const identityBody = t.Object({
  systemName: t.Optional(t.String()),
  systemSubtitle: t.Optional(t.String()),
  appTitle: t.Optional(t.String()),
  titleMode: t.Optional(t.Union([t.Literal("title_only"), t.Literal("title_section")])),
  logoUrl: t.Optional(t.String()),
  faviconUrl: t.Optional(t.String()),
  logo: t.Optional(t.File()),
  favicon: t.Optional(t.File()),
});

const organizationSupportBody = t.Object({
  organizationName: t.Optional(t.String()),
  supportEmail: t.Optional(t.String()),
  websiteUrl: t.Optional(t.String()),
  helpCenterUrl: t.Optional(t.String()),
});

const getValidUserId = (request: Request) => {
  const userIdHeader = request.headers.get("x-user-id");
  const userId = userIdHeader ? Number(userIdHeader) : undefined;

  return typeof userId === "number" && Number.isInteger(userId) && userId > 0
    ? userId
    : undefined;
};

export const systemSettingController = new Elysia({ prefix: "/system-setting" })
  .get("/identity", async () => SystemSettingService.getIdentity())
  .put("/identity", async ({ body, request }) => {
    return SystemSettingService.updateIdentity({
      ...body,
      userId: getValidUserId(request),
    });
  }, { body: identityBody })
  .get("/organization-support", async () => SystemSettingService.getOrganizationSupport())
  .put("/organization-support", async ({ body, request }) => {
    return SystemSettingService.updateOrganizationSupport({
      ...body,
      userId: getValidUserId(request),
    });
  }, { body: organizationSupportBody })

  .get("/regional", async () => SystemSettingService.getRegional())
  .put("/regional", async ({ body, request }) =>
    SystemSettingService.updateRegional({ ...body, userId: getValidUserId(request) }), {
    body: t.Object({
      timezone:   t.Optional(t.String()),
      dateFormat: t.Optional(t.String()),
      timeFormat: t.Optional(t.String()),
      yearEra:    t.Optional(t.Union([t.Literal("CE"), t.Literal("BE")])),
    }),
  })

  // maintenance/status เป็น public — ทุก user เช็คได้โดยไม่ต้อง login
  .get("/maintenance/status", async () => SystemSettingService.getMaintenance())
  .get("/maintenance", async () => SystemSettingService.getMaintenance())
  .put("/maintenance", async ({ body, request }) =>
    SystemSettingService.updateMaintenance({ ...body, userId: getValidUserId(request) }), {
    body: t.Object({
      enabled: t.Optional(t.Boolean()),
      message: t.Optional(t.String()),
    }),
  });
