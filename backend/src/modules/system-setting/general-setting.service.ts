import { extname } from "node:path";
import prisma from "@/config/prisma.config";
import {
  getSettingValue as getBooleanConfigValue,
  getSettingValue as getConfigValue,
  upsertSettingValue as upsertConfig,
} from "@/utils/get-setting-value";
import { ActivityLogUtil } from "@/utils/activity-log";
import { AuditLogUtil } from "@/utils/audit-log";
import { ErrorLogUtil } from "@/utils/error-log";
import { getDefaultStorage } from "@/utils/storage";

export class GeneralSettingService {
  private static buildResourceConfig(input: { type: "GROUPNAME" | "DEPARTMENT"; name: string; description?: string | null }) {
    const name = input.name.trim();
    if (!name) throw new Error("Resource name is required");

    const prefix = input.type === "GROUPNAME" ? "resources:group:" : "resources:department:";
    const label = input.type === "GROUPNAME" ? "Group" : "Department";

    return {
      id: `${prefix}${name}`.slice(0, 50),
      value: name,
      category: input.type,
      displayName: `${label}: ${name}`.slice(0, 100),
      description: input.description?.trim() || `${label} resource`,
    };
  }

  static async getResources() {
    const rows = await prisma.system_config.findMany({
      where: {
        is_active: true,
        category: { in: ["GROUPNAME", "DEPARTMENT"] },
      },
      orderBy: [
        { category: "asc" },
        { display_name: "asc" },
        { value: "asc" },
      ],
      select: {
        id: true,
        value: true,
        description: true,
        category: true,
        display_name: true,
        updated_at: true,
      },
    });

    const mapItem = (item: typeof rows[number]) => ({
      id: item.id,
      name: item.value,
      label: item.display_name || item.value,
      description: item.description || "",
      updatedAt: item.updated_at,
    });

    return {
      success: true,
      data: {
        groups: rows.filter((item) => item.category === "GROUPNAME").map(mapItem),
        departments: rows.filter((item) => item.category === "DEPARTMENT").map(mapItem),
      },
    };
  }

  static async createResource(input: {
    type: "GROUPNAME" | "DEPARTMENT";
    name: string;
    description?: string | null;
    userId?: number;
  }) {
    const resource = this.buildResourceConfig(input);
    const existing = await prisma.system_config.findUnique({ where: { id: resource.id } });

    if (existing?.is_active) {
      throw new Error(`${input.type === "GROUPNAME" ? "Group name" : "Department"} already exists`);
    }

    const saved = await prisma.system_config.upsert({
      where: { id: resource.id },
      update: {
        value: resource.value,
        description: resource.description,
        category: resource.category,
        display_name: resource.displayName,
        data_type: "STRING",
        is_active: true,
        is_encrypted: false,
        last_modified_by_id: input.userId,
        updated_at: new Date(),
      },
      create: {
        id: resource.id,
        value: resource.value,
        description: resource.description,
        category: resource.category,
        display_name: resource.displayName,
        data_type: "STRING",
        is_active: true,
        is_encrypted: false,
        last_modified_by_id: input.userId,
      },
    });

    ActivityLogUtil.log({ userId: input.userId, action: "CREATE", resourceType: "system_config", resourceId: saved.id, description: `Created ${resource.category} resource ${resource.value}` });
    return { success: true, data: saved };
  }

  static async updateResource(id: string, input: {
    type: "GROUPNAME" | "DEPARTMENT";
    name: string;
    description?: string | null;
    userId?: number;
  }) {
    const current = await prisma.system_config.findUnique({ where: { id } });
    if (!current || !current.is_active || !["GROUPNAME", "DEPARTMENT"].includes(current.category)) {
      throw new Error("Resource not found");
    }

    const next = this.buildResourceConfig(input);
    if (next.id !== id) {
      const conflict = await prisma.system_config.findUnique({ where: { id: next.id } });
      if (conflict?.is_active) throw new Error(`${input.type === "GROUPNAME" ? "Group name" : "Department"} already exists`);
    }

    const saved = await prisma.$transaction(async (tx) => {
      if (next.id === id) {
        return tx.system_config.update({
          where: { id },
          data: {
            value: next.value,
            description: next.description,
            category: next.category,
            display_name: next.displayName,
            last_modified_by_id: input.userId,
            updated_at: new Date(),
          },
        });
      }

      await tx.system_config.update({
        where: { id },
        data: { is_active: false, last_modified_by_id: input.userId, updated_at: new Date() },
      });

      return tx.system_config.upsert({
        where: { id: next.id },
        update: {
          value: next.value,
          description: next.description,
          category: next.category,
          display_name: next.displayName,
          data_type: "STRING",
          is_active: true,
          is_encrypted: false,
          last_modified_by_id: input.userId,
          updated_at: new Date(),
        },
        create: {
          id: next.id,
          value: next.value,
          description: next.description,
          category: next.category,
          display_name: next.displayName,
          data_type: "STRING",
          is_active: true,
          is_encrypted: false,
          last_modified_by_id: input.userId,
        },
      });
    });

    ActivityLogUtil.log({ userId: input.userId, action: "UPDATE", resourceType: "system_config", resourceId: saved.id, description: `Updated ${next.category} resource ${next.value}` });
    AuditLogUtil.log({ userId: input.userId, action: "UPDATE", tableName: "system_config", recordId: saved.id, beforeData: current, afterData: saved });
    return { success: true, data: saved };
  }

