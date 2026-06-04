import prisma from "@/config/prisma.config";

export type EmailTemplateConfig = {
  appName: string;
  appUrl: string;
};

export const emailTemplateConfigKeys = {
  appName: "email_app_name",
  appUrl: "email_app_url",
} as const;

const defaults: EmailTemplateConfig = {
  appName: process.env.APP_NAME ?? "IT Utilities",
  appUrl: process.env.APP_URL ?? "http://localhost:5173",
};

const normalizeUrl = (value: string) => value.trim().replace(/\/+$/, "");

export async function getEmailTemplateConfig(): Promise<EmailTemplateConfig> {
  const rows = await prisma.system_config.findMany({
    where: {
      id: { in: [emailTemplateConfigKeys.appName, emailTemplateConfigKeys.appUrl] },
      is_active: true,
    },
    select: { id: true, value: true },
  });

  const config = new Map(rows.map((row) => [row.id, row.value]));
  const appName = config.get(emailTemplateConfigKeys.appName)?.trim() || defaults.appName;
  const appUrl = normalizeUrl(config.get(emailTemplateConfigKeys.appUrl) || defaults.appUrl);

  return { appName, appUrl };
}
