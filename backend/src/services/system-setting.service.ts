import { mkdir, unlink } from "node:fs/promises";
import { extname, isAbsolute, join, relative } from "node:path";
import prisma from "@/config/prisma.config";

const UPLOAD_ROOT = join(process.cwd(), "uploads");
const SYSTEM_UPLOAD_DIR = join(UPLOAD_ROOT, "system");

const identityKeys = {
  systemName: "system_name",
  systemSubtitle: "system_subtitle",
  appTitle: "app_title",
  titleMode: "app_title_mode",
  logoUrl: "system_logo_url",
  faviconUrl: "system_favicon_url",
} as const;

const titleModes = new Set(["title_only", "title_section"]);

const organizationKeys = {
  organizationName: "organization_name",
  supportEmail: "support_email",
  websiteUrl: "website_url",
  helpCenterUrl: "help_center_url",
} as const;

const registrationKeys = {
  enabled: "self_registration_enabled",
  requireApproval: "registration_requires_approval",
  defaultRole: "registration_default_role",
} as const;

export type SystemIdentity = {
  systemName: string;
  systemSubtitle: string;
  appTitle: string;
  titleMode: "title_only" | "title_section";
  logoUrl: string;
  faviconUrl: string;
};

export type OrganizationSupport = {
  organizationName: string;
  supportEmail: string;
  websiteUrl: string;
  helpCenterUrl: string;
};

export type RegistrationApproval = {
  enabled: boolean;
  requireApproval: boolean;
  defaultRole: string;
};

type UpdateIdentityInput = {
  systemName?: string;
  systemSubtitle?: string;
  appTitle?: string;
  titleMode?: "title_only" | "title_section";
  logoUrl?: string;
  faviconUrl?: string;
  logo?: File;
  favicon?: File;
  userId?: number;
};

type UpdateOrganizationSupportInput = Partial<OrganizationSupport> & {
  userId?: number;
};

type UpdateRegistrationApprovalInput = Partial<RegistrationApproval> & {
  userId?: number;
};

const identityDefaults: SystemIdentity = {
  systemName: "IT Utils",
  systemSubtitle: "Internal tools and admin workspace",
  appTitle: "IT Utils",
  titleMode: "title_only",
  logoUrl: "",
  faviconUrl: "",
};

const organizationDefaults: OrganizationSupport = {
  organizationName: "",
  supportEmail: "",
  websiteUrl: "",
  helpCenterUrl: "/help",
};

const registrationDefaults: RegistrationApproval = {
  enabled: false,
  requireApproval: true,
  defaultRole: "USER",
};

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

const getConfigValue = async (id: string, fallback: string) => {
  const row = await prisma.system_config.findUnique({
    where: { id },
    select: { value: true, is_active: true },
  });

  return row?.is_active ? row.value : fallback;
};

const getBooleanConfigValue = async (id: string, fallback: boolean) => {
  const value = await getConfigValue(id, String(fallback));
  return value === "true";
};

const upsertConfig = async (
  id: string,
  value: string,
  displayName: string,
  description: string,
  category: string,
  userId?: number,
) => {
  const modifiedByData = userId && userId > 0
    ? { last_modified_by_id: userId }
    : {};

  await prisma.system_config.upsert({
    where: { id },
    update: {
      value,
      display_name: displayName,
      description,
      category,
      data_type: "STRING",
      is_active: true,
      is_encrypted: false,
      ...modifiedByData,
      updated_at: new Date(),
    },
    create: {
      id,
      value,
      display_name: displayName,
      description,
      category,
      data_type: "STRING",
      is_active: true,
      is_encrypted: false,
      ...modifiedByData,
    },
  });
};

const saveUpload = async (file: File, prefix: "logo" | "favicon") => {
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
  const absolutePath = join(SYSTEM_UPLOAD_DIR, fileName);

  await mkdir(SYSTEM_UPLOAD_DIR, { recursive: true });
  await Bun.write(absolutePath, file);

  return `/uploads/system/${fileName}`;
};

const getSystemUploadPath = (value: string) => {
  if (!value.startsWith("/uploads/system/")) {
    return null;
  }

  const fileName = value.split("/").pop();
  if (!fileName) {
    return null;
  }

  const absolutePath = join(SYSTEM_UPLOAD_DIR, fileName);
  const relativePath = relative(SYSTEM_UPLOAD_DIR, absolutePath);

  if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
    return null;
  }

  return absolutePath;
};

