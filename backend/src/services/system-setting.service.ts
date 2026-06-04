import { mkdir } from "node:fs/promises";
import { extname, join } from "node:path";
import prisma from "@/config/prisma.config";

const UPLOAD_ROOT = join(process.cwd(), "uploads");
const SYSTEM_UPLOAD_DIR = join(UPLOAD_ROOT, "system");

const identityKeys = {
  systemName: "system_name",
  systemSubtitle: "system_subtitle",
  logoUrl: "system_logo_url",
  faviconUrl: "system_favicon_url",
} as const;

const organizationKeys = {
  organizationName: "organization_name",
  supportEmail: "support_email",
  websiteUrl: "website_url",
  helpCenterUrl: "help_center_url",
} as const;

export type SystemIdentity = {
  systemName: string;
  systemSubtitle: string;
  logoUrl: string;
  faviconUrl: string;
};

export type OrganizationSupport = {
  organizationName: string;
  supportEmail: string;
  websiteUrl: string;
  helpCenterUrl: string;
};

type UpdateIdentityInput = {
  systemName?: string;
  systemSubtitle?: string;
  logoUrl?: string;
  faviconUrl?: string;
  logo?: File;
  favicon?: File;
  userId?: number;
};

type UpdateOrganizationSupportInput = Partial<OrganizationSupport> & {
  userId?: number;
};

const identityDefaults: SystemIdentity = {
  systemName: "IT Utils",
  systemSubtitle: "Internal tools and admin workspace",
  logoUrl: "",
  faviconUrl: "",
};

const organizationDefaults: OrganizationSupport = {
  organizationName: "",
  supportEmail: "",
  websiteUrl: "",
  helpCenterUrl: "/help",
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

export class SystemSettingService {
  static async getIdentity(): Promise<{ success: true; data: SystemIdentity }> {
    const [systemName, systemSubtitle, logoUrl, faviconUrl] = await Promise.all([
      getConfigValue(identityKeys.systemName, identityDefaults.systemName),
      getConfigValue(identityKeys.systemSubtitle, identityDefaults.systemSubtitle),
      getConfigValue(identityKeys.logoUrl, identityDefaults.logoUrl),
      getConfigValue(identityKeys.faviconUrl, identityDefaults.faviconUrl),
    ]);

    return {
      success: true,
      data: {
        systemName,
        systemSubtitle,
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
      logoUrl,
      faviconUrl,
    };

    await Promise.all([
      upsertConfig(identityKeys.systemName, next.systemName, "System Name", "Primary application name", "SYSTEM_IDENTITY", input.userId),
      upsertConfig(identityKeys.systemSubtitle, next.systemSubtitle, "System Subtitle", "Short application subtitle", "SYSTEM_IDENTITY", input.userId),
      upsertConfig(identityKeys.logoUrl, next.logoUrl, "System Logo URL", "Application logo path or URL", "SYSTEM_IDENTITY", input.userId),
      upsertConfig(identityKeys.faviconUrl, next.faviconUrl, "System Favicon URL", "Browser favicon path or URL", "SYSTEM_IDENTITY", input.userId),
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

  // ─── Regional ────────────────────────────────────────────────────────────────

  static async getRegional() {
    const [timezone, dateFormat, timeFormat, maintenanceMode] = await Promise.all([
      getConfigValue("timezone",         "Asia/Bangkok"),
      getConfigValue("date_format",      "DD/MM/YYYY"),
      getConfigValue("time_format",      "24h"),
      getConfigValue("maintenance_mode", "false"),
    ]);

    return {
      success: true,
      data: {
        timezone,
        dateFormat,
        timeFormat,
        maintenanceMode: maintenanceMode === "true",
      },
    };
  }

  static async updateRegional(input: {
    timezone?: string;
    dateFormat?: string;
    timeFormat?: string;
    maintenanceMode?: boolean;
    userId?: number;
  }) {
    const current = (await this.getRegional()).data;

    const next = {
      timezone:        input.timezone        ?? current.timezone,
      dateFormat:      input.dateFormat      ?? current.dateFormat,
      timeFormat:      input.timeFormat      ?? current.timeFormat,
      maintenanceMode: input.maintenanceMode ?? current.maintenanceMode,
    };

    await Promise.all([
      upsertConfig("timezone",         next.timezone,                    "Timezone",         "System timezone",                         "REGIONAL", input.userId),
      upsertConfig("date_format",      next.dateFormat,                  "Date Format",      "System date display format",              "REGIONAL", input.userId),
      upsertConfig("time_format",      next.timeFormat,                  "Time Format",      "System time display format (24h or 12h)", "REGIONAL", input.userId),
      upsertConfig("maintenance_mode", String(next.maintenanceMode),     "Maintenance Mode", "Enable maintenance mode to block access",  "REGIONAL", input.userId),
    ]);

    return { success: true, data: next };
  }
}
