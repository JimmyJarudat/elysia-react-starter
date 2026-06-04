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

export type SystemIdentity = {
  systemName: string;
  systemSubtitle: string;
  logoUrl: string;
  faviconUrl: string;
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

const defaults: SystemIdentity = {
  systemName: "IT Utils",
  systemSubtitle: "Internal tools and admin workspace",
  logoUrl: "",
  faviconUrl: "",
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
      category: "SYSTEM_IDENTITY",
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
      category: "SYSTEM_IDENTITY",
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
      getConfigValue(identityKeys.systemName, defaults.systemName),
      getConfigValue(identityKeys.systemSubtitle, defaults.systemSubtitle),
      getConfigValue(identityKeys.logoUrl, defaults.logoUrl),
      getConfigValue(identityKeys.faviconUrl, defaults.faviconUrl),
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
      upsertConfig(identityKeys.systemName, next.systemName, "System Name", "Primary application name", input.userId),
      upsertConfig(identityKeys.systemSubtitle, next.systemSubtitle, "System Subtitle", "Short application subtitle", input.userId),
      upsertConfig(identityKeys.logoUrl, next.logoUrl, "System Logo URL", "Application logo path or URL", input.userId),
      upsertConfig(identityKeys.faviconUrl, next.faviconUrl, "System Favicon URL", "Browser favicon path or URL", input.userId),
    ]);

    return { success: true, data: next };
  }
}
