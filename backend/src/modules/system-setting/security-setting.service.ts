import prisma from "@/config/prisma.config";
import { getRedisClient } from "@/config/redis.config";
import { clearCorsCache, CORS_CONFIG_KEY } from "@/config/cors.config";
import { encryptText } from "@/utils/encryption";
import {
  getSettingValue as getBooleanConfigValue,
  getSecretSettingValue as getSecretConfigValue,
  getSettingValue as getConfigValue,
  upsertSettingValue as upsertConfig,
} from "@/utils/get-setting-value";
import { ActivityLogUtil } from "@/utils/activity-log";
import { AuditLogUtil } from "@/utils/audit-log";
import { NotificationService } from "@/modules/notifications/notification.service";

export class SecuritySettingService {
  static async getSecuritySettings() {
    const defaults = {
      accessTokenExpiryMinutes: 60,
      refreshTokenExpiryMinutes: 10080,
      sessionExpiryMinutes: 2880,
      maxActiveSessions: 2,
      maxLoginAttempts: 5,
      accountLockMinutes: 5,
      passwordExpiryDays: 90,
      passwordMinLength: 8,
      passwordRequireLowercase: true,
      passwordRequireUppercase: true,
      passwordRequireNumber: true,
      passwordRequireSpecial: true,
      passwordResetExpiryMinutes: 60,
      jwtSecret: "",
      jwtJit: "",
      jwtIssuer: "genesenn-it-utils",
      jwtAudience: "genesenn-it-utils-users",
      idleTimeoutMinutes: 0,
      accountInactivityDays: 0,
      passwordHistoryCount: 0,
      forceSingleSession: false,
    };

    const [
      accessTokenExpiryMinutes,
      refreshTokenExpiryMinutes,
      sessionExpiryMinutes,
      maxActiveSessions,
      maxLoginAttempts,
      accountLockMinutes,
      passwordExpiryDays,
      passwordMinLength,
      passwordRequireLowercase,
      passwordRequireUppercase,
      passwordRequireNumber,
      passwordRequireSpecial,
      passwordResetExpiryMinutes,
      jwtSecret,
      jwtJit,
      jwtIssuer,
      jwtAudience,
      idleTimeoutMinutes,
      accountInactivityDays,
      passwordHistoryCount,
      forceSingleSession,
    ] = await Promise.all([
      getConfigValue("access_token_expiry_minutes", defaults.accessTokenExpiryMinutes),
      getConfigValue("refresh_token_expiry_minutes", defaults.refreshTokenExpiryMinutes),
      getConfigValue("session_expiry_minutes", defaults.sessionExpiryMinutes),
      getConfigValue("max_active_sessions", defaults.maxActiveSessions),
      getConfigValue("max_login_attempts", defaults.maxLoginAttempts),
      getConfigValue("account_lock_minutes", defaults.accountLockMinutes),
      getConfigValue("password_expiry_days", defaults.passwordExpiryDays),
      getConfigValue("password_min_length", defaults.passwordMinLength),
      getBooleanConfigValue("password_require_lowercase", defaults.passwordRequireLowercase),
      getBooleanConfigValue("password_require_uppercase", defaults.passwordRequireUppercase),
      getBooleanConfigValue("password_require_number", defaults.passwordRequireNumber),
      getBooleanConfigValue("password_require_special", defaults.passwordRequireSpecial),
      getConfigValue("password_reset_expiry_minutes", defaults.passwordResetExpiryMinutes),
      getSecretConfigValue("jwt_secret"),
      getConfigValue("jwt_jit", defaults.jwtJit),
      getConfigValue("jwt_issuer", defaults.jwtIssuer),
      getConfigValue("jwt_audience", defaults.jwtAudience),
      getConfigValue("idle_timeout_minutes", defaults.idleTimeoutMinutes),
      getConfigValue("account_inactivity_days", defaults.accountInactivityDays),
      getConfigValue("password_history_count", defaults.passwordHistoryCount),
      getBooleanConfigValue("force_single_session", defaults.forceSingleSession),
    ]);

    const toPositiveNumber = (value: unknown, fallback: number) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
    };