  static async deleteResource(id: string, userId?: number) {
    const current = await prisma.system_config.findUnique({ where: { id } });
    if (!current || !current.is_active || !["GROUPNAME", "DEPARTMENT"].includes(current.category)) {
      throw new Error("Resource not found");
    }

    await prisma.system_config.update({
      where: { id },
      data: { is_active: false, last_modified_by_id: userId, updated_at: new Date() },
    });

    ActivityLogUtil.log({ userId, action: "DELETE", resourceType: "system_config", resourceId: id, description: `Deleted ${current.category} resource ${current.value}` });
    AuditLogUtil.log({ userId, action: "DELETE", tableName: "system_config", recordId: id, beforeData: current });
    return { success: true };
  }

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

      return getDefaultStorage().writePublicFile({
        directory: "system",
        fileName,
        data: file,
      });
    };

    const deleteSystemUpload = async (value: string) => {
      if (!value.startsWith("/uploads/system/")) {
        return;
      }

      try {
        await getDefaultStorage().deletePublicFile(value, "system");
      } catch (error) {
        if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
          return;
        }

        console.warn(`[SystemSetting] Failed to delete old upload: ${value}`, error);
        ErrorLogUtil.log(error, { level: "warn", source: "system-setting:delete-old-upload", userId: input.userId, context: { value } });
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

    const current = (await this.getNotificationSound()).data;
    const safeExt = audioExtensions.has(ext) ? ext : ".mp3";
    const fileName = `notification-sound-${Date.now()}-${crypto.randomUUID()}${safeExt}`;
    const newUrl = await getDefaultStorage().writePublicFile({
      directory: "system",
      fileName,
      data: input.sound,
    });

    await upsertConfig("notification_sound_url", newUrl, "Notification Sound URL", "Custom notification sound file path", "SYSTEM_IDENTITY", input.userId);

    if (current.soundUrl?.startsWith("/uploads/system/") && current.soundUrl !== newUrl) {
      try { await getDefaultStorage().deletePublicFile(current.soundUrl, "system"); } catch { /* ignore */ }
    }

    ActivityLogUtil.log({ userId: input.userId, action: 'UPDATE', resourceType: 'system_config', description: 'Uploaded notification sound' });
    AuditLogUtil.log({ userId: input.userId, action: 'UPDATE', tableName: 'system_config', recordId: 'notification_sound_url', beforeData: current, afterData: { soundUrl: newUrl } });
    return { success: true, data: { soundUrl: newUrl } };
  }

  static async deleteNotificationSound(userId?: number) {
    const current = (await this.getNotificationSound()).data;
    if (current.soundUrl?.startsWith("/uploads/system/")) {
      try { await getDefaultStorage().deletePublicFile(current.soundUrl, "system"); } catch { /* ignore */ }
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
      return getDefaultStorage().writePublicFile({
        directory: "system",
        fileName,
        data: file,
      });
    };

    const deleteOrganizationLogo = async (value: string) => {
      if (!value.startsWith("/uploads/system/organization-logo-")) return;

      try {
        await getDefaultStorage().deletePublicFile(value, "system");
      } catch (error) {
        if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) {
          console.warn(`[SystemSetting] Failed to delete old organization logo: ${value}`, error);
          ErrorLogUtil.log(error, { level: "warn", source: "system-setting:delete-old-organization-logo", userId: input.userId, context: { value } });
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
