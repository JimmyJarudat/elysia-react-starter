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

const registrationApprovalBody = t.Object({
  enabled: t.Optional(t.Boolean()),
  requireApproval: t.Optional(t.Boolean()),
  defaultRole: t.Optional(t.String()),
});

const smtpBody = t.Object({
  enabled: t.Optional(t.Boolean()),
  host: t.Optional(t.String()),
  port: t.Optional(t.Number()),
  encryption: t.Optional(t.Union([t.Literal("starttls"), t.Literal("ssl"), t.Literal("none")])),
  user: t.Optional(t.String()),
  password: t.Optional(t.String()),
  fromName: t.Optional(t.String()),
  fromEmail: t.Optional(t.String()),
  appName: t.Optional(t.String()),
  appUrl: t.Optional(t.String()),
});

const smtpTestEmailBody = t.Object({
  to: t.String(),
});

const redisBody = t.Object({
  enabled: t.Optional(t.Boolean()),
  host: t.Optional(t.String()),
  port: t.Optional(t.Number()),
  db: t.Optional(t.Number()),
  password: t.Optional(t.String()),
});

const redisKeyBody = t.Object({
  key: t.String(),
});

const redisClearBody = t.Object({
  group: t.Optional(t.String()),
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
  .get("/registration/status", async () => SystemSettingService.getRegistrationApproval())
  .get("/registration", async () => SystemSettingService.getRegistrationApproval())
  .put("/registration", async ({ body, request }) => {
    return SystemSettingService.updateRegistrationApproval({
      ...body,
      userId: getValidUserId(request),
    });
  }, { body: registrationApprovalBody })
  .get("/smtp", async () => SystemSettingService.getSmtpSettings())
  .put("/smtp", async ({ body, request }) => {
    return SystemSettingService.updateSmtpSettings({
      ...body,
      userId: getValidUserId(request),
    });
  }, { body: smtpBody })
  .post("/smtp/test", async ({ body }) => SystemSettingService.testSmtpConnection(body), {
    body: smtpBody,
  })
  .post("/smtp/send-test", async ({ body }) => SystemSettingService.sendSmtpTestEmail(body.to), {
    body: smtpTestEmailBody,
  })
  .get("/redis", async () => SystemSettingService.getRedisSettings())
  .put("/redis", async ({ body, request }) => {
    return SystemSettingService.updateRedisSettings({
      ...body,
      userId: getValidUserId(request),
    });
  }, { body: redisBody })
  .post("/redis/test", async ({ body }) => SystemSettingService.testRedisConnection(body), {
    body: redisBody,
  })
  .get("/redis/status", async () => SystemSettingService.getRedisStatus())
  .get("/redis/keys", async ({ query }) => SystemSettingService.listRedisKeys(query.group), {
    query: t.Object({
      group: t.Optional(t.String()),
    }),
  })
  .post("/redis/key", async ({ body }) => SystemSettingService.getRedisKeyValue(body.key), {
    body: redisKeyBody,
  })
  .delete("/redis/key", async ({ body }) => SystemSettingService.deleteRedisKey(body.key), {
    body: redisKeyBody,
  })
  .post("/redis/clear", async ({ body }) => SystemSettingService.clearRedisKeys(body.group), {
    body: redisClearBody,
  })

  .get("/regional/status", async () => SystemSettingService.getRegional())
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
