import { mkdir, unlink } from "node:fs/promises";
import { extname, isAbsolute, join, relative } from "node:path";
import prisma from "@/config/prisma.config";
import nodemailer from "nodemailer";
import { EmailManager, reloadSmtp } from "@/config/smtp.config";
import { decryptText, encryptText } from "@/utils/encryption";

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

const smtpKeys = {
  enabled: "smtp_enabled",
  host: "smtp_host",
  port: "smtp_port",
  encryption: "smtp_encryption",
  secure: "smtp_secure",
  requireTLS: "smtp_require_tls",
  user: "smtp_user",
  password: "smtp_password",
  fromName: "smtp_from_name",
  fromEmail: "smtp_from_email",
  appName: "email_app_name",
  appUrl: "email_app_url",
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

export type SmtpSettings = {
  enabled: boolean;
  host: string;
  port: number;
  encryption: "starttls" | "ssl" | "none";
  user: string;
  password?: string;
  hasPassword: boolean;
  fromName: string;
  fromEmail: string;
  appName: string;
  appUrl: string;
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

type UpdateSmtpInput = Partial<Omit<SmtpSettings, "hasPassword">> & {
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

const smtpDefaults: SmtpSettings = {
  enabled: false,
  host: "",
  port: 587,
  encryption: "starttls",
  user: "",
  password: "",
  hasPassword: false,
  fromName: "IT Utilities",
  fromEmail: "",
  appName: "IT Utilities",
  appUrl: "http://localhost:5173",
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

const upsertRawConfig = async (
  id: string,
  value: string,
  displayName: string,
  description: string,
  category: string,
  dataType: "STRING" | "NUMBER" | "BOOLEAN" = "STRING",
  isEncrypted = false,
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
      data_type: dataType,
      is_active: true,
      is_encrypted: isEncrypted,
      ...modifiedByData,
      updated_at: new Date(),
    },
    create: {
      id,
      value,
      display_name: displayName,
      description,
      category,
      data_type: dataType,
      is_active: true,
      is_encrypted: isEncrypted,
      ...modifiedByData,
    },
  });
};

const getSystemConfigRow = async (id: string) => prisma.system_config.findUnique({
  where: { id },
  select: { value: true, is_active: true, is_encrypted: true, data_type: true },
});

const getSecretConfigValue = async (id: string) => {
  const row = await getSystemConfigRow(id);
  if (!row?.is_active || !row.value) {
    return "";
  }

  if (!row.is_encrypted) {
    return row.value;
  }

  try {
    return decryptText(row.value);
  } catch {
    return "";
  }
};

const encryptionToTransportFlags = (encryption: SmtpSettings["encryption"]) => ({
  secure: encryption === "ssl",
  requireTLS: encryption === "starttls",
});

const transportFlagsToEncryption = (secure: boolean, requireTLS: boolean): SmtpSettings["encryption"] => {
  if (secure) return "ssl";
  if (requireTLS) return "starttls";
  return "none";
};

const buildSmtpTestConfig = async (input: UpdateSmtpInput) => {
  const current = (await SystemSettingService.getSmtpSettings()).data;
  const encryption = input.encryption ?? current.encryption;
  const { secure, requireTLS } = encryptionToTransportFlags(encryption);
  const port = Number(input.port ?? current.port);
  const password = input.password?.trim()
    ? input.password
    : await getSecretConfigValue(smtpKeys.password);

  return {
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

  static async getSmtpSettings(): Promise<{ success: true; data: SmtpSettings }> {
    const [enabled, host, rawPort, secure, requireTLS, user, password, fromName, fromEmail, appName, appUrl] = await Promise.all([
      getBooleanConfigValue(smtpKeys.enabled, smtpDefaults.enabled),
      getConfigValue(smtpKeys.host, smtpDefaults.host),
      getConfigValue(smtpKeys.port, String(smtpDefaults.port)),
      getBooleanConfigValue(smtpKeys.secure, false),
      getBooleanConfigValue(smtpKeys.requireTLS, true),
      getConfigValue(smtpKeys.user, smtpDefaults.user),
      getSecretConfigValue(smtpKeys.password),
      getConfigValue(smtpKeys.fromName, smtpDefaults.fromName),
      getConfigValue(smtpKeys.fromEmail, smtpDefaults.fromEmail),
      getConfigValue(smtpKeys.appName, smtpDefaults.appName),
      getConfigValue(smtpKeys.appUrl, smtpDefaults.appUrl),
    ]);

    const port = Number.parseInt(rawPort, 10);

    return {
      success: true,
      data: {
        enabled,
        host,
        port: Number.isInteger(port) && port > 0 ? port : smtpDefaults.port,
        encryption: transportFlagsToEncryption(secure, requireTLS),
        user,
        hasPassword: Boolean(password),
        fromName,
        fromEmail,
        appName,
        appUrl,
      },
    };
  }

  static async updateSmtpSettings(input: UpdateSmtpInput) {
    const current = (await this.getSmtpSettings()).data;
    const encryption = input.encryption ?? current.encryption;
    const { secure, requireTLS } = encryptionToTransportFlags(encryption);
    const port = Number(input.port ?? current.port);

    if (input.enabled && !input.host?.trim() && !current.host) {
      throw new Error("SMTP host is required when SMTP is enabled");
    }

    if (input.enabled && !input.fromEmail?.trim() && !current.fromEmail) {
      throw new Error("SMTP from email is required when SMTP is enabled");
    }

    const next: SmtpSettings = {
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
      upsertRawConfig(smtpKeys.enabled, String(next.enabled), "SMTP Enabled", "Enable SMTP email sending", "SMTP", "BOOLEAN", false, input.userId),
      upsertRawConfig(smtpKeys.host, next.host, "SMTP Host", "SMTP host", "SMTP", "STRING", false, input.userId),
      upsertRawConfig(smtpKeys.port, String(next.port), "SMTP Port", "SMTP port", "SMTP", "NUMBER", false, input.userId),
      upsertRawConfig(smtpKeys.encryption, next.encryption, "SMTP Encryption", "SMTP encryption mode", "SMTP", "STRING", false, input.userId),
      upsertRawConfig(smtpKeys.secure, String(secure), "SMTP Secure", "Use secure SMTP connection", "SMTP", "BOOLEAN", false, input.userId),
      upsertRawConfig(smtpKeys.requireTLS, String(requireTLS), "SMTP Require TLS", "Require TLS for SMTP connection", "SMTP", "BOOLEAN", false, input.userId),
      upsertRawConfig(smtpKeys.user, next.user, "SMTP User", "SMTP username", "SMTP", "STRING", false, input.userId),
      upsertRawConfig(smtpKeys.fromName, next.fromName, "SMTP From Name", "SMTP sender display name", "SMTP", "STRING", false, input.userId),
      upsertRawConfig(smtpKeys.fromEmail, next.fromEmail, "SMTP From Email", "SMTP sender email address", "SMTP", "STRING", false, input.userId),
      upsertRawConfig(smtpKeys.appName, next.appName, "Email App Name", "Application name shown in system emails", "SMTP", "STRING", false, input.userId),
      upsertRawConfig(smtpKeys.appUrl, next.appUrl, "Email App URL", "Application URL used in system emails", "SMTP", "STRING", false, input.userId),
    ];

    if (input.password !== undefined && input.password !== "") {
      updates.push(
        upsertRawConfig(smtpKeys.password, encryptText(input.password), "SMTP Password", "SMTP password", "SMTP", "STRING", true, input.userId),
      );
    }

    await Promise.all(updates);
    await reloadSmtp();

    return { success: true, data: { ...next, password: undefined } };
  }

  static async testSmtpConnection(input: UpdateSmtpInput = {}) {
    const config = await buildSmtpTestConfig(input);

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
