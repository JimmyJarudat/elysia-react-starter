import nodemailer from "nodemailer";
import { Client } from "ldapts";
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
import { ActivityLogUtil } from "@/utils/activity-log";
import { AuditLogUtil } from "@/utils/audit-log";
import { SystemEventUtil } from "@/utils/system-event";
import { NotificationService } from "@/modules/notifications/notification.service";
import {
  buildStorageAdapter,
  isFtpConfigured,
  getMigrationSnapshot,
  isSmbConfigured,
  isSftpConfigured,
  readStorageSettings,
  setMigrationSnapshot,
  SmbStorageTestError,
  testFtpStorageConnection,
  testSmbStorageConnection,
  testSftpStorageConnection,
} from "@/utils/storage";

type StorageMigrationConflictPolicy = "skip" | "overwrite" | "fail";

export class IntegrationSettingService {
  static async getLdapSettings() {
    const defaults = {
      enabled: false,
      url: "ldap://ldap.example.com:389",
      encryption: "starttls" as const,
      bindDn: "cn=admin,dc=example,dc=com",
      bindPassword: "",
      hasBindPassword: false,
      baseDn: "dc=example,dc=com",
      userFilter: "(&(objectClass=person)(uid={{username}}))",
    };

    const [enabled, url, encryption, bindDn, bindPassword, baseDn, userFilter] = await Promise.all([
      getBooleanConfigValue("ldap_enabled", defaults.enabled),
      getConfigValue("ldap_url", defaults.url),
      getConfigValue("ldap_encryption", defaults.encryption),
      getConfigValue("ldap_bind_dn", defaults.bindDn),
      getSecretConfigValue("ldap_bind_password"),
      getConfigValue("ldap_base_dn", defaults.baseDn),
      getConfigValue("ldap_user_filter", defaults.userFilter),
    ]);

    const normalizedEncryption = ["none", "starttls", "ldaps"].includes(String(encryption))
      ? encryption as "none" | "starttls" | "ldaps"
      : defaults.encryption;

    return {
      success: true,
      data: {
        enabled,
        url,
        encryption: normalizedEncryption,
        bindDn,
        hasBindPassword: Boolean(bindPassword),
        baseDn,
        userFilter,
      },
    };
  }

  static async updateLdapSettings(input: {
    enabled?: boolean;
    url?: string;
    encryption?: "none" | "starttls" | "ldaps";
    bindDn?: string;
    bindPassword?: string;
    baseDn?: string;
    userFilter?: string;
    userId?: number;
  }) {
    const current = (await this.getLdapSettings()).data;

    if (input.enabled && !input.url?.trim() && !current.url) {
      throw new Error("LDAP URL is required when LDAP is enabled");
    }

    if (input.enabled && !input.bindDn?.trim() && !current.bindDn) {
      throw new Error("LDAP Bind DN is required when LDAP is enabled");
    }

    if (input.enabled && !input.baseDn?.trim() && !current.baseDn) {
      throw new Error("LDAP Base DN is required when LDAP is enabled");
    }

    const next = {
      enabled: input.enabled ?? current.enabled,
      url: input.url?.trim() || current.url,
      encryption: input.encryption ?? current.encryption,
      bindDn: input.bindDn?.trim() || current.bindDn,
      hasBindPassword: current.hasBindPassword || Boolean(input.bindPassword),
      baseDn: input.baseDn?.trim() || current.baseDn,
      userFilter: input.userFilter?.trim() || current.userFilter,
    };

    const updates = [
      upsertConfig("ldap_enabled", String(next.enabled), "LDAP Enabled", "Enable LDAP user lookup", "LDAP", "BOOLEAN", false, input.userId),
      upsertConfig("ldap_url", next.url, "LDAP URL", "LDAP server URL", "LDAP", "STRING", false, input.userId),
      upsertConfig("ldap_encryption", next.encryption, "LDAP Encryption", "LDAP encryption mode: none, starttls, or ldaps", "LDAP", "STRING", false, input.userId),
      upsertConfig("ldap_bind_dn", next.bindDn, "LDAP Bind DN", "LDAP bind distinguished name", "LDAP", "STRING", false, input.userId),
      upsertConfig("ldap_base_dn", next.baseDn, "LDAP Base DN", "LDAP user search base DN", "LDAP", "STRING", false, input.userId),
      upsertConfig("ldap_user_filter", next.userFilter, "LDAP User Filter", "LDAP user lookup filter. Use {{username}} placeholder.", "LDAP", "STRING", false, input.userId),
    ];

    if (input.bindPassword !== undefined && input.bindPassword !== "") {
      updates.push(
        upsertConfig("ldap_bind_password", encryptText(input.bindPassword), "LDAP Bind Password", "LDAP bind password", "LDAP", "STRING", true, input.userId),
      );
    }

    await Promise.all(updates);
    ActivityLogUtil.log({ userId: input.userId, action: 'UPDATE', resourceType: 'system_config', description: 'Updated LDAP lookup settings', metadata: { category: 'LDAP', passwordChanged: Boolean(input.bindPassword) } });
    AuditLogUtil.log({ userId: input.userId, action: 'UPDATE', tableName: 'system_config', recordId: 'ldap_settings', beforeData: current, afterData: next });
    SystemEventUtil.log({ eventType: 'LDAP', eventName: 'ldap-settings-update', status: 'success', message: 'LDAP settings updated', triggeredBy: input.userId ? `user:${input.userId}` : 'system' });

    return { success: true, data: { ...next, bindPassword: undefined } };
  }

