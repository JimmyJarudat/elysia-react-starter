import { mkdir, unlink } from "node:fs/promises";
import { extname, isAbsolute, join, relative } from "node:path";
import prisma from "@/config/prisma.config";
import nodemailer from "nodemailer";
import { EmailManager, reloadSmtp } from "@/config/smtp.config";
import Redis from "ioredis";
import { clearAllCache, deleteCacheKeys, getRedisClient, pingRedis, REDIS_KEY_PREFIX, reloadRedis, stripRedisKeyPrefix } from "@/config/redis.config";
import { encryptText } from "@/utils/encryption";
import {
  getSettingValue as getBooleanConfigValue,
  getSecretSettingValue as getSecretConfigValue,
  getSettingValue as getConfigValue,
  upsertSettingValue as upsertConfig,
} from "@/utils/get-setting-value";
import { clearCorsCache, CORS_CONFIG_KEY } from "@/config/cors.config";
import { ActivityLogUtil } from "@/utils/activity-log";
import { AuditLogUtil } from "@/utils/audit-log";
import { SystemEventUtil } from "@/utils/system-event";
import { ErrorLogUtil } from "@/utils/error-log";
import { NotificationService } from "@/modules/notifications/notification.service";

export class SystemSettingService {
  static async getIdentity() {
    const defaults = {
      systemName: "IT Utils",
      systemSubtitle: "Internal tools and admin workspace",
      appTitle: "IT Utils",
      titleMode: "title_only" as const,
      logoUrl: "",
      faviconUrl: "",
      organizationName: "",
      organizationLogoUrl: "",
    };

    const [
      systemName,
      systemSubtitle,
      appTitle,
      rawTitleMode,
      logoUrl,
      faviconUrl,
      organizationName,
      organizationLogoUrl,
    ] = await Promise.all([
      getConfigValue("system_name", defaults.systemName),
      getConfigValue("system_subtitle", defaults.systemSubtitle),
      getConfigValue("app_title", defaults.appTitle),
      getConfigValue("app_title_mode", defaults.titleMode),
      getConfigValue("system_logo_url", defaults.logoUrl),
      getConfigValue("system_favicon_url", defaults.faviconUrl),
      getConfigValue("organization_name", defaults.organizationName),
      getConfigValue("organization_logo_url", defaults.organizationLogoUrl),
    ]);
    const titleMode = ["title_only", "title_section"].includes(rawTitleMode)
      ? rawTitleMode as "title_only" | "title_section"
      : defaults.titleMode;

    return {
      success: true,
      data: {
        systemName,
        systemSubtitle,
        appTitle,
        titleMode,
        logoUrl,
        faviconUrl,
        organizationName,
        organizationLogoUrl,
      },
    };
  }

  static async updateIdentity(input: {
    systemName?: string;
    systemSubtitle?: string;
    appTitle?: string;
    titleMode?: "title_only" | "title_section";
    logoUrl?: string;
    faviconUrl?: string;
    logo?: File;
    favicon?: File;
    userId?: number;
  }) {
    const uploadRoot = join(process.cwd(), "uploads");
    const systemUploadDir = join(uploadRoot, "system");

    const saveUpload = async (file: File, prefix: "logo" | "favicon") => {
      const imageExtensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".ico", ".svg"]);
      const imageMimeTypes = new Set([
        "image/png",
        "image/jpeg",
        "image/webp",
        "image/gif",
        "image/x-icon",
        "image/vnd.microsoft.icon",
        "image/svg+xml",
      ]);
      const originalName = file.name || `${prefix}.png`;
      const ext = extname(originalName).toLowerCase();

      if (!imageMimeTypes.has(file.type) && !imageExtensions.has(ext)) {
        throw new Error("Only image files are allowed");
      }

      if (file.size > 2 * 1024 * 1024) {
        throw new Error("Image file must be 2MB or smaller");
      }

      const safeExt = imageExtensions.has(ext) ? ext : ".png";
      const fileName = `${prefix}-${Date.now()}-${crypto.randomUUID()}${safeExt}`;
      const absolutePath = join(systemUploadDir, fileName);

      await mkdir(systemUploadDir, { recursive: true });
      await Bun.write(absolutePath, file);