    const toNonNegativeNumber = (value: unknown, fallback: number) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
    };

    return {
      success: true,
      data: {
        accessTokenExpiryMinutes: toPositiveNumber(accessTokenExpiryMinutes, defaults.accessTokenExpiryMinutes),
        refreshTokenExpiryMinutes: toPositiveNumber(refreshTokenExpiryMinutes, defaults.refreshTokenExpiryMinutes),
        sessionExpiryMinutes: toPositiveNumber(sessionExpiryMinutes, defaults.sessionExpiryMinutes),
        maxActiveSessions: toPositiveNumber(maxActiveSessions, defaults.maxActiveSessions),
        maxLoginAttempts: toPositiveNumber(maxLoginAttempts, defaults.maxLoginAttempts),
        accountLockMinutes: toPositiveNumber(accountLockMinutes, defaults.accountLockMinutes),
        passwordExpiryDays: toPositiveNumber(passwordExpiryDays, defaults.passwordExpiryDays),
        passwordMinLength: toPositiveNumber(passwordMinLength, defaults.passwordMinLength),
        passwordRequireLowercase,
        passwordRequireUppercase,
        passwordRequireNumber,
        passwordRequireSpecial,
        passwordResetExpiryMinutes: toPositiveNumber(passwordResetExpiryMinutes, defaults.passwordResetExpiryMinutes),
        jwtJit: String(jwtJit || ""),
        jwtIssuer: String(jwtIssuer || defaults.jwtIssuer),
        jwtAudience: String(jwtAudience || defaults.jwtAudience),
        hasJwtSecret: Boolean(jwtSecret),
        idleTimeoutMinutes: toNonNegativeNumber(idleTimeoutMinutes, defaults.idleTimeoutMinutes),
        accountInactivityDays: toNonNegativeNumber(accountInactivityDays, defaults.accountInactivityDays),
        passwordHistoryCount: toNonNegativeNumber(passwordHistoryCount, defaults.passwordHistoryCount),
        forceSingleSession,
      },
    };
  }

  static async updateSecuritySettings(input: {
    accessTokenExpiryMinutes?: number;
    refreshTokenExpiryMinutes?: number;
    sessionExpiryMinutes?: number;
    maxActiveSessions?: number;
    maxLoginAttempts?: number;
    accountLockMinutes?: number;
    passwordExpiryDays?: number;
    passwordMinLength?: number;
    passwordRequireLowercase?: boolean;
    passwordRequireUppercase?: boolean;
    passwordRequireNumber?: boolean;
    passwordRequireSpecial?: boolean;
    passwordResetExpiryMinutes?: number;
    jwtSecret?: string;
    jwtJit?: string;
    jwtIssuer?: string;
    jwtAudience?: string;
    idleTimeoutMinutes?: number;
    accountInactivityDays?: number;
    passwordHistoryCount?: number;
    forceSingleSession?: boolean;
    userId?: number;
  }) {
    const current = (await this.getSecuritySettings()).data;
    const positive = (value: number | undefined, fallback: number) => {
      const parsed = Number(value ?? fallback);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
    };
    const nonNegative = (value: number | undefined, fallback: number) => {
      const parsed = Number(value ?? fallback);
      return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
    };

    const next = {
      accessTokenExpiryMinutes: positive(input.accessTokenExpiryMinutes, current.accessTokenExpiryMinutes),
      refreshTokenExpiryMinutes: positive(input.refreshTokenExpiryMinutes, current.refreshTokenExpiryMinutes),
      sessionExpiryMinutes: positive(input.sessionExpiryMinutes, current.sessionExpiryMinutes),
      maxActiveSessions: positive(input.maxActiveSessions, current.maxActiveSessions),
      maxLoginAttempts: positive(input.maxLoginAttempts, current.maxLoginAttempts),
      accountLockMinutes: positive(input.accountLockMinutes, current.accountLockMinutes),
      passwordExpiryDays: positive(input.passwordExpiryDays, current.passwordExpiryDays),
      passwordMinLength: positive(input.passwordMinLength, current.passwordMinLength),
      passwordRequireLowercase: input.passwordRequireLowercase ?? current.passwordRequireLowercase,
      passwordRequireUppercase: input.passwordRequireUppercase ?? current.passwordRequireUppercase,
      passwordRequireNumber: input.passwordRequireNumber ?? current.passwordRequireNumber,
      passwordRequireSpecial: input.passwordRequireSpecial ?? current.passwordRequireSpecial,
      passwordResetExpiryMinutes: positive(input.passwordResetExpiryMinutes, current.passwordResetExpiryMinutes),
      jwtJit: input.jwtJit?.trim() ?? current.jwtJit,
      jwtIssuer: input.jwtIssuer?.trim() || current.jwtIssuer,
      jwtAudience: input.jwtAudience?.trim() || current.jwtAudience,
      hasJwtSecret: current.hasJwtSecret || Boolean(input.jwtSecret?.trim()),
      idleTimeoutMinutes: nonNegative(input.idleTimeoutMinutes, current.idleTimeoutMinutes),
      accountInactivityDays: nonNegative(input.accountInactivityDays, current.accountInactivityDays),
      passwordHistoryCount: nonNegative(input.passwordHistoryCount, current.passwordHistoryCount),
      forceSingleSession: input.forceSingleSession ?? current.forceSingleSession,
    };

    const updates = [
      upsertConfig("access_token_expiry_minutes", String(next.accessTokenExpiryMinutes), "Access Token Expiry Minutes", "Access token lifetime in minutes", "AUTH", "NUMBER", false, input.userId),
      upsertConfig("refresh_token_expiry_minutes", String(next.refreshTokenExpiryMinutes), "Refresh Token Expiry Minutes", "Refresh token lifetime in minutes", "AUTH", "NUMBER", false, input.userId),
      upsertConfig("session_expiry_minutes", String(next.sessionExpiryMinutes), "Session Expiry Minutes", "Session lifetime in minutes", "AUTH", "NUMBER", false, input.userId),
      upsertConfig("max_active_sessions", String(next.maxActiveSessions), "Max Active Sessions", "Maximum active sessions per user", "AUTH", "NUMBER", false, input.userId),
      upsertConfig("max_login_attempts", String(next.maxLoginAttempts), "Max Login Attempts", "Maximum failed login attempts before account lock", "AUTH", "NUMBER", false, input.userId),
      upsertConfig("account_lock_minutes", String(next.accountLockMinutes), "Account Lock Minutes", "Minutes to lock an account after too many failed login attempts", "AUTH", "NUMBER", false, input.userId),
      upsertConfig("password_expiry_days", String(next.passwordExpiryDays), "Password Expiry Days", "Password expiry period in days", "AUTH", "NUMBER", false, input.userId),
      upsertConfig("password_min_length", String(next.passwordMinLength), "Password Minimum Length", "Minimum password length", "PASSWORD", "NUMBER", false, input.userId),
      upsertConfig("password_require_lowercase", String(next.passwordRequireLowercase), "Require Lowercase Letter", "Require at least one lowercase letter in passwords", "PASSWORD", "BOOLEAN", false, input.userId),
      upsertConfig("password_require_uppercase", String(next.passwordRequireUppercase), "Require Uppercase Letter", "Require at least one uppercase letter in passwords", "PASSWORD", "BOOLEAN", false, input.userId),
      upsertConfig("password_require_number", String(next.passwordRequireNumber), "Require Number", "Require at least one number in passwords", "PASSWORD", "BOOLEAN", false, input.userId),
      upsertConfig("password_require_special", String(next.passwordRequireSpecial), "Require Special Character", "Require at least one special character in passwords", "PASSWORD", "BOOLEAN", false, input.userId),
      upsertConfig("password_reset_expiry_minutes", String(next.passwordResetExpiryMinutes), "Password Reset Expiry Minutes", "Minutes before password reset link expires", "ACCESS", "NUMBER", false, input.userId),
      upsertConfig("jwt_jit", next.jwtJit, "JWT JTI Override", "Optional JWT ID override. Leave empty to generate a unique token ID.", "AUTH", "STRING", false, input.userId),
      upsertConfig("jwt_issuer", next.jwtIssuer, "JWT Issuer", "JWT issuer claim", "AUTH", "STRING", false, input.userId),
      upsertConfig("jwt_audience", next.jwtAudience, "JWT Audience", "JWT audience claim", "AUTH", "STRING", false, input.userId),
      upsertConfig("idle_timeout_minutes", String(next.idleTimeoutMinutes), "Idle Timeout Minutes", "Auto logout after inactivity. 0 = disabled.", "AUTH", "NUMBER", false, input.userId),
      upsertConfig("account_inactivity_days", String(next.accountInactivityDays), "Account Inactivity Days", "Disable account if no login for X days. 0 = disabled.", "AUTH", "NUMBER", false, input.userId),
      upsertConfig("password_history_count", String(next.passwordHistoryCount), "Password History Count", "Prevent reuse of last N passwords. 0 = disabled.", "PASSWORD", "NUMBER", false, input.userId),
      upsertConfig("force_single_session", String(next.forceSingleSession), "Force Single Session", "Log out all other sessions when a new login occurs.", "AUTH", "BOOLEAN", false, input.userId),
    ];

    if (input.jwtSecret?.trim()) {
      updates.push(
        upsertConfig("jwt_secret", encryptText(input.jwtSecret.trim()), "JWT Secret", "JWT signing secret. Changing this invalidates existing tokens.", "AUTH", "STRING", true, input.userId),
      );
    }

    await Promise.all(updates);

    ActivityLogUtil.log({ userId: input.userId, action: 'UPDATE', resourceType: 'system_config', description: 'Updated security settings', metadata: { category: 'AUTH' } });
    AuditLogUtil.log({ userId: input.userId, action: 'UPDATE', tableName: 'system_config', recordId: 'security_settings', beforeData: current, afterData: next });
    void NotificationService.notifyAdminsSecuritySettingsChanged({ actorId: input.userId, jwtSecretChanged: Boolean(input.jwtSecret?.trim()) });
    return { success: true, data: next };
  }

  // ─── IP Blocklist ─────────────────────────────────────────────────────────────

  static readonly IP_BLOCKLIST_CACHE_KEY = "security:ip_blocklist";

  private static async clearIpBlocklistCache() {
    const redis = getRedisClient();
    if (redis) {
      try { await redis.del(this.IP_BLOCKLIST_CACHE_KEY); } catch { /* non-critical */ }
    }
  }

  static async getIpBlocklist() {
    const rows = await prisma.ip_blocklist.findMany({
      orderBy: { created_at: "desc" },
    });
    return {
      success: true,
      data: rows.map((r) => ({
        id: r.id,
        ipAddress: r.ip_address,
        reason: r.reason ?? "",
        createdAt: r.created_at,
      })),
    };
  }

  static async addIpBlocklist(ipAddress: string, reason?: string, actorId?: number) {
    const ip = ipAddress.trim();
    if (!ip) throw new Error("IP address is required");

    const ipv4 = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6 = /^[0-9a-fA-F:]+$/;
    if (!ipv4.test(ip) && !ipv6.test(ip)) {
      throw new Error("Invalid IP address format");
    }

    const existing = await prisma.ip_blocklist.findUnique({ where: { ip_address: ip } });
    if (existing) throw new Error(`IP ${ip} is already in the blocklist`);

    const row = await prisma.ip_blocklist.create({
      data: { ip_address: ip, reason: reason?.trim() || null },
    });
    await this.clearIpBlocklistCache();
    ActivityLogUtil.log({ userId: actorId, action: 'CREATE', resourceType: 'ip_blocklist', resourceId: row.id, description: `Blocked IP ${ip}`, metadata: { reason } });
    AuditLogUtil.log({ userId: actorId, action: 'CREATE', tableName: 'ip_blocklist', recordId: row.id, afterData: row });
    void NotificationService.notifyAdminsIpBlocklistChanged({ action: 'add', ipAddress: ip, actorId });
    return { success: true, data: { id: row.id, ipAddress: row.ip_address, reason: row.reason ?? "", createdAt: row.created_at } };
  }

  static async removeIpBlocklist(id: number, actorId?: number) {
    const row = await prisma.ip_blocklist.findUnique({ where: { id } });
    if (!row) throw new Error("IP blocklist entry not found");

    await prisma.ip_blocklist.delete({ where: { id } });
    await this.clearIpBlocklistCache();
    ActivityLogUtil.log({ userId: actorId, action: 'DELETE', resourceType: 'ip_blocklist', resourceId: id, description: `Unblocked IP ${row.ip_address}` });
    AuditLogUtil.log({ userId: actorId, action: 'DELETE', tableName: 'ip_blocklist', recordId: id, beforeData: row });
    void NotificationService.notifyAdminsIpBlocklistChanged({ action: 'remove', ipAddress: row.ip_address, actorId });
    return { success: true };
  }

  // ─── CORS Origins ────────────────────────────────────────────────────────────

  static async getCorsSettings() {
    const config = await prisma.system_config.findUnique({
      where: { id: CORS_CONFIG_KEY },
      select: { value: true },
    });

    const raw = config?.value ?? "";
    const origins = raw.split(",").map((s) => s.trim()).filter(Boolean);
    return { success: true, data: { origins } };
  }

  static async updateCorsSettings(origins: string[], userId?: number) {
    const current = (await this.getCorsSettings()).data;
    const validated = origins
      .map((o) => o.trim())
      .filter((o) => {
        try { new URL(o); return true; } catch { return false; }
      });

    const value = validated.join(",");

    await upsertConfig(
      CORS_CONFIG_KEY,
      value,
      "CORS Allowed Origins",
      "Comma-separated list of allowed frontend origins for CORS",
      "CORS",
      "STRING",
      false,
      userId,
    );

    await clearCorsCache();
    const next = { origins: validated };
    ActivityLogUtil.log({ userId, action: 'UPDATE', resourceType: 'system_config', description: 'Updated CORS allowed origins', metadata: { category: 'CORS' } });
    AuditLogUtil.log({ userId, action: 'UPDATE', tableName: 'system_config', recordId: CORS_CONFIG_KEY, beforeData: current, afterData: next });
    void NotificationService.notifyAdminsCorsSettingsChanged({ actorId: userId, origins: validated });
    return { success: true, data: next };
  }
}
