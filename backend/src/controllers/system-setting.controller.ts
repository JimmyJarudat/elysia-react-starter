import { Elysia, t } from "elysia";
import { SystemSettingService } from "@/services/system-setting.service";

const getValidUserId = (request: Request) => {
  const userIdHeader = request.headers.get("x-user-id");
  const userId = userIdHeader ? Number(userIdHeader) : undefined;

  return typeof userId === "number" && Number.isInteger(userId) && userId > 0
    ? userId
    : undefined;
};

export const systemSettingController = new Elysia({ prefix: "/system-setting" })
  .get("/identity", async () => {
    return SystemSettingService.getIdentity();
  })
  .put("/identity", async ({ body, request }) => {
    return SystemSettingService.updateIdentity({
      ...body,
      userId: getValidUserId(request),
    });
  }, {
    body: t.Object({
      systemName: t.Optional(t.String()),
      systemSubtitle: t.Optional(t.String()),
      appTitle: t.Optional(t.String()),
      titleMode: t.Optional(t.Union([t.Literal("title_only"), t.Literal("title_section")])),
      logoUrl: t.Optional(t.String()),
      faviconUrl: t.Optional(t.String()),
      logo: t.Optional(t.File()),
      favicon: t.Optional(t.File()),
    }),
  })
  .get("/organization-support", async () => {
    return SystemSettingService.getOrganizationSupport();
  })
  .put("/organization-support", async ({ body, request }) => {
    return SystemSettingService.updateOrganizationSupport({
      ...body,
      userId: getValidUserId(request),
    });
  }, {
    body: t.Object({
      organizationName: t.Optional(t.String()),
      supportEmail: t.Optional(t.String()),
      websiteUrl: t.Optional(t.String()),
      helpCenterUrl: t.Optional(t.String()),
    }),
  })
  .get("/registration/status", async () => {
    return SystemSettingService.getRegistrationApproval();
  })
  .get("/registration", async () => {
    return SystemSettingService.getRegistrationApproval();
  })
  .put("/registration", async ({ body, request }) => {
    return SystemSettingService.updateRegistrationApproval({
      ...body,
      userId: getValidUserId(request),
    });
  }, {
    body: t.Object({
      enabled: t.Optional(t.Boolean()),
      requireApproval: t.Optional(t.Boolean()),
      defaultRole: t.Optional(t.String()),
    }),
  })
  .get("/security", async () => {
    return SystemSettingService.getSecuritySettings();
  })
  .put("/security", async ({ body, request }) => {
    return SystemSettingService.updateSecuritySettings({
      ...body,
      userId: getValidUserId(request),
    });
  }, {
    body: t.Object({
      accessTokenExpiryMinutes: t.Optional(t.Number()),
      refreshTokenExpiryMinutes: t.Optional(t.Number()),
      sessionExpiryMinutes: t.Optional(t.Number()),
      maxActiveSessions: t.Optional(t.Number()),
      maxLoginAttempts: t.Optional(t.Number()),
      accountLockMinutes: t.Optional(t.Number()),
      passwordExpiryDays: t.Optional(t.Number()),
      passwordMinLength: t.Optional(t.Number()),
      passwordRequireLowercase: t.Optional(t.Boolean()),
      passwordRequireUppercase: t.Optional(t.Boolean()),
      passwordRequireNumber: t.Optional(t.Boolean()),
      passwordRequireSpecial: t.Optional(t.Boolean()),
      passwordResetExpiryMinutes: t.Optional(t.Number()),
      jwtSecret: t.Optional(t.String()),
      jwtJit: t.Optional(t.String()),
      jwtIssuer: t.Optional(t.String()),
      jwtAudience: t.Optional(t.String()),
      idleTimeoutMinutes: t.Optional(t.Number()),
      accountInactivityDays: t.Optional(t.Number()),
      passwordHistoryCount: t.Optional(t.Number()),
      forceSingleSession: t.Optional(t.Boolean()),
    }),
  })
  .get("/ip-blocklist", async () => {
    return SystemSettingService.getIpBlocklist();
  })
  .post("/ip-blocklist", async ({ body }) => {
    return SystemSettingService.addIpBlocklist(body.ipAddress, body.reason);
  }, {
    body: t.Object({
      ipAddress: t.String(),
      reason: t.Optional(t.String()),
    }),
  })
  .delete("/ip-blocklist/:id", async ({ params }) => {
    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) throw new Error("Invalid ID");
    return SystemSettingService.removeIpBlocklist(id);
  }, {
    params: t.Object({ id: t.String() }),
  })
  .get("/cors", async () => {
    return SystemSettingService.getCorsSettings();
  })
  .put("/cors", async ({ body, request }) => {
    return SystemSettingService.updateCorsSettings(body.origins, getValidUserId(request));
  }, {
    body: t.Object({
      origins: t.Array(t.String()),
    }),
  })
  .get("/smtp", async () => {
    return SystemSettingService.getSmtpSettings();
  })
  .put("/smtp", async ({ body, request }) => {
    return SystemSettingService.updateSmtpSettings({
      ...body,
      userId: getValidUserId(request),
    });
  }, {
    body: t.Object({
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
    }),
  })
  .post("/smtp/test", async ({ body }) => {
    return SystemSettingService.testSmtpConnection(body);
  }, {
    body: t.Object({
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
    }),
  })
  .post("/smtp/send-test", async ({ body }) => {
    return SystemSettingService.sendSmtpTestEmail(body.to);
  }, {
    body: t.Object({
      to: t.String(),
    }),
  })
  .get("/redis", async () => {
    return SystemSettingService.getRedisSettings();
  })
  .put("/redis", async ({ body, request }) => {
    return SystemSettingService.updateRedisSettings({
      ...body,
      userId: getValidUserId(request),
    });
  }, {
    body: t.Object({
      enabled: t.Optional(t.Boolean()),
      host: t.Optional(t.String()),
      port: t.Optional(t.Number()),
      db: t.Optional(t.Number()),
      password: t.Optional(t.String()),
      prefix: t.Optional(t.String()),
    }),
  })
  .post("/redis/test", async ({ body }) => {
    return SystemSettingService.testRedisConnection(body);
  }, {
    body: t.Object({
      enabled: t.Optional(t.Boolean()),
      host: t.Optional(t.String()),
      port: t.Optional(t.Number()),
      db: t.Optional(t.Number()),
      password: t.Optional(t.String()),
      prefix: t.Optional(t.String()),
    }),
  })
  .get("/redis/status", async () => {
    return SystemSettingService.getRedisStatus();
  })
  .get("/redis/keys", async ({ query }) => {
    return SystemSettingService.listRedisKeys(query.group);
  }, {
    query: t.Object({
      group: t.Optional(t.String()),
    }),
  })
  .post("/redis/key", async ({ body }) => {
    return SystemSettingService.getRedisKeyValue(body.key);
  }, {
    body: t.Object({
      key: t.String(),
    }),
  })
  .delete("/redis/key", async ({ body }) => {
    return SystemSettingService.deleteRedisKey(body.key);
  }, {
    body: t.Object({
      key: t.String(),
    }),
  })
  .post("/redis/clear", async ({ body }) => {
    return SystemSettingService.clearRedisKeys(body.group);
  }, {
    body: t.Object({
      group: t.Optional(t.String()),
    }),
  })

  .get("/notification-sound", async () => {
    return SystemSettingService.getNotificationSound();
  })
  .put("/notification-sound", async ({ body, request }) => {
    return SystemSettingService.updateNotificationSound({
      sound: body.sound,
      userId: getValidUserId(request),
    });
  }, {
    body: t.Object({
      sound: t.File(),
    }),
  })
  .delete("/notification-sound", async ({ request }) => {
    return SystemSettingService.deleteNotificationSound(getValidUserId(request));
  })

  .get("/regional/status", async () => {
    return SystemSettingService.getRegional();
  })
  .get("/regional", async () => {
    return SystemSettingService.getRegional();
  })
  .put("/regional", async ({ body, request }) => {
    return SystemSettingService.updateRegional({ ...body, userId: getValidUserId(request) });
  }, {
    body: t.Object({
      timezone:   t.Optional(t.String()),
      dateFormat: t.Optional(t.String()),
      timeFormat: t.Optional(t.String()),
      yearEra:    t.Optional(t.Union([t.Literal("CE"), t.Literal("BE")])),
    }),
  })

  // maintenance/status เป็น public — ทุก user เช็คได้โดยไม่ต้อง login
  .get("/maintenance/status", async () => {
    return SystemSettingService.getMaintenance();
  })
  .get("/maintenance", async () => {
    return SystemSettingService.getMaintenance();
  })
  .put("/maintenance", async ({ body, request }) => {
    return SystemSettingService.updateMaintenance({ ...body, userId: getValidUserId(request) });
  }, {
    body: t.Object({
      enabled: t.Optional(t.Boolean()),
      message: t.Optional(t.String()),
    }),
  });