      return `/uploads/system/${fileName}`;
    };

    const deleteSystemUpload = async (value: string) => {
      if (!value.startsWith("/uploads/system/")) {
        return;
      }

      const fileName = value.split("/").pop();
      if (!fileName) {
        return;
      }

      const absolutePath = join(systemUploadDir, fileName);
      const relativePath = relative(systemUploadDir, absolutePath);
      if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
        return;
      }

      try {
        await unlink(absolutePath);
      } catch (error) {
        if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
          return;
        }

        console.warn(`[SystemSetting] Failed to delete old upload: ${absolutePath}`, error);
        ErrorLogUtil.log(error, { level: "warn", source: "system-setting:delete-old-upload", userId: input.userId, context: { absolutePath } });
      }
    };

    const current = (await this.getIdentity()).data;
    const logoUrl = input.logo ? await saveUpload(input.logo, "logo") : input.logoUrl ?? current.logoUrl;
    const faviconUrl = input.favicon ? await saveUpload(input.favicon, "favicon") : input.faviconUrl ?? current.faviconUrl;

    const next = {
      systemName: input.systemName?.trim() || current.systemName,
      systemSubtitle: input.systemSubtitle?.trim() ?? current.systemSubtitle,
      appTitle: input.appTitle?.trim() || current.appTitle || input.systemName?.trim() || current.systemName,
      titleMode: input.titleMode && ["title_only", "title_section"].includes(input.titleMode) ? input.titleMode : current.titleMode,
      logoUrl,
      faviconUrl,
    };

    await Promise.all([
      upsertConfig("system_name", next.systemName, "System Name", "Primary application name", "SYSTEM_IDENTITY", input.userId),
      upsertConfig("system_subtitle", next.systemSubtitle, "System Subtitle", "Short application subtitle", "SYSTEM_IDENTITY", input.userId),
      upsertConfig("app_title", next.appTitle, "App Title", "Browser document title", "SYSTEM_IDENTITY", input.userId),
      upsertConfig("app_title_mode", next.titleMode, "App Title Mode", "Browser title display mode", "SYSTEM_IDENTITY", input.userId),
      upsertConfig("system_logo_url", next.logoUrl, "System Logo URL", "Application logo path or URL", "SYSTEM_IDENTITY", input.userId),
      upsertConfig("system_favicon_url", next.faviconUrl, "System Favicon URL", "Browser favicon path or URL", "SYSTEM_IDENTITY", input.userId),
    ]);

    await Promise.all([
      current.logoUrl && current.logoUrl !== next.logoUrl ? deleteSystemUpload(current.logoUrl) : Promise.resolve(),
      current.faviconUrl && current.faviconUrl !== next.faviconUrl ? deleteSystemUpload(current.faviconUrl) : Promise.resolve(),
    ]);

    const result = await this.getIdentity();
    ActivityLogUtil.log({ userId: input.userId, action: 'UPDATE', resourceType: 'system_config', description: 'Updated system identity and logo', metadata: { category: 'SYSTEM_IDENTITY' } });
    AuditLogUtil.log({ userId: input.userId, action: 'UPDATE', tableName: 'system_config', recordId: 'system_identity', beforeData: current, afterData: result.data });
    return result;
  }

  static async getNotificationSound() {
    const soundUrl = await getConfigValue("notification_sound_url", "");
    return { success: true, data: { soundUrl } };
  }

  static async updateNotificationSound(input: { sound: File; userId?: number }) {
    const uploadRoot = join(process.cwd(), "uploads");
    const systemUploadDir = join(uploadRoot, "system");

    const audioExtensions = new Set([".mp3", ".wav", ".ogg", ".webm", ".aac"]);
    const audioMimeTypes = new Set([
      "audio/mpeg",
      "audio/mp3",
      "audio/wav",
      "audio/ogg",
      "audio/webm",
      "audio/aac",
    ]);
    const originalName = input.sound.name || "notification.mp3";
    const ext = extname(originalName).toLowerCase();

    if (!audioMimeTypes.has(input.sound.type) && !audioExtensions.has(ext)) {
      throw new Error("Only audio files are allowed (mp3, wav, ogg, webm, aac)");
    }

    if (input.sound.size > 5 * 1024 * 1024) {
      throw new Error("Audio file must be 5MB or smaller");
    }

    const safeExt = audioExtensions.has(ext) ? ext : ".mp3";
    const fileName = `notification-sound-${Date.now()}-${crypto.randomUUID()}${safeExt}`;
    const absolutePath = join(systemUploadDir, fileName);

    await mkdir(systemUploadDir, { recursive: true });
    await Bun.write(absolutePath, input.sound);

    const newUrl = `/uploads/system/${fileName}`;

    const current = (await this.getNotificationSound()).data;
    if (current.soundUrl?.startsWith("/uploads/system/")) {
      const oldFile = current.soundUrl.split("/").pop();
      if (oldFile) {
        const oldPath = join(systemUploadDir, oldFile);
        const rel = relative(systemUploadDir, oldPath);
        if (!rel.startsWith("..") && !isAbsolute(rel)) {
          try { await unlink(oldPath); } catch { /* ignore */ }
        }
      }
    }

    await upsertConfig("notification_sound_url", newUrl, "Notification Sound URL", "Custom notification sound file path", "SYSTEM_IDENTITY", input.userId);

    ActivityLogUtil.log({ userId: input.userId, action: 'UPDATE', resourceType: 'system_config', description: 'Uploaded notification sound' });
    AuditLogUtil.log({ userId: input.userId, action: 'UPDATE', tableName: 'system_config', recordId: 'notification_sound_url', beforeData: current, afterData: { soundUrl: newUrl } });
    return { success: true, data: { soundUrl: newUrl } };
  }

  static async deleteNotificationSound(userId?: number) {
    const uploadRoot = join(process.cwd(), "uploads");
    const systemUploadDir = join(uploadRoot, "system");

    const current = (await this.getNotificationSound()).data;
    if (current.soundUrl?.startsWith("/uploads/system/")) {
      const oldFile = current.soundUrl.split("/").pop();
      if (oldFile) {
        const oldPath = join(systemUploadDir, oldFile);
        const rel = relative(systemUploadDir, oldPath);
        if (!rel.startsWith("..") && !isAbsolute(rel)) {
          try { await unlink(oldPath); } catch { /* ignore */ }
        }
      }
    }

    await upsertConfig("notification_sound_url", "", "Notification Sound URL", "Custom notification sound file path", "SYSTEM_IDENTITY", userId);

    ActivityLogUtil.log({ userId, action: 'DELETE', resourceType: 'system_config', description: 'Deleted notification sound' });
    AuditLogUtil.log({ userId, action: 'UPDATE', tableName: 'system_config', recordId: 'notification_sound_url', beforeData: current, afterData: { soundUrl: "" } });
    return { success: true, data: { soundUrl: "" } };
  }

  static async getOrganizationSupport() {
    const defaults = {
      organizationName: "",
      organizationLogoUrl: "",
      supportEmail: "",
      websiteUrl: "",
      helpCenterUrl: "/help",
    };

    const [organizationName, organizationLogoUrl, supportEmail, websiteUrl, helpCenterUrl] = await Promise.all([
      getConfigValue("organization_name", defaults.organizationName),
      getConfigValue("organization_logo_url", defaults.organizationLogoUrl),
      getConfigValue("support_email", defaults.supportEmail),
      getConfigValue("website_url", defaults.websiteUrl),
      getConfigValue("help_center_url", defaults.helpCenterUrl),
    ]);

    return {
      success: true,
      data: {
        organizationName,
        organizationLogoUrl,
        supportEmail,
        websiteUrl,
        helpCenterUrl,
      },
    };
  }

  static async updateOrganizationSupport(input: {
    organizationName?: string;
    organizationLogoUrl?: string;
    organizationLogo?: File;
    supportEmail?: string;
    websiteUrl?: string;
    helpCenterUrl?: string;
    userId?: number;
  }) {
    const systemUploadDir = join(process.cwd(), "uploads", "system");

    const saveOrganizationLogo = async (file: File) => {
      const imageExtensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"]);
      const imageMimeTypes = new Set([
        "image/png",
        "image/jpeg",
        "image/webp",
        "image/gif",
        "image/svg+xml",
      ]);
      const ext = extname(file.name || "organization-logo.png").toLowerCase();

      if (!imageMimeTypes.has(file.type) && !imageExtensions.has(ext)) {
        throw new Error("Only image files are allowed");
      }
      if (file.size > 2 * 1024 * 1024) {
        throw new Error("Image file must be 2MB or smaller");
      }

      const fileName = `organization-logo-${Date.now()}-${crypto.randomUUID()}${imageExtensions.has(ext) ? ext : ".png"}`;
      await mkdir(systemUploadDir, { recursive: true });
      await Bun.write(join(systemUploadDir, fileName), file);
      return `/uploads/system/${fileName}`;
    };

    const deleteOrganizationLogo = async (value: string) => {
      if (!value.startsWith("/uploads/system/organization-logo-")) return;

      const fileName = value.split("/").pop();
      if (!fileName) return;

      const absolutePath = join(systemUploadDir, fileName);
      const relativePath = relative(systemUploadDir, absolutePath);
      if (relativePath.startsWith("..") || isAbsolute(relativePath)) return;

      try {
        await unlink(absolutePath);
      } catch (error) {
        if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) {
          console.warn(`[SystemSetting] Failed to delete old organization logo: ${absolutePath}`, error);
          ErrorLogUtil.log(error, { level: "warn", source: "system-setting:delete-old-organization-logo", userId: input.userId, context: { absolutePath } });
        }
      }
    };

    const current = (await this.getOrganizationSupport()).data;
    const organizationLogoUrl = input.organizationLogo
      ? await saveOrganizationLogo(input.organizationLogo)
      : input.organizationLogoUrl ?? current.organizationLogoUrl;
    const next = {
      organizationName: input.organizationName?.trim() ?? current.organizationName,
      organizationLogoUrl,
      supportEmail: input.supportEmail?.trim() ?? current.supportEmail,
      websiteUrl: input.websiteUrl?.trim() ?? current.websiteUrl,
      helpCenterUrl: input.helpCenterUrl?.trim() || current.helpCenterUrl,
    };

    await Promise.all([
      upsertConfig("organization_name", next.organizationName, "Organization Name", "Organization display name", "ORGANIZATION", input.userId),
      upsertConfig("organization_logo_url", next.organizationLogoUrl, "Organization Logo URL", "Organization logo used on login and reports", "ORGANIZATION", input.userId),
      upsertConfig("support_email", next.supportEmail, "Support Email", "Support contact email", "ORGANIZATION", input.userId),
      upsertConfig("website_url", next.websiteUrl, "Website URL", "Organization website URL", "ORGANIZATION", input.userId),
      upsertConfig("help_center_url", next.helpCenterUrl, "Help Center URL", "Help center path or URL", "ORGANIZATION", input.userId),
    ]);

    if (current.organizationLogoUrl && current.organizationLogoUrl !== next.organizationLogoUrl) {
      await deleteOrganizationLogo(current.organizationLogoUrl);
    }

    ActivityLogUtil.log({ userId: input.userId, action: 'UPDATE', resourceType: 'system_config', description: 'Updated organization and support settings', metadata: { category: 'ORGANIZATION' } });
    AuditLogUtil.log({ userId: input.userId, action: 'UPDATE', tableName: 'system_config', recordId: 'organization_support', beforeData: current, afterData: next });
    return { success: true, data: next };
  }

  static async getRegistrationApproval() {
    const defaults = {
      enabled: false,
      requireApproval: true,
      defaultRole: "USER",
    };
    const toBoolean = (value: unknown, fallback: boolean) => {
      if (typeof value === "boolean") return value;
      if (typeof value === "string") {
        if (value.toLowerCase() === "true") return true;
        if (value.toLowerCase() === "false") return false;
      }
      return fallback;
    };

    const [enabled, requireApproval, defaultRole] = await Promise.all([
      getBooleanConfigValue("self_registration_enabled", defaults.enabled),
      getBooleanConfigValue("registration_requires_approval", defaults.requireApproval),
      getConfigValue("registration_default_role", defaults.defaultRole),
    ]);

    return {
      success: true,
      data: {
        enabled: toBoolean(enabled, defaults.enabled),
        requireApproval: toBoolean(requireApproval, defaults.requireApproval),
        defaultRole: String(defaultRole).trim() || defaults.defaultRole,
      },
    };
  }

  static async updateRegistrationApproval(input: {
    enabled?: boolean;
    requireApproval?: boolean;
    defaultRole?: string;
    userId?: number;
  }) {
    const current = (await this.getRegistrationApproval()).data;
    const defaultRole = input.defaultRole?.trim().toUpperCase() || current.defaultRole;

    const role = await prisma.roles.findUnique({
      where: { id: defaultRole },
      select: { id: true },
    });

    if (!role) {
      throw new Error(`Role "${defaultRole}" not found`);
    }

    const next = {
      enabled: input.enabled ?? current.enabled,
      requireApproval: input.requireApproval ?? current.requireApproval,
      defaultRole,
    };

    await Promise.all([
      upsertConfig("self_registration_enabled", String(next.enabled), "Self Registration", "Allow users to register from the login page", "REGISTRATION", input.userId),
      upsertConfig("registration_requires_approval", String(next.requireApproval), "Require Approval", "Require admin approval for self-registered users", "REGISTRATION", input.userId),
      upsertConfig("registration_default_role", next.defaultRole, "Default Registration Role", "Default role assigned to self-registered users", "REGISTRATION", input.userId),
    ]);

    ActivityLogUtil.log({ userId: input.userId, action: 'UPDATE', resourceType: 'system_config', description: 'Updated registration settings', metadata: { category: 'REGISTRATION' } });
    AuditLogUtil.log({ userId: input.userId, action: 'UPDATE', tableName: 'system_config', recordId: 'registration_approval', beforeData: current, afterData: next });
    return { success: true, data: next };
  }

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

  static async getRedisSettings() {
    const defaults = {
      enabled: false,
      host: "127.0.0.1",
      port: 6379,
      db: 0,
      password: "",
      hasPassword: false,
      prefix: REDIS_KEY_PREFIX,
    };

    const [enabled, host, rawPort, rawDb, password, prefix] = await Promise.all([
      getBooleanConfigValue("redis_enabled", defaults.enabled),
      getConfigValue("redis_host", defaults.host),
      getConfigValue("redis_port", String(defaults.port)),
      getConfigValue("redis_db", String(defaults.db)),
      getSecretConfigValue("redis_password"),
      getConfigValue("redis_key_prefix", defaults.prefix),
    ]);

    const port = Number.parseInt(rawPort, 10);
    const db = Number.parseInt(rawDb, 10);

    return {
      success: true,
      data: {
        enabled,
        host,
        port: Number.isInteger(port) && port > 0 ? port : defaults.port,
        db: Number.isInteger(db) && db >= 0 ? db : defaults.db,
        hasPassword: Boolean(password),
        prefix,
      },
    };
  }

  static async updateRedisSettings(input: {
    enabled?: boolean;
    host?: string;
    port?: number;
    db?: number;
    password?: string;
    prefix?: string;
    userId?: number;
  }) {
    const current = (await this.getRedisSettings()).data;
    const port = Number(input.port ?? current.port);
    const db = Number(input.db ?? current.db);

    if (input.enabled && !input.host?.trim() && !current.host) {
      throw new Error("Redis host is required when Redis is enabled");
    }

    const next = {
      enabled: input.enabled ?? current.enabled,
      host: input.host?.trim() || current.host,
      port: Number.isInteger(port) && port > 0 ? port : current.port,
      db: Number.isInteger(db) && db >= 0 ? db : current.db,
      hasPassword: current.hasPassword || Boolean(input.password),
      prefix: input.prefix?.trim() || current.prefix,
    };

    const updates = [
      upsertConfig("redis_enabled", String(next.enabled), "Redis Enabled", "Enable Redis cache and presence features", "REDIS", "BOOLEAN", false, input.userId),
      upsertConfig("redis_host", next.host, "Redis Host", "Redis host", "REDIS", "STRING", false, input.userId),
      upsertConfig("redis_port", String(next.port), "Redis Port", "Redis port", "REDIS", "NUMBER", false, input.userId),
      upsertConfig("redis_db", String(next.db), "Redis DB Index", "Redis database index", "REDIS", "NUMBER", false, input.userId),
      upsertConfig("redis_key_prefix", next.prefix, "Redis Key Prefix", "Redis key prefix", "REDIS", "STRING", false, input.userId),
    ];

    if (input.password !== undefined && input.password !== "") {
      updates.push(
        upsertConfig("redis_password", encryptText(input.password), "Redis Password", "Redis password", "REDIS", "STRING", true, input.userId),
      );
    }

    await Promise.all(updates);
    await reloadRedis();
    ActivityLogUtil.log({ userId: input.userId, action: 'UPDATE', resourceType: 'system_config', description: 'Updated Redis connection settings', metadata: { category: 'REDIS', passwordChanged: Boolean(input.password) } });
    AuditLogUtil.log({ userId: input.userId, action: 'UPDATE', tableName: 'system_config', recordId: 'redis_settings', beforeData: current, afterData: next });
    SystemEventUtil.log({ eventType: 'REDIS', eventName: 'redis-reload', status: 'success', message: 'Redis settings updated and reloaded', triggeredBy: input.userId ? `user:${input.userId}` : 'system' });
    void NotificationService.notifyAdminsRedisSettingsChanged({ actorId: input.userId });
    return { success: true, data: { ...next, password: undefined } };
  }

  static async testRedisConnection(input: {
    enabled?: boolean;
    host?: string;
    port?: number;
    db?: number;
    password?: string;
    prefix?: string;
  } = {}) {
    const current = (await this.getRedisSettings()).data;
    const port = Number(input.port ?? current.port);
    const db = Number(input.db ?? current.db);
    const password = input.password?.trim()
      ? input.password
      : await getSecretConfigValue("redis_password");

    const config = {
      enabled: input.enabled ?? current.enabled,
      host: input.host?.trim() || current.host,
      port: Number.isInteger(port) && port > 0 ? port : current.port,
      db: Number.isInteger(db) && db >= 0 ? db : current.db,
      prefix: input.prefix?.trim() || current.prefix,
      password: password || undefined,
    };

    if (!config.enabled) {
      return { success: false, message: "Redis is disabled" };
    }

    const testClient = new Redis({
      host: config.host,
      port: config.port,
      password: config.password,
      db: config.db,
      lazyConnect: true,
      enableReadyCheck: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    });

    const noop = () => { /* handled by connect catch */ };
    testClient.on("error", noop);

    try {
      const start = Date.now();
      await testClient.connect();
      const pong = await testClient.ping();
      const latencyMs = Date.now() - start;

      return pong === "PONG"
        ? { success: true, message: `Redis connection verified (${latencyMs}ms)` }
        : { success: false, message: `Unexpected PING response: ${pong}` };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Redis connection failed",
      };
    } finally {
      testClient.off("error", noop);
      testClient.disconnect();
    }
  }

  static async getRedisStatus() {
    const result = await pingRedis();
    if (!result.connected) {
      return { success: false, message: result.error || "Redis unavailable", data: { connected: false } };
    }

    return {
      success: true,
      message: `Redis connected (${result.latencyMs ?? 0}ms)`,
      data: { connected: true, latencyMs: result.latencyMs ?? 0 },
    };
  }

  static async listRedisKeys(group?: string) {
    const redis = getRedisClient();
    if (!redis) {
      throw new Error("Redis disabled or unavailable");
    }

    const formatTtl = (ttl: number) => {
      if (ttl === -1) return "persistent";
      if (ttl === -2) return "expired";
      if (ttl < 60) return `${ttl}s`;

      const minutes = Math.floor(ttl / 60);
      const seconds = ttl % 60;
      if (minutes < 60) return seconds ? `${minutes}m ${seconds}s` : `${minutes}m`;

      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      if (hours < 24) return remainingMinutes ? `${hours}h ${remainingMinutes}m` : `${hours}h`;

      const days = Math.floor(hours / 24);
      const remainingHours = hours % 24;
      return remainingHours ? `${days}d ${remainingHours}h` : `${days}d`;
    };

    const formatBytes = (bytes?: number | null) => {
      if (!bytes || bytes <= 0) return "-";
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    };

    const getRedisKeyGroup = (key: string) => {
      const normalized = stripRedisKeyPrefix(key);
      const first = normalized.split(":")[0]?.trim();
      return first || "other";
    };

    const client = redis;
    const keys = await client.keys("*");
    const filteredKeys = group && group !== "all"
      ? keys.filter((key) => getRedisKeyGroup(key) === group)
      : keys;

    const data = await Promise.all(filteredKeys.sort().map(async (key) => {
      const normalizedKey = stripRedisKeyPrefix(key);
      const [type, ttl, memoryUsage] = await Promise.all([
        client.type(normalizedKey),
        client.ttl(normalizedKey),
        client.memory("USAGE", normalizedKey).catch(() => null),
      ]);

      return {
        key,
        type,
        ttl: formatTtl(ttl),
        ttlSeconds: ttl,
        size: formatBytes(typeof memoryUsage === "number" ? memoryUsage : null),
        group: getRedisKeyGroup(key),
      };
    }));

    return { success: true, data };
  }

  static async getRedisKeyValue(key: string) {
    const redis = getRedisClient();
    if (!redis) {
      throw new Error("Redis disabled or unavailable");
    }

    const formatTtl = (ttl: number) => {
      if (ttl === -1) return "persistent";
      if (ttl === -2) return "expired";
      if (ttl < 60) return `${ttl}s`;

      const minutes = Math.floor(ttl / 60);
      const seconds = ttl % 60;
      if (minutes < 60) return seconds ? `${minutes}m ${seconds}s` : `${minutes}m`;

      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      if (hours < 24) return remainingMinutes ? `${hours}h ${remainingMinutes}m` : `${hours}h`;

      const days = Math.floor(hours / 24);
      const remainingHours = hours % 24;
      return remainingHours ? `${days}d ${remainingHours}h` : `${days}d`;
    };

    const formatBytes = (bytes?: number | null) => {
      if (!bytes || bytes <= 0) return "-";
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    };

    const getRedisKeyGroup = (redisKey: string) => {
      const normalized = stripRedisKeyPrefix(redisKey);
      const first = normalized.split(":")[0]?.trim();
      return first || "other";
    };

    const safeParseRedisValue = (value: unknown) => {
      if (typeof value === "string") {
        try {
          return JSON.stringify(JSON.parse(value), null, 2);
        } catch {
          return value;
        }
      }

      return JSON.stringify(value, null, 2);
    };

    const client = redis;
    const normalizedKey = stripRedisKeyPrefix(key);
    const type = await client.type(normalizedKey);

    let value: unknown = null;

    switch (type) {
      case "string":
        value = await client.get(normalizedKey);
        break;
      case "hash":
        value = await client.hgetall(normalizedKey);
        break;
      case "list":
        value = await client.lrange(normalizedKey, 0, 99);
        break;
      case "set":
        value = await client.smembers(normalizedKey);
        break;
      case "zset":
        value = await client.zrange(normalizedKey, 0, 99, "WITHSCORES");
        break;
      case "stream":
        value = await client.xrange(normalizedKey, "-", "+", "COUNT", 50);
        break;
      case "none":
        throw new Error("Redis key not found");
      default:
        value = `[Unsupported Redis type: ${type}]`;
    }

    const [ttl, memoryUsage] = await Promise.all([
      client.ttl(normalizedKey),
      client.memory("USAGE", normalizedKey).catch(() => null),
    ]);

    return {
      success: true,
      data: {
        key,
        type,
        ttl: formatTtl(ttl),
        ttlSeconds: ttl,
        size: formatBytes(typeof memoryUsage === "number" ? memoryUsage : null),
        group: getRedisKeyGroup(key),
        value: safeParseRedisValue(value),
      },
    };
  }

  static async deleteRedisKey(key: string, actorId?: number) {
    const deleted = await deleteCacheKeys([key]);
    SystemEventUtil.log({
      eventType: "CACHE",
      eventName: "redis-key-delete",
      status: "success",
      details: { key, deleted },
      triggeredBy: actorId ? `user:${actorId}` : "system",
    });
    return {
      success: true,
      message: deleted > 0 ? `Deleted ${key}` : `Key not found: ${key}`,
      data: { deleted },
    };
  }

  static async clearRedisKeys(group?: string, actorId?: number) {
    if (!group || group === "all") {
      const deleted = await clearAllCache();
      SystemEventUtil.log({
        eventType: "CACHE",
        eventName: "redis-cache-clear",
        status: "success",
        message: `Cleared ${deleted} Redis key(s)`,
        details: { group: "all", deleted },
        triggeredBy: actorId ? `user:${actorId}` : "system",
      });
      return { success: true, message: `Cleared ${deleted} Redis key(s)`, data: { deleted } };
    }

    const keys = (await this.listRedisKeys(group)).data.map((item) => item.key);
    const deleted = await deleteCacheKeys(keys);
    SystemEventUtil.log({
      eventType: "CACHE",
      eventName: "redis-cache-clear",
      status: "success",
      message: `Cleared ${deleted} Redis key(s) in ${group}`,
      details: { group, deleted },
      triggeredBy: actorId ? `user:${actorId}` : "system",
    });
    return { success: true, message: `Cleared ${deleted} Redis key(s) in ${group}`, data: { deleted } };
  }

  static async getSmtpSettings() {
    const defaults = {
      enabled: false,
      host: "",
      port: 587,
      encryption: "starttls" as const,
      user: "",
      password: "",
      hasPassword: false,
      fromName: "IT Utilities",
      fromEmail: "",
      appName: "IT Utilities",
      appUrl: "http://localhost:5173",
    };

    const [enabled, host, rawPort, secure, requireTLS, user, password, fromName, fromEmail, appName, appUrl] = await Promise.all([
      getBooleanConfigValue("smtp_enabled", defaults.enabled),
      getConfigValue("smtp_host", defaults.host),
      getConfigValue("smtp_port", String(defaults.port)),
      getBooleanConfigValue("smtp_secure", false),
      getBooleanConfigValue("smtp_require_tls", true),
      getConfigValue("smtp_user", defaults.user),
      getSecretConfigValue("smtp_password"),
      getConfigValue("smtp_from_name", defaults.fromName),
      getConfigValue("smtp_from_email", defaults.fromEmail),
      getConfigValue("email_app_name", defaults.appName),
      getConfigValue("email_app_url", defaults.appUrl),
    ]);

    const port = Number.parseInt(rawPort, 10);

    return {
      success: true,
      data: {
        enabled,
        host,
        port: Number.isInteger(port) && port > 0 ? port : defaults.port,
        encryption: secure ? "ssl" : requireTLS ? "starttls" : "none",
        user,
        hasPassword: Boolean(password),
        fromName,
        fromEmail,
        appName,
        appUrl,
      },
    };
  }

  static async updateSmtpSettings(input: {
    enabled?: boolean;
    host?: string;
    port?: number;
    encryption?: "starttls" | "ssl" | "none";
    user?: string;
    password?: string;
    fromName?: string;
    fromEmail?: string;
    appName?: string;
    appUrl?: string;
    userId?: number;
  }) {
    const current = (await this.getSmtpSettings()).data;
    const encryption = input.encryption ?? current.encryption;
    const secure = encryption === "ssl";
    const requireTLS = encryption === "starttls";
    const port = Number(input.port ?? current.port);

    if (input.enabled && !input.host?.trim() && !current.host) {
      throw new Error("SMTP host is required when SMTP is enabled");
    }

    if (input.enabled && !input.fromEmail?.trim() && !current.fromEmail) {
      throw new Error("SMTP from email is required when SMTP is enabled");
    }

    const next = {
      enabled: input.enabled ?? current.enabled,
      host: input.host?.trim() ?? current.host,
      port: Number.isInteger(port) && port > 0 ? port : current.port,
      encryption,
      user: input.user?.trim() ?? current.user,
      hasPassword: current.hasPassword || Boolean(input.password),
      fromName: input.fromName?.trim() || current.fromName,
      fromEmail: input.fromEmail?.trim() ?? current.fromEmail,
      appName: input.appName?.trim() || current.appName,
      appUrl: input.appUrl?.trim() || current.appUrl,
    };

    const updates = [
      upsertConfig("smtp_enabled", String(next.enabled), "SMTP Enabled", "Enable SMTP email sending", "SMTP", "BOOLEAN", false, input.userId),
      upsertConfig("smtp_host", next.host, "SMTP Host", "SMTP host", "SMTP", "STRING", false, input.userId),
      upsertConfig("smtp_port", String(next.port), "SMTP Port", "SMTP port", "SMTP", "NUMBER", false, input.userId),
      upsertConfig("smtp_encryption", next.encryption, "SMTP Encryption", "SMTP encryption mode", "SMTP", "STRING", false, input.userId),
      upsertConfig("smtp_secure", String(secure), "SMTP Secure", "Use secure SMTP connection", "SMTP", "BOOLEAN", false, input.userId),
      upsertConfig("smtp_require_tls", String(requireTLS), "SMTP Require TLS", "Require TLS for SMTP connection", "SMTP", "BOOLEAN", false, input.userId),
      upsertConfig("smtp_user", next.user, "SMTP User", "SMTP username", "SMTP", "STRING", false, input.userId),
      upsertConfig("smtp_from_name", next.fromName, "SMTP From Name", "SMTP sender display name", "SMTP", "STRING", false, input.userId),
      upsertConfig("smtp_from_email", next.fromEmail, "SMTP From Email", "SMTP sender email address", "SMTP", "STRING", false, input.userId),
      upsertConfig("email_app_name", next.appName, "Email App Name", "Application name shown in system emails", "SMTP", "STRING", false, input.userId),
      upsertConfig("email_app_url", next.appUrl, "Email App URL", "Application URL used in system emails", "SMTP", "STRING", false, input.userId),
    ];

    if (input.password !== undefined && input.password !== "") {
      updates.push(
        upsertConfig("smtp_password", encryptText(input.password), "SMTP Password", "SMTP password", "SMTP", "STRING", true, input.userId),
      );
    }

    await Promise.all(updates);
    await reloadSmtp();
    ActivityLogUtil.log({ userId: input.userId, action: 'UPDATE', resourceType: 'system_config', description: 'Updated SMTP connection settings', metadata: { category: 'SMTP', passwordChanged: Boolean(input.password) } });
    AuditLogUtil.log({ userId: input.userId, action: 'UPDATE', tableName: 'system_config', recordId: 'smtp_settings', beforeData: current, afterData: next });
    SystemEventUtil.log({ eventType: 'SMTP', eventName: 'smtp-reload', status: 'success', message: 'SMTP settings updated and reloaded', triggeredBy: input.userId ? `user:${input.userId}` : 'system' });
    void NotificationService.notifyAdminsSmtpSettingsChanged({ actorId: input.userId });
    return { success: true, data: { ...next, password: undefined } };
  }

  static async testSmtpConnection(input: {
    enabled?: boolean;
    host?: string;
    port?: number;
    encryption?: "starttls" | "ssl" | "none";
    user?: string;
    password?: string;
    fromName?: string;
    fromEmail?: string;
    appName?: string;
    appUrl?: string;
  } = {}) {
    const current = (await this.getSmtpSettings()).data;
    const encryption = input.encryption ?? current.encryption;
    const secure = encryption === "ssl";
    const requireTLS = encryption === "starttls";
    const port = Number(input.port ?? current.port);
    const password = input.password?.trim()
      ? input.password
      : await getSecretConfigValue("smtp_password");

    const config = {
      enabled: input.enabled ?? current.enabled,
      host: input.host?.trim() ?? current.host,
      port: Number.isInteger(port) && port > 0 ? port : current.port,
      encryption,
      secure,
      requireTLS,
      user: input.user?.trim() ?? current.user,
      password,
      fromName: input.fromName?.trim() || current.fromName,
      fromEmail: input.fromEmail?.trim() ?? current.fromEmail,
      appName: input.appName?.trim() || current.appName,
      appUrl: input.appUrl?.trim() || current.appUrl,
    };

    if (!config.enabled) {
      return {
        success: false,
        message: "SMTP is disabled",
      };
    }

    if (!config.host || !config.port) {
      return { success: false, message: "SMTP host and port are required" };
    }

    const testTransporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.user ? { user: config.user, pass: config.password } : undefined,
      requireTLS: config.requireTLS,
      tls: { rejectUnauthorized: false },
    });

    try {
      await testTransporter.verify();
      return { success: true, message: "SMTP connection verified" };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "SMTP connection failed",
      };
    } finally {
      try { testTransporter.close(); } catch { /* ignore */ }
    }
  }

  static async sendSmtpTestEmail(to: string) {
    if (!to.trim()) {
      throw new Error("Recipient email is required");
    }

    await reloadSmtp();
    const settings = (await this.getSmtpSettings()).data;
    const sent = await EmailManager.sendMail({
      to: to.trim(),
      subject: `${settings.appName} SMTP test email`,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
          <h2>${settings.appName} SMTP test email</h2>
          <p>This message confirms that SMTP is working for your system.</p>
          <p><a href="${settings.appUrl}">${settings.appUrl}</a></p>
          <p style="color:#6b7280;font-size:12px">Sent at ${new Date().toISOString()}</p>
        </div>
      `,
    });

    return sent
      ? { success: true, message: `Test email sent to ${to.trim()}` }
      : { success: false, message: "Failed to send test email" };
  }

  // ─── Maintenance ─────────────────────────────────────────────────────────────

  static async getMaintenance() {
    const defaults = {
      enabled: false,
      message: "",
    };

    const [mode, message] = await Promise.all([
      getBooleanConfigValue("maintenance_mode", defaults.enabled),
      getConfigValue("maintenance_message", defaults.message),
    ]);

    return {
      success: true,
      data: { enabled: mode, message },
    };
  }

  static async updateMaintenance(input: {
    enabled?: boolean;
    message?: string;
    userId?: number;
  }) {
    const current = (await this.getMaintenance()).data;

    const next = {
      enabled: input.enabled ?? current.enabled,
      message: input.message ?? current.message,
    };

    await Promise.all([
      upsertConfig("maintenance_mode", String(next.enabled), "Maintenance Mode", "Enable maintenance mode to block access", "MAINTENANCE", "BOOLEAN", false, input.userId),
      upsertConfig("maintenance_message", next.message, "Maintenance Message", "Message shown to users during maintenance", "MAINTENANCE", "STRING", false, input.userId),
    ]);

    ActivityLogUtil.log({ userId: input.userId, action: next.enabled ? 'ENABLE' : 'DISABLE', resourceType: 'system_config', description: 'Updated maintenance mode settings', metadata: { category: 'MAINTENANCE' } });
    AuditLogUtil.log({ userId: input.userId, action: 'UPDATE', tableName: 'system_config', recordId: 'maintenance', beforeData: current, afterData: next });
    return { success: true, data: next };
  }

  // ─── Regional ────────────────────────────────────────────────────────────────

  static async getRegional() {
    const defaults = {
      timezone: "Asia/Bangkok",
      dateFormat: "DD/MM/YYYY",
      timeFormat: "24h",
      yearEra: "CE" as const,
    };

    const [timezone, dateFormat, timeFormat, yearEra] = await Promise.all([
      getConfigValue("timezone", defaults.timezone),
      getConfigValue("date_format", defaults.dateFormat),
      getConfigValue("time_format", defaults.timeFormat),
      getConfigValue("year_era", defaults.yearEra),
    ]);

    const normalizedYearEra = yearEra === "BE" ? "BE" : "CE";

    return {
      success: true,
      data: { timezone, dateFormat, timeFormat, yearEra: normalizedYearEra },
    };
  }

  static async updateRegional(input: {
    timezone?: string;
    dateFormat?: string;
    timeFormat?: string;
    yearEra?: "CE" | "BE";
    userId?: number;
  }) {
    const current = (await this.getRegional()).data;

    const next = {
      timezone:   input.timezone   ?? current.timezone,
      dateFormat: input.dateFormat ?? current.dateFormat,
      timeFormat: input.timeFormat ?? current.timeFormat,
      yearEra:    input.yearEra    ?? current.yearEra,
    };

    await Promise.all([
      upsertConfig("timezone", next.timezone, "Timezone", "System timezone", "REGIONAL", "STRING", false, input.userId),
      upsertConfig("date_format", next.dateFormat, "Date Format", "System date display format", "REGIONAL", "STRING", false, input.userId),
      upsertConfig("time_format", next.timeFormat, "Time Format", "System time display format (24h or 12h)", "REGIONAL", "STRING", false, input.userId),
      upsertConfig("year_era", next.yearEra, "Year Era", "Year era: CE (Christian/ค.ศ.) or BE (Buddhist/พ.ศ.)", "REGIONAL", "STRING", false, input.userId),
    ]);

    ActivityLogUtil.log({ userId: input.userId, action: 'UPDATE', resourceType: 'system_config', description: 'Updated regional date and time settings', metadata: { category: 'REGIONAL' } });
    AuditLogUtil.log({ userId: input.userId, action: 'UPDATE', tableName: 'system_config', recordId: 'regional', beforeData: current, afterData: next });
    return { success: true, data: next };
  }
}