  static async fetchLdapUser(input: {
    username: string;
    settings?: {
      enabled?: boolean;
      url?: string;
      encryption?: "none" | "starttls" | "ldaps";
      bindDn?: string;
      bindPassword?: string;
      baseDn?: string;
      userFilter?: string;
    };
    userId?: number;
  }) {
    const username = input.username.trim();
    if (!username) {
      return { success: false, message: "Username is required" };
    }

    const current = (await this.getLdapSettings()).data;
    const settings = input.settings ?? {};
    const config = {
      enabled: settings.enabled ?? current.enabled,
      url: settings.url?.trim() || current.url,
      encryption: settings.encryption ?? current.encryption,
      bindDn: settings.bindDn?.trim() || current.bindDn,
      bindPassword: settings.bindPassword?.trim()
        ? settings.bindPassword
        : await getSecretConfigValue("ldap_bind_password"),
      baseDn: settings.baseDn?.trim() || current.baseDn,
      userFilter: settings.userFilter?.trim() || current.userFilter,
    };

    if (!config.enabled) {
      return { success: false, message: "LDAP is disabled" };
    }

    if (!config.url || !config.bindDn || !config.baseDn || !config.userFilter) {
      return { success: false, message: "LDAP URL, Bind DN, Base DN and User filter are required" };
    }

    const trimmedUrl = config.url.trim();
    const urlWithProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmedUrl)
      ? trimmedUrl
      : `${config.encryption === "ldaps" ? "ldaps" : "ldap"}://${trimmedUrl}`;
    const url = config.encryption === "ldaps" && urlWithProtocol.startsWith("ldap://")
      ? `ldaps://${urlWithProtocol.slice("ldap://".length)}`
      : config.encryption !== "ldaps" && urlWithProtocol.startsWith("ldaps://")
        ? `ldap://${urlWithProtocol.slice("ldaps://".length)}`
        : urlWithProtocol;
    const escapedUsername = username.replace(/[\0()*\\]/g, (char) => {
      switch (char) {
        case "\0": return "\\00";
        case "(": return "\\28";
        case ")": return "\\29";
        case "*": return "\\2a";
        case "\\": return "\\5c";
        default: return char;
      }
    });
    const filter = config.userFilter.replaceAll("{{username}}", escapedUsername);
    const firstString = (value: unknown) => {
      if (typeof value === "string") return value;
      if (Buffer.isBuffer(value)) return value.toString("utf8");
      if (Array.isArray(value)) {
        const first = value[0];
        if (typeof first === "string") return first;
        if (Buffer.isBuffer(first)) return first.toString("utf8");
      }
      return "";
    };
    const client = new Client(
      config.encryption === "ldaps"
        ? {
          url,
          timeout: 10_000,
          connectTimeout: 10_000,
          tlsOptions: { rejectUnauthorized: false },
        }
        : {
          url,
          timeout: 10_000,
          connectTimeout: 10_000,
        },
    );

    try {
      if (config.encryption === "starttls") {
        await client.startTLS({ rejectUnauthorized: false });
      }

      await client.bind(config.bindDn, config.bindPassword);
      const result = await client.search(config.baseDn, {
        scope: "sub",
        filter,
        sizeLimit: 1,
        timeLimit: 10,
        attributes: ["uid", "sAMAccountName", "cn", "displayName", "mail", "userPrincipalName"],
      });

      const entry = result.searchEntries[0];
      if (!entry) {
        SystemEventUtil.log({ eventType: 'LDAP', eventName: 'ldap-user-fetch', status: 'failed', message: `LDAP user not found: ${username}`, triggeredBy: input.userId ? `user:${input.userId}` : 'system', details: { url, baseDn: config.baseDn, filter } });
        return { success: false, message: "LDAP user not found" };
      }

      const resolvedUsername = firstString(entry.uid) || firstString(entry.sAMAccountName) || username;
      const displayName = firstString(entry.displayName) || firstString(entry.cn) || resolvedUsername;
      const email = firstString(entry.mail) || firstString(entry.userPrincipalName);
      const user = {
        username: resolvedUsername,
        displayName,
        email,
        dn: entry.dn,
        filter,
      };

      SystemEventUtil.log({ eventType: 'LDAP', eventName: 'ldap-user-fetch', status: 'success', message: `LDAP user fetched: ${resolvedUsername}`, triggeredBy: input.userId ? `user:${input.userId}` : 'system', details: { url, baseDn: config.baseDn, filter } });

      return {
        success: true,
        message: "LDAP user found",
        data: user,
      };
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : "LDAP user lookup failed";
      const normalizedMessage = rawMessage.toLowerCase();
      const message = config.encryption === "ldaps" && (
        normalizedMessage.includes("before secure tls connection was established") ||
        normalizedMessage.includes("forcibly closed") ||
        normalizedMessage.includes("socket disconnected")
      )
        ? `LDAPS handshake failed for ${config.url}. Port 636 is reachable, but the server closed TLS before setup completed. Verify LDAPS is enabled on the domain controller, or try ldap://host:389 with STARTTLS/None.`
        : config.encryption === "starttls" && normalizedMessage.includes("starttls")
          ? `LDAP STARTTLS failed for ${config.url}. Verify the server supports STARTTLS on port 389, or try LDAPS on 636/None on 389.`
          : rawMessage;
      SystemEventUtil.log({ eventType: 'LDAP', eventName: 'ldap-user-fetch', status: 'failed', message, triggeredBy: input.userId ? `user:${input.userId}` : 'system', details: { url, baseDn: config.baseDn, filter } });
      return { success: false, message };
    } finally {
      await client.unbind().catch(() => {});
    }
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

