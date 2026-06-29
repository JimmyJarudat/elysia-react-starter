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
  .group("/general", (app) => app
    .group("/identity", (identity) => identity
      .get("/", async () => GeneralSettingService.getIdentity())
      .put("/", async ({ body, request }) => GeneralSettingService.updateIdentity({
        ...body,
        userId: getValidUserId(request),
      }), {
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
      }))
    .group("/organization-support", (organization) => organization
      .get("/", async () => GeneralSettingService.getOrganizationSupport())
      .put("/", async ({ body, request }) => GeneralSettingService.updateOrganizationSupport({
        ...body,
        userId: getValidUserId(request),
      }), {
        body: t.Object({
          organizationName: t.Optional(t.String()),
          organizationLogoUrl: t.Optional(t.String()),
          organizationLogo: t.Optional(t.File()),
          supportEmail: t.Optional(t.String()),
          websiteUrl: t.Optional(t.String()),
          helpCenterUrl: t.Optional(t.String()),
        }),
      }))
    .group("/registration", (registration) => registration
      .get("/status", async () => GeneralSettingService.getRegistrationApproval())
      .get("/", async () => GeneralSettingService.getRegistrationApproval())
      .put("/", async ({ body, request }) => GeneralSettingService.updateRegistrationApproval({
        ...body,
        userId: getValidUserId(request),
      }), {
        body: t.Object({
          enabled: t.Optional(t.Boolean()),
          requireApproval: t.Optional(t.Boolean()),
          defaultRole: t.Optional(t.String()),
        }),
      }))
    .group("/notification-sound", (notificationSound) => notificationSound
      .get("/", async () => GeneralSettingService.getNotificationSound())
      .put("/", async ({ body, request }) => GeneralSettingService.updateNotificationSound({
        sound: body.sound,
        userId: getValidUserId(request),
      }), {
        body: t.Object({
          sound: t.File(),
        }),
      })
      .delete("/", async ({ request }) => GeneralSettingService.deleteNotificationSound(getValidUserId(request))))
    .group("/regional", (regional) => regional
      .get("/status", async () => GeneralSettingService.getRegional())
      .get("/", async () => GeneralSettingService.getRegional())
      .put("/", async ({ body, request }) => GeneralSettingService.updateRegional({
        ...body,
        userId: getValidUserId(request),
      }), {
        body: t.Object({
          timezone: t.Optional(t.String()),
          dateFormat: t.Optional(t.String()),
          timeFormat: t.Optional(t.String()),
          yearEra: t.Optional(t.Union([t.Literal("CE"), t.Literal("BE")])),
        }),
      }))
    .group("/maintenance", (maintenance) => maintenance
      .get("/status", async () => GeneralSettingService.getMaintenance())
      .get("/", async () => GeneralSettingService.getMaintenance())
      .put("/", async ({ body, request }) => GeneralSettingService.updateMaintenance({
        ...body,
        userId: getValidUserId(request),
      }), {
        body: t.Object({
          enabled: t.Optional(t.Boolean()),
          message: t.Optional(t.String()),
        }),
      })))

  .group("/security", (app) => app
    .get("/", async () => SecuritySettingService.getSecuritySettings())
    .put("/", async ({ body, request }) => SecuritySettingService.updateSecuritySettings({
      ...body,
      userId: getValidUserId(request),
    }), {
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
    .group("/ip-blocklist", (ipBlocklist) => ipBlocklist
      .get("/", async () => SecuritySettingService.getIpBlocklist())
      .post("/", async ({ body, request }) => SecuritySettingService.addIpBlocklist(
        body.ipAddress,
        body.reason,
        getValidUserId(request),
      ), {
        body: t.Object({
          ipAddress: t.String(),
          reason: t.Optional(t.String()),
        }),
      })
      .delete("/:id", async ({ params, request }) => {
        const id = Number(params.id);
        if (!Number.isInteger(id) || id <= 0) throw new Error("Invalid ID");
        return SecuritySettingService.removeIpBlocklist(id, getValidUserId(request));
      }, {
        params: t.Object({ id: t.String() }),
      }))
    .group("/cors", (cors) => cors
      .get("/", async () => SecuritySettingService.getCorsSettings())
      .put("/", async ({ body, request }) => SecuritySettingService.updateCorsSettings(
        body.origins,
        getValidUserId(request),
      ), {
        body: t.Object({
          origins: t.Array(t.String()),
        }),
      })))

  .group("/integrations", (app) => app
    .group("/ldap", (ldap) => ldap
      .get("/", async () => IntegrationSettingService.getLdapSettings())
      .put("/", async ({ body, request }) => IntegrationSettingService.updateLdapSettings({
        ...body,
        userId: getValidUserId(request),
      }), {
        body: t.Object({
          enabled: t.Optional(t.Boolean()),
          url: t.Optional(t.String()),
          encryption: t.Optional(t.Union([t.Literal("none"), t.Literal("starttls"), t.Literal("ldaps")])),
          bindDn: t.Optional(t.String()),
          bindPassword: t.Optional(t.String()),
          baseDn: t.Optional(t.String()),
          userFilter: t.Optional(t.String()),
        }),
      })
      .post("/fetch-user", async ({ body, request }) => IntegrationSettingService.fetchLdapUser({
        ...body,
        userId: getValidUserId(request),
      }), {
        body: t.Object({
          username: t.String(),
          settings: t.Optional(t.Object({
            enabled: t.Optional(t.Boolean()),
            url: t.Optional(t.String()),
            encryption: t.Optional(t.Union([t.Literal("none"), t.Literal("starttls"), t.Literal("ldaps")])),
            bindDn: t.Optional(t.String()),
            bindPassword: t.Optional(t.String()),
            baseDn: t.Optional(t.String()),
            userFilter: t.Optional(t.String()),
          })),
        }),
      }))
    .group("/smtp", (smtp) => smtp
      .get("/", async () => IntegrationSettingService.getSmtpSettings())
      .put("/", async ({ body, request }) => IntegrationSettingService.updateSmtpSettings({
        ...body,
        userId: getValidUserId(request),
      }), {
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
      .post("/test", async ({ body }) => IntegrationSettingService.testSmtpConnection(body), {
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
      .post("/send-test", async ({ body }) => IntegrationSettingService.sendSmtpTestEmail(body.to), {
        body: t.Object({
          to: t.String(),
        }),
      }))
    .group("/redis", (redis) => redis
      .get("/", async () => IntegrationSettingService.getRedisSettings())
      .put("/", async ({ body, request }) => IntegrationSettingService.updateRedisSettings({
        ...body,
        userId: getValidUserId(request),
      }), {
        body: t.Object({
          enabled: t.Optional(t.Boolean()),
          host: t.Optional(t.String()),
          port: t.Optional(t.Number()),
          db: t.Optional(t.Number()),
          password: t.Optional(t.String()),
          prefix: t.Optional(t.String()),
        }),
      })
      .post("/test", async ({ body }) => IntegrationSettingService.testRedisConnection(body), {
        body: t.Object({
          enabled: t.Optional(t.Boolean()),
          host: t.Optional(t.String()),
          port: t.Optional(t.Number()),
          db: t.Optional(t.Number()),
          password: t.Optional(t.String()),
          prefix: t.Optional(t.String()),
        }),
      })
      .get("/status", async () => IntegrationSettingService.getRedisStatus())
      .get("/keys", async ({ query }) => IntegrationSettingService.listRedisKeys(query.group), {
        query: t.Object({
          group: t.Optional(t.String()),
        }),
      })
      .post("/key", async ({ body }) => IntegrationSettingService.getRedisKeyValue(body.key), {
        body: t.Object({
          key: t.String(),
        }),
      })
      .delete("/key", async ({ body, request }) => IntegrationSettingService.deleteRedisKey(
        body.key,
        getValidUserId(request),
      ), {
        body: t.Object({
          key: t.String(),
        }),
      })
      .post("/clear", async ({ body, request }) => IntegrationSettingService.clearRedisKeys(
        body.group,
        getValidUserId(request),
      ), {
        body: t.Object({
          group: t.Optional(t.String()),
        }),
      }))
    .group("/storage", (storage) => storage
      .get("/", async () => IntegrationSettingService.getStorageSettings())
      .put("/", async ({ body, request }) => IntegrationSettingService.updateStorageSettings({
        ...body,
        userId: getValidUserId(request),
      }), {
        body: t.Object({
          provider: t.Optional(t.Union([t.Literal("local"), t.Literal("smb"), t.Literal("sftp"), t.Literal("ftp")])),
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
          ftpHost: t.Optional(t.String()),
          ftpPort: t.Optional(t.Number()),
          ftpUsername: t.Optional(t.String()),
          ftpPassword: t.Optional(t.String()),
          ftpBasePath: t.Optional(t.String()),
          ftpSecure: t.Optional(t.Boolean()),
        }),
      })
      .post("/test", async ({ body, request }) => IntegrationSettingService.testStorageConnection({
        ...body,
        userId: getValidUserId(request),
      }), {
        body: t.Object({
          provider: t.Optional(t.Union([t.Literal("local"), t.Literal("smb"), t.Literal("sftp"), t.Literal("ftp")])),
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
          ftpHost: t.Optional(t.String()),
          ftpPort: t.Optional(t.Number()),
          ftpUsername: t.Optional(t.String()),
          ftpPassword: t.Optional(t.String()),
          ftpBasePath: t.Optional(t.String()),
          ftpSecure: t.Optional(t.Boolean()),
        }),
      })
      .group("/migration", (migration) => migration
        .get("/status", async () => IntegrationSettingService.getStorageMigrationStatus())
        .get("/scan", async ({ request }) => IntegrationSettingService.scanStorageMigration({
          userId: getValidUserId(request),
        }))
        .get("/stream", ({ query, request }) => {
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
        .post("/cleanup", async ({ body, request }) => IntegrationSettingService.cleanupStorageMigration({
          deleteSource: body.deleteSource,
          userId: getValidUserId(request),
        }), {
          body: t.Object({
            deleteSource: t.Boolean(),
          }),
        }))));