const deleteSystemUpload = async (value: string) => {
  const absolutePath = getSystemUploadPath(value);
  if (!absolutePath) {
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

export class SystemSettingService {
  static async getIdentity(): Promise<{ success: true; data: SystemIdentity }> {
    const [systemName, systemSubtitle, appTitle, rawTitleMode, logoUrl, faviconUrl] = await Promise.all([
      getConfigValue(identityKeys.systemName, identityDefaults.systemName),
      getConfigValue(identityKeys.systemSubtitle, identityDefaults.systemSubtitle),
      getConfigValue(identityKeys.appTitle, identityDefaults.appTitle),
      getConfigValue(identityKeys.titleMode, identityDefaults.titleMode),
      getConfigValue(identityKeys.logoUrl, identityDefaults.logoUrl),
      getConfigValue(identityKeys.faviconUrl, identityDefaults.faviconUrl),
    ]);
    const titleMode = titleModes.has(rawTitleMode)
      ? rawTitleMode as SystemIdentity["titleMode"]
      : identityDefaults.titleMode;

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

  static async updateIdentity(input: UpdateIdentityInput) {
    const current = (await this.getIdentity()).data;
    const logoUrl = input.logo ? await saveUpload(input.logo, "logo") : input.logoUrl ?? current.logoUrl;
    const faviconUrl = input.favicon ? await saveUpload(input.favicon, "favicon") : input.faviconUrl ?? current.faviconUrl;

    const next: SystemIdentity = {
      systemName: input.systemName?.trim() || current.systemName,
      systemSubtitle: input.systemSubtitle?.trim() ?? current.systemSubtitle,
      appTitle: input.appTitle?.trim() || current.appTitle || input.systemName?.trim() || current.systemName,
      titleMode: input.titleMode && titleModes.has(input.titleMode) ? input.titleMode : current.titleMode,
      logoUrl,
      faviconUrl,
    };

    await Promise.all([
      upsertConfig(identityKeys.systemName, next.systemName, "System Name", "Primary application name", "SYSTEM_IDENTITY", input.userId),
      upsertConfig(identityKeys.systemSubtitle, next.systemSubtitle, "System Subtitle", "Short application subtitle", "SYSTEM_IDENTITY", input.userId),
      upsertConfig(identityKeys.appTitle, next.appTitle, "App Title", "Browser document title", "SYSTEM_IDENTITY", input.userId),
      upsertConfig(identityKeys.titleMode, next.titleMode, "App Title Mode", "Browser title display mode", "SYSTEM_IDENTITY", input.userId),
      upsertConfig(identityKeys.logoUrl, next.logoUrl, "System Logo URL", "Application logo path or URL", "SYSTEM_IDENTITY", input.userId),
      upsertConfig(identityKeys.faviconUrl, next.faviconUrl, "System Favicon URL", "Browser favicon path or URL", "SYSTEM_IDENTITY", input.userId),
    ]);

    await Promise.all([
      current.logoUrl && current.logoUrl !== next.logoUrl ? deleteSystemUpload(current.logoUrl) : Promise.resolve(),
      current.faviconUrl && current.faviconUrl !== next.faviconUrl ? deleteSystemUpload(current.faviconUrl) : Promise.resolve(),
    ]);

    return { success: true, data: next };
  }

  static async getOrganizationSupport(): Promise<{ success: true; data: OrganizationSupport }> {
    const [organizationName, supportEmail, websiteUrl, helpCenterUrl] = await Promise.all([
      getConfigValue(organizationKeys.organizationName, organizationDefaults.organizationName),
      getConfigValue(organizationKeys.supportEmail, organizationDefaults.supportEmail),
      getConfigValue(organizationKeys.websiteUrl, organizationDefaults.websiteUrl),
      getConfigValue(organizationKeys.helpCenterUrl, organizationDefaults.helpCenterUrl),
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

  static async updateOrganizationSupport(input: UpdateOrganizationSupportInput) {
    const current = (await this.getOrganizationSupport()).data;
    const next: OrganizationSupport = {
      organizationName: input.organizationName?.trim() ?? current.organizationName,
      supportEmail: input.supportEmail?.trim() ?? current.supportEmail,
      websiteUrl: input.websiteUrl?.trim() ?? current.websiteUrl,
      helpCenterUrl: input.helpCenterUrl?.trim() || current.helpCenterUrl,
    };

    await Promise.all([
      upsertConfig(organizationKeys.organizationName, next.organizationName, "Organization Name", "Organization display name", "ORGANIZATION", input.userId),
      upsertConfig(organizationKeys.supportEmail, next.supportEmail, "Support Email", "Support contact email", "ORGANIZATION", input.userId),
      upsertConfig(organizationKeys.websiteUrl, next.websiteUrl, "Website URL", "Organization website URL", "ORGANIZATION", input.userId),
      upsertConfig(organizationKeys.helpCenterUrl, next.helpCenterUrl, "Help Center URL", "Help center path or URL", "ORGANIZATION", input.userId),
    ]);

    return { success: true, data: next };
  }

  static async getRegistrationApproval(): Promise<{ success: true; data: RegistrationApproval }> {
    const [enabled, requireApproval, defaultRole] = await Promise.all([
      getBooleanConfigValue(registrationKeys.enabled, registrationDefaults.enabled),
      getBooleanConfigValue(registrationKeys.requireApproval, registrationDefaults.requireApproval),
      getConfigValue(registrationKeys.defaultRole, registrationDefaults.defaultRole),
    ]);

    return {
      success: true,
      data: {
        enabled,
        requireApproval,
        defaultRole: defaultRole.trim() || registrationDefaults.defaultRole,
      },
    };
  }

  static async updateRegistrationApproval(input: UpdateRegistrationApprovalInput) {
    const current = (await this.getRegistrationApproval()).data;
    const defaultRole = input.defaultRole?.trim().toUpperCase() || current.defaultRole;

    const role = await prisma.roles.findUnique({
      where: { id: defaultRole },
      select: { id: true },
    });

    if (!role) {
      throw new Error(`Role "${defaultRole}" not found`);
    }

    const next: RegistrationApproval = {
      enabled: input.enabled ?? current.enabled,
      requireApproval: input.requireApproval ?? current.requireApproval,
      defaultRole,
    };

    await Promise.all([
      upsertConfig(registrationKeys.enabled, String(next.enabled), "Self Registration", "Allow users to register from the login page", "REGISTRATION", input.userId),
      upsertConfig(registrationKeys.requireApproval, String(next.requireApproval), "Require Approval", "Require admin approval for self-registered users", "REGISTRATION", input.userId),
      upsertConfig(registrationKeys.defaultRole, next.defaultRole, "Default Registration Role", "Default role assigned to self-registered users", "REGISTRATION", input.userId),
    ]);

    return { success: true, data: next };
  }

  // ─── Maintenance ─────────────────────────────────────────────────────────────

  static async getMaintenance() {
    const [mode, message] = await Promise.all([
      getConfigValue("maintenance_mode",    "false"),
      getConfigValue("maintenance_message", ""),
    ]);
    return {
      success: true,
      data: { enabled: mode === "true", message },
    };
  }

  static async updateMaintenance(input: { enabled?: boolean; message?: string; userId?: number }) {
    const current = (await this.getMaintenance()).data;
    const next = {
      enabled: input.enabled ?? current.enabled,
      message: input.message ?? current.message,
    };
    await Promise.all([
      upsertConfig("maintenance_mode",    String(next.enabled), "Maintenance Mode",    "Enable maintenance mode to block access",    "MAINTENANCE", input.userId),
      upsertConfig("maintenance_message", next.message,         "Maintenance Message", "Message shown to users during maintenance",  "MAINTENANCE", input.userId),
    ]);
    return { success: true, data: next };
  }

  // ─── Regional ────────────────────────────────────────────────────────────────

  static async getRegional() {
    const [timezone, dateFormat, timeFormat, yearEra] = await Promise.all([
      getConfigValue("timezone",    "Asia/Bangkok"),
      getConfigValue("date_format", "DD/MM/YYYY"),
      getConfigValue("time_format", "24h"),
      getConfigValue("year_era",    "CE"),
    ]);
    return {
      success: true,
      data: { timezone, dateFormat, timeFormat, yearEra: yearEra as "CE" | "BE" },
    };
  }

  static async updateRegional(input: {
    timezone?: string; dateFormat?: string; timeFormat?: string;
    yearEra?: "CE" | "BE"; userId?: number;
  }) {
    const current = (await this.getRegional()).data;
    const next = {
      timezone:   input.timezone   ?? current.timezone,
      dateFormat: input.dateFormat ?? current.dateFormat,
      timeFormat: input.timeFormat ?? current.timeFormat,
      yearEra:    input.yearEra    ?? current.yearEra,
    };
    await Promise.all([
      upsertConfig("timezone",    next.timezone,   "Timezone",    "System timezone",                                    "REGIONAL", input.userId),
      upsertConfig("date_format", next.dateFormat, "Date Format", "System date display format",                         "REGIONAL", input.userId),
      upsertConfig("time_format", next.timeFormat, "Time Format", "System time display format (24h or 12h)",             "REGIONAL", input.userId),
      upsertConfig("year_era",    next.yearEra,    "Year Era",    "Year era: CE (Christian/ค.ศ.) or BE (Buddhist/พ.ศ.)", "REGIONAL", input.userId),
    ]);
    return { success: true, data: next };
  }
}