  static async getStorageSettings() {
    const defaults = {
      provider: "local" as "local" | "smb" | "sftp" | "ftp",
      smbHost: "",
      smbShareName: "",
      smbDomain: "",
      smbUsername: "",
      smbBasePath: "",
      smbHasPassword: false,
      sftpHost: "",
      sftpPort: 22,
      sftpUsername: "",
      sftpBasePath: "",
      sftpHasPassword: false,
      ftpHost: "",
      ftpPort: 21,
      ftpUsername: "",
      ftpBasePath: "",
      ftpSecure: false,
      ftpHasPassword: false,
    };

    const [provider, smbHost, smbShareName, smbDomain, smbUsername, smbPassword, smbBasePath, sftpHost, rawSftpPort, sftpUsername, sftpPassword, sftpBasePath, ftpHost, rawFtpPort, ftpUsername, ftpPassword, ftpBasePath, rawFtpSecure] = await Promise.all([
      getConfigValue("storage_provider", defaults.provider),
      getConfigValue("storage_smb_host", defaults.smbHost),
      getConfigValue("storage_smb_share_name", defaults.smbShareName),
      getConfigValue("storage_smb_domain", defaults.smbDomain),
      getConfigValue("storage_smb_username", defaults.smbUsername),
      getSecretConfigValue("storage_smb_password"),
      getConfigValue("storage_smb_base_path", defaults.smbBasePath),
      getConfigValue("storage_sftp_host", defaults.sftpHost),
      getConfigValue("storage_sftp_port", String(defaults.sftpPort)),
      getConfigValue("storage_sftp_username", defaults.sftpUsername),
      getSecretConfigValue("storage_sftp_password"),
      getConfigValue("storage_sftp_base_path", defaults.sftpBasePath),
      getConfigValue("storage_ftp_host", defaults.ftpHost),
      getConfigValue("storage_ftp_port", String(defaults.ftpPort)),
      getConfigValue("storage_ftp_username", defaults.ftpUsername),
      getSecretConfigValue("storage_ftp_password"),
      getConfigValue("storage_ftp_base_path", defaults.ftpBasePath),
      getBooleanConfigValue("storage_ftp_secure", defaults.ftpSecure),
    ]);
    const sftpPort = Number.parseInt(rawSftpPort, 10);
    const ftpPort = Number.parseInt(rawFtpPort, 10);
    const normalizedProvider = provider === "smb" || provider === "sftp" || provider === "ftp"
      ? provider as "smb" | "sftp" | "ftp"
      : "local" as const;

    return {
      success: true,
      data: {
        provider: normalizedProvider,
        smb: {
          host: smbHost,
          shareName: smbShareName,
          domain: smbDomain,
          username: smbUsername,
          hasPassword: Boolean(smbPassword),
          basePath: smbBasePath,
        },
        sftp: {
          host: sftpHost,
          port: Number.isInteger(sftpPort) && sftpPort > 0 ? sftpPort : defaults.sftpPort,
          username: sftpUsername,
          hasPassword: Boolean(sftpPassword),
          basePath: sftpBasePath,
        },
        ftp: {
          host: ftpHost,
          port: Number.isInteger(ftpPort) && ftpPort > 0 ? ftpPort : defaults.ftpPort,
          username: ftpUsername,
          hasPassword: Boolean(ftpPassword),
          basePath: ftpBasePath,
          secure: Boolean(rawFtpSecure),
        },
      },
    };
  }

