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

export class SystemSettingService {
  static async getIdentity() {
    const defaults = {
      systemName: "IT Utils",
      systemSubtitle: "Internal tools and admin workspace",
      appTitle: "IT Utils",
      titleMode: "title_only" as const,
      logoUrl: "",
      faviconUrl: "",
    };

    const [systemName, systemSubtitle, appTitle, rawTitleMode, logoUrl, faviconUrl] = await Promise.all([
      getConfigValue("system_name", defaults.systemName),
      getConfigValue("system_subtitle", defaults.systemSubtitle),
      getConfigValue("app_title", defaults.appTitle),
      getConfigValue("app_title_mode", defaults.titleMode),
      getConfigValue("system_logo_url", defaults.logoUrl),
      getConfigValue("system_favicon_url", defaults.faviconUrl),
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

    return { success: true, data: next };
  }

  static async getOrganizationSupport() {
    const defaults = {
      organizationName: "",
      supportEmail: "",
      websiteUrl: "",
      helpCenterUrl: "/help",
    };

    const [organizationName, supportEmail, websiteUrl, helpCenterUrl] = await Promise.all([
      getConfigValue("organization_name", defaults.organizationName),
      getConfigValue("support_email", defaults.supportEmail),
      getConfigValue("website_url", defaults.websiteUrl),
      getConfigValue("help_center_url", defaults.helpCenterUrl),
    ]);

    return {
      success: true,
      data: {
        organizationName,
        supportEmail,
        websiteUrl,
        helpCenterUrl,
      },
    };
  }

  static async updateOrganizationSupport(input: {
    organizationName?: string;
    supportEmail?: string;
    websiteUrl?: string;
    helpCenterUrl?: string;
    userId?: number;
  }) {
    const current = (await this.getOrganizationSupport()).data;
    const next = {
      organizationName: input.organizationName?.trim() ?? current.organizationName,
      supportEmail: input.supportEmail?.trim() ?? current.supportEmail,
      websiteUrl: input.websiteUrl?.trim() ?? current.websiteUrl,
      helpCenterUrl: input.helpCenterUrl?.trim() || current.helpCenterUrl,
    };

    await Promise.all([
      upsertConfig("organization_name", next.organizationName, "Organization Name", "Organization display name", "ORGANIZATION", input.userId),
      upsertConfig("support_email", next.supportEmail, "Support Email", "Support contact email", "ORGANIZATION", input.userId),
      upsertConfig("website_url", next.websiteUrl, "Website URL", "Organization website URL", "ORGANIZATION", input.userId),
      upsertConfig("help_center_url", next.helpCenterUrl, "Help Center URL", "Help center path or URL", "ORGANIZATION", input.userId),
    ]);

    return { success: true, data: next };
  }

  static async getRegistrationApproval() {
    const defaults = {
      enabled: false,
      requireApproval: true,
      defaultRole: "USER",
    };

    const [enabled, requireApproval, defaultRole] = await Promise.all([
      getBooleanConfigValue("self_registration_enabled", defaults.enabled),
      getBooleanConfigValue("registration_requires_approval", defaults.requireApproval),
      getConfigValue("registration_default_role", defaults.defaultRole),
    ]);

    return {
      success: true,
      data: {
        enabled,
        requireApproval,
        defaultRole: defaultRole.trim() || defaults.defaultRole,
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

  static async deleteRedisKey(key: string) {
    const deleted = await deleteCacheKeys([key]);
    return {
      success: true,
      message: deleted > 0 ? `Deleted ${key}` : `Key not found: ${key}`,
      data: { deleted },
    };
  }

  static async clearRedisKeys(group?: string) {
    if (!group || group === "all") {
      const deleted = await clearAllCache();
      return { success: true, message: `Cleared ${deleted} Redis key(s)`, data: { deleted } };
    }

    const keys = (await this.listRedisKeys(group)).data.map((item) => item.key);
    const deleted = await deleteCacheKeys(keys);
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

    return { success: true, data: next };
  }
}
