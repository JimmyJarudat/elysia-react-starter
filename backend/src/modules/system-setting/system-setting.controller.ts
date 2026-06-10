import { Elysia, t } from "elysia";
import { GeneralSettingService } from "@/modules/system-setting/general-setting.service";
import { IntegrationSettingService } from "@/modules/system-setting/integration-setting.service";
import { SecuritySettingService } from "@/modules/system-setting/security-setting.service";
import { getCurrentUserFromHeaders } from "@/utils/get-current-user";

const getValidUserId = (request: Request): number | undefined => {
  const id = getCurrentUserFromHeaders(request)?.id;
  return typeof id === "number" && id > 0 ? id : undefined;
};

export const systemSettingController = new Elysia({ prefix: "/system-setting" })
  .get("/identity", async () => {
    return GeneralSettingService.getIdentity();
  })
  .put("/identity", async ({ body, request }) => {
    return GeneralSettingService.updateIdentity({
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
    return GeneralSettingService.getOrganizationSupport();
  })
  .put("/organization-support", async ({ body, request }) => {
    return GeneralSettingService.updateOrganizationSupport({
      ...body,
      userId: getValidUserId(request),
    });
  }, {
    body: t.Object({
      organizationName: t.Optional(t.String()),
      organizationLogoUrl: t.Optional(t.String()),
      organizationLogo: t.Optional(t.File()),
      supportEmail: t.Optional(t.String()),
      websiteUrl: t.Optional(t.String()),
      helpCenterUrl: t.Optional(t.String()),
    }),
  })
  .get("/registration/status", async () => {
    return GeneralSettingService.getRegistrationApproval();
  })
  .get("/registration", async () => {
    return GeneralSettingService.getRegistrationApproval();
  })
  .put("/registration", async ({ body, request }) => {
    return GeneralSettingService.updateRegistrationApproval({
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
    return SecuritySettingService.getSecuritySettings();
  })
  .put("/security", async ({ body, request }) => {
    return SecuritySettingService.updateSecuritySettings({
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
    return SecuritySettingService.getIpBlocklist();
  })
  .post("/ip-blocklist", async ({ body, request }) => {
    return SecuritySettingService.addIpBlocklist(body.ipAddress, body.reason, getValidUserId(request));
  }, {
    body: t.Object({
      ipAddress: t.String(),
      reason: t.Optional(t.String()),
    }),
  })
  .delete("/ip-blocklist/:id", async ({ params, request }) => {
    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) throw new Error("Invalid ID");
    return SecuritySettingService.removeIpBlocklist(id, getValidUserId(request));
  }, {
    params: t.Object({ id: t.String() }),
  })
  .get("/cors", async () => {
    return SecuritySettingService.getCorsSettings();
  })
  .put("/cors", async ({ body, request }) => {
    return SecuritySettingService.updateCorsSettings(body.origins, getValidUserId(request));
  }, {
    body: t.Object({
      origins: t.Array(t.String()),
    }),
  })
  .get("/smtp", async () => {
    return IntegrationSettingService.getSmtpSettings();
  })
  .put("/smtp", async ({ body, request }) => {
    return IntegrationSettingService.updateSmtpSettings({
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
    return IntegrationSettingService.testSmtpConnection(body);
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
    return IntegrationSettingService.sendSmtpTestEmail(body.to);
  }, {
    body: t.Object({
      to: t.String(),
    }),
  })
  .get("/redis", async () => {
    return IntegrationSettingService.getRedisSettings();
  })
  .put("/redis", async ({ body, request }) => {
    return IntegrationSettingService.updateRedisSettings({
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
    return IntegrationSettingService.testRedisConnection(body);
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
    return IntegrationSettingService.getRedisStatus();
  })
  .get("/redis/keys", async ({ query }) => {
    return IntegrationSettingService.listRedisKeys(query.group);
  }, {
    query: t.Object({
      group: t.Optional(t.String()),
    }),
  })
  .post("/redis/key", async ({ body }) => {
    return IntegrationSettingService.getRedisKeyValue(body.key);
  }, {
    body: t.Object({
      key: t.String(),
    }),
  })
  .delete("/redis/key", async ({ body, request }) => {
    return IntegrationSettingService.deleteRedisKey(body.key, getValidUserId(request));
  }, {
    body: t.Object({
      key: t.String(),
    }),
  })
  .post("/redis/clear", async ({ body, request }) => {
    return IntegrationSettingService.clearRedisKeys(body.group, getValidUserId(request));
  }, {
    body: t.Object({
      group: t.Optional(t.String()),
    }),
  })
  .get("/storage", async () => {
    return IntegrationSettingService.getStorageSettings();
  })
  .put("/storage", async ({ body, request }) => {
    return IntegrationSettingService.updateStorageSettings({
      ...body,
      userId: getValidUserId(request),
    });
  }, {
    body: t.Object({
      provider: t.Optional(t.Union([t.Literal("local"), t.Literal("smb"), t.Literal("sftp")])),
      smbHost: t.Optional(t.String()),
      smbShareName: t.Optional(t.String()),
      smbDomain: t.Optional(t.String()),
      smbUsername: t.Optional(t.String()),
      smbPassword: t.Optional(t.String()),
      smbBasePath: t.Optional(t.String()),
      sftpHost: t.Optional(t.String()),
      sftpPort: t.Optional(t.Number()),
      sftpUsername: t.Optional(t.String()),
      sftpPassword: t.Optional(t.String()),
      sftpBasePath: t.Optional(t.String()),
    }),
  })
  .post("/storage/test", async ({ body, request }) => {
    return IntegrationSettingService.testStorageConnection({
      ...body,
      userId: getValidUserId(request),
    });
  }, {
    body: t.Object({
      provider: t.Optional(t.Union([t.Literal("local"), t.Literal("smb"), t.Literal("sftp")])),
      smbHost: t.Optional(t.String()),
      smbShareName: t.Optional(t.String()),
      smbDomain: t.Optional(t.String()),
      smbUsername: t.Optional(t.String()),
      smbPassword: t.Optional(t.String()),
      smbBasePath: t.Optional(t.String()),
      sftpHost: t.Optional(t.String()),
      sftpPort: t.Optional(t.Number()),
      sftpUsername: t.Optional(t.String()),
      sftpPassword: t.Optional(t.String()),
      sftpBasePath: t.Optional(t.String()),
    }),
  })
  .get("/storage/migration/status", async () => {
    return IntegrationSettingService.getStorageMigrationStatus();
  })
  .get("/storage/migration/scan", async ({ request }) => {
    return IntegrationSettingService.scanStorageMigration({ userId: getValidUserId(request) });
  })
  .get("/storage/migration/stream", ({ query, request }) => {
    const userId = getValidUserId(request);
    const conflictPolicy = ["skip", "overwrite", "fail"].includes(query.conflictPolicy ?? "")
      ? query.conflictPolicy as "skip" | "overwrite" | "fail"
      : "skip";
    const encoder = new TextEncoder();
    const sseMessage = (event: string, data: unknown) =>
      encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

    let heartbeatTimer: ReturnType<typeof setInterval>;

    const stream = new ReadableStream({
      start(ctrl) {
        const close = () => {
          clearInterval(heartbeatTimer);
          try { ctrl.close(); } catch { /* already closed */ }
        };
        const send = (event: string, data: unknown) => {
          try {
            ctrl.enqueue(sseMessage(event, data));
          } catch {
            close();
          }
        };

        heartbeatTimer = setInterval(() => send("heartbeat", { t: Date.now() }), 25000);
        request.signal.addEventListener("abort", close);

        void IntegrationSettingService.runStorageMigration({ userId, conflictPolicy, send, signal: request.signal }).finally(close);
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  }, {
    query: t.Object({
      conflictPolicy: t.Optional(t.Union([t.Literal("skip"), t.Literal("overwrite"), t.Literal("fail")])),
    }),
  })
  .post("/storage/migration/cleanup", async ({ body, request }) => {
    return IntegrationSettingService.cleanupStorageMigration({
      deleteSource: body.deleteSource,
      userId: getValidUserId(request),
    });
  }, {
    body: t.Object({
      deleteSource: t.Boolean(),
    }),
  })

  .get("/notification-sound", async () => {
    return GeneralSettingService.getNotificationSound();
  })
  .put("/notification-sound", async ({ body, request }) => {
    return GeneralSettingService.updateNotificationSound({
      sound: body.sound,
      userId: getValidUserId(request),
    });
  }, {
    body: t.Object({
      sound: t.File(),
    }),
  })
  .delete("/notification-sound", async ({ request }) => {
    return GeneralSettingService.deleteNotificationSound(getValidUserId(request));
  })

  .get("/regional/status", async () => {
    return GeneralSettingService.getRegional();
  })
  .get("/regional", async () => {
    return GeneralSettingService.getRegional();
  })
  .put("/regional", async ({ body, request }) => {
    return GeneralSettingService.updateRegional({ ...body, userId: getValidUserId(request) });
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
    return GeneralSettingService.getMaintenance();
  })
  .get("/maintenance", async () => {
    return GeneralSettingService.getMaintenance();
  })
  .put("/maintenance", async ({ body, request }) => {
    return GeneralSettingService.updateMaintenance({ ...body, userId: getValidUserId(request) });
  }, {
    body: t.Object({
      enabled: t.Optional(t.Boolean()),
      message: t.Optional(t.String()),
    }),
  });