  static async updateStorageSettings(input: {
    provider?: "local" | "smb" | "sftp" | "ftp";
    smbHost?: string;
    smbShareName?: string;
    smbDomain?: string;
    smbUsername?: string;
    smbPassword?: string;
    smbBasePath?: string;
    sftpHost?: string;
    sftpPort?: number;
    sftpUsername?: string;
    sftpPassword?: string;
    sftpBasePath?: string;
    ftpHost?: string;
    ftpPort?: number;
    ftpUsername?: string;
    ftpPassword?: string;
    ftpBasePath?: string;
    ftpSecure?: boolean;
    userId?: number;
  }) {
    const previousFull = await readStorageSettings();
    const current = (await this.getStorageSettings()).data;
    const provider = input.provider ?? current.provider;
    const trimmedSmbPassword = input.smbPassword?.trim() ?? "";
    const trimmedSftpPassword = input.sftpPassword?.trim() ?? "";
    const trimmedFtpPassword = input.ftpPassword?.trim() ?? "";
    const sftpPort = Number(input.sftpPort ?? current.sftp.port);
    const ftpPort = Number(input.ftpPort ?? current.ftp.port);
    const next = {
      provider,
      smb: {
        host: input.smbHost?.trim() ?? current.smb.host,
        shareName: input.smbShareName?.trim() ?? current.smb.shareName,
        domain: input.smbDomain?.trim() ?? current.smb.domain,
        username: input.smbUsername?.trim() ?? current.smb.username,
        hasPassword: current.smb.hasPassword || Boolean(trimmedSmbPassword),
        basePath: input.smbBasePath?.trim() ?? current.smb.basePath,
      },
      sftp: {
        host: input.sftpHost?.trim() ?? current.sftp.host,
        port: Number.isInteger(sftpPort) && sftpPort > 0 ? sftpPort : current.sftp.port,
        username: input.sftpUsername?.trim() ?? current.sftp.username,
        hasPassword: current.sftp.hasPassword || Boolean(trimmedSftpPassword),
        basePath: input.sftpBasePath?.trim() ?? current.sftp.basePath,
      },
      ftp: {
        host: input.ftpHost?.trim() ?? current.ftp.host,
        port: Number.isInteger(ftpPort) && ftpPort > 0 ? ftpPort : current.ftp.port,
        username: input.ftpUsername?.trim() ?? current.ftp.username,
        hasPassword: current.ftp.hasPassword || Boolean(trimmedFtpPassword),
        basePath: input.ftpBasePath?.trim() ?? current.ftp.basePath,
        secure: input.ftpSecure ?? current.ftp.secure,
      },
    };
    const smbCredentialChanged = (
      next.smb.host !== current.smb.host ||
      next.smb.shareName !== current.smb.shareName ||
      next.smb.domain !== current.smb.domain ||
      next.smb.username !== current.smb.username
    );
    const canReuseSmbPassword = current.smb.hasPassword && !smbCredentialChanged;
    const sftpCredentialChanged = (
      next.sftp.host !== current.sftp.host ||
      next.sftp.port !== current.sftp.port ||
      next.sftp.username !== current.sftp.username
    );
    const canReuseSftpPassword = current.sftp.hasPassword && !sftpCredentialChanged;
    const ftpCredentialChanged = (
      next.ftp.host !== current.ftp.host ||
      next.ftp.port !== current.ftp.port ||
      next.ftp.username !== current.ftp.username
    );
    const canReuseFtpPassword = current.ftp.hasPassword && !ftpCredentialChanged;

    if (provider === "smb") {
      if (!next.smb.host) throw new Error("SMB host is required");
      if (!next.smb.shareName) throw new Error("SMB share name is required");
      if (!next.smb.username) throw new Error("SMB username is required");
      if (!trimmedSmbPassword && !canReuseSmbPassword) throw new Error("SMB password is required when SMB credentials change");
    }

    if (provider === "sftp") {
      if (!next.sftp.host) throw new Error("SFTP host is required");
      if (!next.sftp.port) throw new Error("SFTP port is required");
      if (!next.sftp.username) throw new Error("SFTP username is required");
      if (!next.sftp.basePath) throw new Error("SFTP base path is required");
      if (!trimmedSftpPassword && !canReuseSftpPassword) throw new Error("SFTP password is required when SFTP credentials change");
    }

    if (provider === "ftp") {
      if (!next.ftp.host) throw new Error("FTP host is required");
      if (!next.ftp.port) throw new Error("FTP port is required");
      if (!next.ftp.username) throw new Error("FTP username is required");
      if (!next.ftp.basePath) throw new Error("FTP base path is required");
      if (!trimmedFtpPassword && !canReuseFtpPassword) throw new Error("FTP password is required when FTP credentials change");
    }

    const updates = [
      upsertConfig("storage_provider", next.provider, "Storage Provider", "Active storage provider", "STORAGE", "STRING", false, input.userId),
      upsertConfig("storage_smb_host", next.smb.host, "SMB Host", "SMB server host", "STORAGE", "STRING", false, input.userId),
      upsertConfig("storage_smb_share_name", next.smb.shareName, "SMB Share Name", "SMB share name", "STORAGE", "STRING", false, input.userId),
      upsertConfig("storage_smb_domain", next.smb.domain, "SMB Domain", "Optional SMB domain", "STORAGE", "STRING", false, input.userId),
      upsertConfig("storage_smb_username", next.smb.username, "SMB Username", "SMB username", "STORAGE", "STRING", false, input.userId),
      upsertConfig("storage_smb_base_path", next.smb.basePath, "SMB Base Path", "Base path inside the SMB share", "STORAGE", "STRING", false, input.userId),
      upsertConfig("storage_sftp_host", next.sftp.host, "SFTP Host", "SFTP server host", "STORAGE", "STRING", false, input.userId),
      upsertConfig("storage_sftp_port", String(next.sftp.port), "SFTP Port", "SFTP server port", "STORAGE", "NUMBER", false, input.userId),
      upsertConfig("storage_sftp_username", next.sftp.username, "SFTP Username", "SFTP username", "STORAGE", "STRING", false, input.userId),
      upsertConfig("storage_sftp_base_path", next.sftp.basePath, "SFTP Base Path", "Base path inside the SFTP server", "STORAGE", "STRING", false, input.userId),
      upsertConfig("storage_ftp_host", next.ftp.host, "FTP Host", "FTP server host", "STORAGE", "STRING", false, input.userId),
      upsertConfig("storage_ftp_port", String(next.ftp.port), "FTP Port", "FTP server port", "STORAGE", "NUMBER", false, input.userId),
      upsertConfig("storage_ftp_username", next.ftp.username, "FTP Username", "FTP username", "STORAGE", "STRING", false, input.userId),
      upsertConfig("storage_ftp_base_path", next.ftp.basePath, "FTP Base Path", "Base path inside the FTP server", "STORAGE", "STRING", false, input.userId),
      upsertConfig("storage_ftp_secure", String(next.ftp.secure), "FTP Secure", "Use explicit FTPS/TLS for FTP storage", "STORAGE", "BOOLEAN", false, input.userId),
    ];

    if (trimmedSmbPassword) {
      updates.push(
        upsertConfig("storage_smb_password", encryptText(trimmedSmbPassword), "SMB Password", "SMB password", "STORAGE", "STRING", true, input.userId),
      );
    }

    if (trimmedSftpPassword) {
      updates.push(
        upsertConfig("storage_sftp_password", encryptText(trimmedSftpPassword), "SFTP Password", "SFTP password", "STORAGE", "STRING", true, input.userId),
      );
    }

    if (trimmedFtpPassword) {
      updates.push(
        upsertConfig("storage_ftp_password", encryptText(trimmedFtpPassword), "FTP Password", "FTP password", "STORAGE", "STRING", true, input.userId),
      );
    }

    await Promise.all(updates);
    ActivityLogUtil.log({ userId: input.userId, action: 'UPDATE', resourceType: 'system_config', description: 'Updated storage integration settings', metadata: { category: 'STORAGE', provider: next.provider, passwordChanged: Boolean(input.smbPassword || input.sftpPassword || input.ftpPassword) } });
    AuditLogUtil.log({ userId: input.userId, action: 'UPDATE', tableName: 'system_config', recordId: 'storage_settings', beforeData: current, afterData: next });
    SystemEventUtil.log({ eventType: 'STORAGE', eventName: 'storage-settings-update', status: 'success', message: 'Storage settings updated', triggeredBy: input.userId ? `user:${input.userId}` : 'system', details: { provider: next.provider } });

    const nextFull = await readStorageSettings();
    const locationChanged = previousFull.provider !== nextFull.provider || (
      nextFull.provider === "smb" && (
        previousFull.smb.host !== nextFull.smb.host ||
        previousFull.smb.shareName !== nextFull.smb.shareName ||
        previousFull.smb.domain !== nextFull.smb.domain ||
        previousFull.smb.username !== nextFull.smb.username ||
        previousFull.smb.basePath !== nextFull.smb.basePath
      )
    ) || (
      nextFull.provider === "sftp" && (
        previousFull.sftp.host !== nextFull.sftp.host ||
        previousFull.sftp.port !== nextFull.sftp.port ||
        previousFull.sftp.username !== nextFull.sftp.username ||
        previousFull.sftp.basePath !== nextFull.sftp.basePath
      )
    ) || (
      nextFull.provider === "ftp" && (
        previousFull.ftp.host !== nextFull.ftp.host ||
        previousFull.ftp.port !== nextFull.ftp.port ||
        previousFull.ftp.username !== nextFull.ftp.username ||
        previousFull.ftp.basePath !== nextFull.ftp.basePath ||
        previousFull.ftp.secure !== nextFull.ftp.secure
      )
    );
    const sourceUsable = previousFull.provider === "local" || isSmbConfigured(previousFull) || isSftpConfigured(previousFull) || isFtpConfigured(previousFull);
    const migrationAvailable = locationChanged && sourceUsable;

    setMigrationSnapshot(migrationAvailable
      ? { source: previousFull, target: nextFull, createdAt: Date.now(), inProgress: false, completed: false }
      : null);

    return { success: true, data: next, migrationAvailable };
  }

  static async testStorageConnection(input: {
    provider?: "local" | "smb" | "sftp" | "ftp";
    smbHost?: string;
    smbShareName?: string;
    smbDomain?: string;
    smbUsername?: string;
    smbPassword?: string;
    smbBasePath?: string;
    sftpHost?: string;
    sftpPort?: number;
    sftpUsername?: string;
    sftpPassword?: string;
    sftpBasePath?: string;
    ftpHost?: string;
    ftpPort?: number;
    ftpUsername?: string;
    ftpPassword?: string;
    ftpBasePath?: string;
    ftpSecure?: boolean;
    userId?: number;
  } = {}) {
    const current = (await this.getStorageSettings()).data;
    const provider = input.provider ?? current.provider;
    const trimmedSmbPassword = input.smbPassword?.trim() ?? "";
    const trimmedSftpPassword = input.sftpPassword?.trim() ?? "";
    const trimmedFtpPassword = input.ftpPassword?.trim() ?? "";

    if (provider === "local") {
      return { success: true, message: "Local storage is available", data: { provider } };
    }

    const smb = {
      host: input.smbHost?.trim() ?? current.smb.host,
      shareName: input.smbShareName?.trim() ?? current.smb.shareName,
      domain: input.smbDomain?.trim() ?? current.smb.domain,
      username: input.smbUsername?.trim() ?? current.smb.username,
      password: "",
      basePath: input.smbBasePath?.trim() ?? current.smb.basePath,
    };
    const smbCredentialChanged = (
      smb.host !== current.smb.host ||
      smb.shareName !== current.smb.shareName ||
      smb.domain !== current.smb.domain ||
      smb.username !== current.smb.username
    );
    smb.password = trimmedSmbPassword
      ? trimmedSmbPassword
      : smbCredentialChanged
        ? ""
        : await getSecretConfigValue("storage_smb_password");

    if (provider === "smb") {
      if (!smb.host || !smb.shareName || !smb.username || !smb.password) {
        return { success: false, message: "SMB host, share name, username and password are required", data: { provider } };
      }

      try {
        await testSmbStorageConnection(smb);
        SystemEventUtil.log({ eventType: 'STORAGE', eventName: 'storage-smb-test', status: 'success', message: 'SMB storage connection verified', triggeredBy: input.userId ? `user:${input.userId}` : 'system', details: { host: smb.host, shareName: smb.shareName } });
        return { success: true, message: "SMB storage connection verified", data: { provider } };
      } catch (error) {
        const message = error instanceof Error ? error.message : "SMB storage connection failed";
        const details = error instanceof SmbStorageTestError ? error.details : undefined;
        SystemEventUtil.log({ eventType: 'STORAGE', eventName: 'storage-smb-test', status: 'failed', message, triggeredBy: input.userId ? `user:${input.userId}` : 'system', details: { host: smb.host, shareName: smb.shareName, phase: details?.phase, targetPath: details?.targetPath } });
        return { success: false, message, data: { provider, details } };
      }
    }

    const ftpPort = Number(input.ftpPort ?? current.ftp.port);
    const ftp = {
      host: input.ftpHost?.trim() ?? current.ftp.host,
      port: Number.isInteger(ftpPort) && ftpPort > 0 ? ftpPort : current.ftp.port,
      username: input.ftpUsername?.trim() ?? current.ftp.username,
      password: "",
      basePath: input.ftpBasePath?.trim() ?? current.ftp.basePath,
      secure: input.ftpSecure ?? current.ftp.secure,
      encryptDataChannel: true,
    };
    const ftpCredentialChanged = (
      ftp.host !== current.ftp.host ||
      ftp.port !== current.ftp.port ||
      ftp.username !== current.ftp.username
    );
    ftp.password = trimmedFtpPassword
      ? trimmedFtpPassword
      : ftpCredentialChanged
        ? ""
        : await getSecretConfigValue("storage_ftp_password");

    if (provider === "ftp") {
      if (!ftp.host || !ftp.port || !ftp.username || !ftp.password || !ftp.basePath) {
        return { success: false, message: "FTP host, port, username, password and base path are required", data: { provider } };
      }

      try {
        await testFtpStorageConnection(ftp);
        SystemEventUtil.log({ eventType: 'STORAGE', eventName: 'storage-ftp-test', status: 'success', message: 'FTP storage connection verified', triggeredBy: input.userId ? `user:${input.userId}` : 'system', details: { host: ftp.host, port: ftp.port, basePath: ftp.basePath, secure: ftp.secure } });
        return { success: true, message: "FTP storage connection verified", data: { provider } };
      } catch (error) {
        const message = error instanceof Error ? error.message : "FTP storage connection failed";
        SystemEventUtil.log({ eventType: 'STORAGE', eventName: 'storage-ftp-test', status: 'failed', message, triggeredBy: input.userId ? `user:${input.userId}` : 'system', details: { host: ftp.host, port: ftp.port, basePath: ftp.basePath, secure: ftp.secure } });
        return { success: false, message, data: { provider } };
      }
    }

    const sftpPort = Number(input.sftpPort ?? current.sftp.port);
    const sftp = {
      host: input.sftpHost?.trim() ?? current.sftp.host,
      port: Number.isInteger(sftpPort) && sftpPort > 0 ? sftpPort : current.sftp.port,
      username: input.sftpUsername?.trim() ?? current.sftp.username,
      password: "",
      basePath: input.sftpBasePath?.trim() ?? current.sftp.basePath,
    };
    const sftpCredentialChanged = (
      sftp.host !== current.sftp.host ||
      sftp.port !== current.sftp.port ||
      sftp.username !== current.sftp.username
    );
    sftp.password = trimmedSftpPassword
      ? trimmedSftpPassword
      : sftpCredentialChanged
        ? ""
        : await getSecretConfigValue("storage_sftp_password");

    if (!sftp.host || !sftp.port || !sftp.username || !sftp.password || !sftp.basePath) {
      return { success: false, message: "SFTP host, port, username, password and base path are required", data: { provider } };
    }

    try {
      await testSftpStorageConnection(sftp);
      SystemEventUtil.log({ eventType: 'STORAGE', eventName: 'storage-sftp-test', status: 'success', message: 'SFTP storage connection verified', triggeredBy: input.userId ? `user:${input.userId}` : 'system', details: { host: sftp.host, port: sftp.port, basePath: sftp.basePath } });
      return { success: true, message: "SFTP storage connection verified", data: { provider } };
    } catch (error) {
      const message = error instanceof Error ? error.message : "SFTP storage connection failed";
      SystemEventUtil.log({ eventType: 'STORAGE', eventName: 'storage-sftp-test', status: 'failed', message, triggeredBy: input.userId ? `user:${input.userId}` : 'system', details: { host: sftp.host, port: sftp.port, basePath: sftp.basePath } });
      return { success: false, message, data: { provider } };
    }
  }

  static getStorageMigrationStatus() {
    const snapshot = getMigrationSnapshot();

    if (!snapshot) {
      return { success: true, data: { available: false, inProgress: false, completed: false } };
    }

    return {
      success: true,
      data: {
        available: true,
        inProgress: snapshot.inProgress,
        completed: snapshot.completed,
        from: snapshot.source.provider,
        to: snapshot.target.provider,
      },
    };
  }

  static async scanStorageMigration(input: { userId?: number } = {}) {
    const snapshot = getMigrationSnapshot();

    if (!snapshot || snapshot.completed) {
      return { success: false, message: "ไม่มีรายการ migration ที่รอดำเนินการ" };
    }

    const sourceAdapter = buildStorageAdapter(snapshot.source);

    try {
      const files = await sourceAdapter.listFiles();
      const groups = new Map<string, { fileCount: number; totalSize: number }>();
      let totalSize = 0;

      for (const file of files) {
        const slashIndex = file.path.indexOf("/");
        const topLevel = slashIndex === -1 ? "(root)" : file.path.slice(0, slashIndex);
        const group = groups.get(topLevel) ?? { fileCount: 0, totalSize: 0 };
        group.fileCount += 1;
        group.totalSize += file.size;
        groups.set(topLevel, group);
        totalSize += file.size;
      }

      return {
        success: true,
        data: {
          from: snapshot.source.provider,
          to: snapshot.target.provider,
          totalFiles: files.length,
          totalSize,
          paths: Array.from(groups.entries())
            .map(([path, group]) => ({ path, ...group }))
            .sort((a, b) => b.totalSize - a.totalSize),
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to scan source storage";
      SystemEventUtil.log({ eventType: 'STORAGE', eventName: 'storage-migration-scan', status: 'failed', message, triggeredBy: input.userId ? `user:${input.userId}` : 'system' });
      return { success: false, message };
    } finally {
      await sourceAdapter.close();
    }
  }

  static async runStorageMigration(options: {
    userId?: number;
    conflictPolicy?: StorageMigrationConflictPolicy;
    send: (event: string, data: unknown) => void;
    signal: AbortSignal;
  }) {
    const { send, signal, userId } = options;
    const conflictPolicy = options.conflictPolicy ?? "skip";
    const snapshot = getMigrationSnapshot();

    if (!snapshot) {
      send("stream-error", { message: "ไม่มีรายการ migration ที่รอดำเนินการ" });
      return;
    }
    if (snapshot.inProgress) {
      send("stream-error", { message: "Migration กำลังทำงานอยู่แล้ว" });
      return;
    }
    if (snapshot.completed) {
      send("stream-error", { message: "Migration นี้เสร็จสิ้นไปแล้ว" });
      return;
    }

    setMigrationSnapshot({ ...snapshot, inProgress: true });

    const source = buildStorageAdapter(snapshot.source);
    const target = buildStorageAdapter(snapshot.target);
    const startedAt = Date.now();
    const triggeredBy = userId ? `user:${userId}` : "system";
    const direction = { from: snapshot.source.provider, to: snapshot.target.provider };

    try {
      const files = await source.listFiles();
      const totalSize = files.reduce((sum, file) => sum + file.size, 0);
      send("start", { total: files.length, totalSize, conflictPolicy });
      SystemEventUtil.log({ eventType: 'STORAGE', eventName: 'storage-migration-start', status: 'running', message: `Migrating ${files.length} file(s) from ${direction.from} to ${direction.to}`, triggeredBy, details: { ...direction, totalFiles: files.length, totalSize, conflictPolicy } });

      let migrated = 0;
      let migratedSize = 0;
      let skipped = 0;
      const migratedPaths: string[] = [];

      for (const file of files) {
        if (signal.aborted) {
          SystemEventUtil.log({ eventType: 'STORAGE', eventName: 'storage-migration-aborted', status: 'failed', durationMs: Date.now() - startedAt, message: `Migration aborted after ${migrated}/${files.length} file(s)`, triggeredBy, details: { ...direction, migrated, total: files.length } });
          setMigrationSnapshot({ ...snapshot, inProgress: false });
          return;
        }

        const slashIndex = file.path.lastIndexOf("/");
        const directory = slashIndex === -1 ? "" : file.path.slice(0, slashIndex);
        const fileName = slashIndex === -1 ? file.path : file.path.slice(slashIndex + 1);

        try {
          const existsOnTarget = await target.publicFileExists(file.path);

          if (existsOnTarget && conflictPolicy === "fail") {
            throw new Error("Target file already exists");
          }

          if (existsOnTarget && conflictPolicy === "skip") {
            skipped += 1;
            send("progress", { path: file.path, size: file.size, migrated, skipped, total: files.length, migratedSize, totalSize });
            continue;
          }

          const blob = await source.getPublicFile(file.path);
          if (!blob) throw new Error("Source file not found");
          await target.writePublicFile({ directory, fileName, data: blob });
          migrated += 1;
          migratedSize += file.size;
          migratedPaths.push(file.path);
          send("progress", { path: file.path, size: file.size, migrated, skipped, total: files.length, migratedSize, totalSize });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown error";
          send("file-error", { path: file.path, message });
          send("done", { success: false, migrated, skipped, total: files.length, path: file.path, message });

          SystemEventUtil.log({ eventType: 'STORAGE', eventName: 'storage-migration-failed', status: 'failed', durationMs: Date.now() - startedAt, message: `Migration stopped at ${file.path}: ${message}`, triggeredBy, details: { ...direction, migrated, skipped, total: files.length, failedPath: file.path, conflictPolicy } });
          ActivityLogUtil.log({ userId, action: 'UPDATE', resourceType: 'storage_migration', status: 'failed', description: `Storage migration stopped at ${file.path}`, metadata: { ...direction, migrated, skipped, total: files.length, conflictPolicy } });

          setMigrationSnapshot({ ...snapshot, inProgress: false });
          return;
        }
      }

      setMigrationSnapshot({ ...snapshot, inProgress: false, completed: true, migratedPaths, skipped });
      send("done", { success: true, migrated, skipped, total: files.length });

      SystemEventUtil.log({ eventType: 'STORAGE', eventName: 'storage-migration-done', status: 'success', durationMs: Date.now() - startedAt, message: `Migrated ${migrated} file(s) from ${direction.from} to ${direction.to}`, triggeredBy, details: { ...direction, migrated, skipped, total: files.length, totalSize, conflictPolicy } });
      ActivityLogUtil.log({ userId, action: 'UPDATE', resourceType: 'storage_migration', description: `Migrated ${migrated} file(s) from ${direction.from} to ${direction.to}`, metadata: { ...direction, migrated, skipped, total: files.length, totalSize, conflictPolicy } });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Migration failed";
      send("stream-error", { message });
      setMigrationSnapshot({ ...snapshot, inProgress: false });
      SystemEventUtil.log({ eventType: 'STORAGE', eventName: 'storage-migration-failed', status: 'failed', durationMs: Date.now() - startedAt, message, triggeredBy, details: direction });
    } finally {
      await source.close();
      await target.close();
    }
  }

  static async cleanupStorageMigration(input: { userId?: number; deleteSource: boolean }) {
    const snapshot = getMigrationSnapshot();

    if (!snapshot || !snapshot.completed) {
      return { success: false, message: "ยังไม่มี migration ที่เสร็จสมบูรณ์ให้ cleanup" };
    }

    const direction = { from: snapshot.source.provider, to: snapshot.target.provider };
    let deleted = 0;

    if (input.deleteSource) {
      const source = buildStorageAdapter(snapshot.source);

      try {
        const paths = snapshot.migratedPaths
          ? snapshot.migratedPaths
          : (await source.listFiles()).map((file) => file.path);

        for (const path of paths) {
          const ok = await source.deletePublicFile(`/uploads/${path}`);
          if (ok) deleted += 1;
        }

        SystemEventUtil.log({ eventType: 'STORAGE', eventName: 'storage-migration-cleanup', status: 'success', message: `Deleted ${deleted} file(s) from previous ${snapshot.source.provider} storage`, triggeredBy: input.userId ? `user:${input.userId}` : 'system', details: { ...direction, deleted, total: paths.length, skipped: snapshot.skipped ?? 0 } });
        ActivityLogUtil.log({ userId: input.userId, action: 'DELETE', resourceType: 'storage_migration', description: `Deleted ${deleted} file(s) from previous ${snapshot.source.provider} storage after migration`, metadata: { ...direction, deleted, total: paths.length, skipped: snapshot.skipped ?? 0 } });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to delete old files";
        SystemEventUtil.log({ eventType: 'STORAGE', eventName: 'storage-migration-cleanup', status: 'failed', message, triggeredBy: input.userId ? `user:${input.userId}` : 'system', details: direction });
        return { success: false, message };
      } finally {
        await source.close();
      }
    } else {
      ActivityLogUtil.log({ userId: input.userId, action: 'UPDATE', resourceType: 'storage_migration', description: `Kept previous ${snapshot.source.provider} storage data after migration`, metadata: direction });
    }

    setMigrationSnapshot(null);
    return { success: true, data: { deleted } };
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

}
