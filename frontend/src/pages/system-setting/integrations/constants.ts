import type { ConnectionStatus, IntegrationStatusTone, LdapSettings, RedisSettings, SmtpSettings, StorageSettings } from "./types";

export const defaultRedis: RedisSettings = {
  enabled: false,
  host: "127.0.0.1",
  port: 6379,
  db: 0,
  password: "",
  hasPassword: false,
  prefix: "it-utils:",
};

export const defaultSmtp: SmtpSettings = {
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

export const defaultLdap: LdapSettings = {
  enabled: false,
  url: "ldap://ldap.example.com:389",
  encryption: "starttls",
  bindDn: "cn=admin,dc=example,dc=com",
  bindPassword: "",
  hasBindPassword: false,
  baseDn: "dc=example,dc=com",
  userFilter: "(&(objectClass=person)(uid={{username}}))",
};

export const defaultStorage: StorageSettings = {
  enabled: true,
  type: "local",
  s3Provider: "amazon-s3",
  basePath: "",
  host: "",
  port: 22,
  shareName: "",
  domain: "",
  username: "",
  password: "",
  hasPassword: false,
  ftpSecure: false,
  endpoint: "",
  region: "ap-southeast-1",
  bucket: "",
  accessKey: "",
  secretKey: "",
  pathPrefix: "",
  forcePathStyle: false,
};

export const card = "rounded-lg border border-theme bg-light-background-card p-5 shadow-soft dark:bg-dark-background-card";
export const input = "w-full rounded-md border border-theme bg-light-background px-3 py-2 text-sm text-light-text placeholder-light-text-muted focus:outline-none focus:ring-2 focus:ring-light-primary disabled:cursor-not-allowed disabled:opacity-70 dark:bg-dark-background dark:text-dark-text dark:placeholder-dark-text-muted dark:focus:ring-dark-primary";
export const lbl = "mb-1 block text-xs font-semibold text-light-text-muted dark:text-dark-text-muted";
export const btnSec = "inline-flex items-center gap-2 rounded-md border border-theme px-3 py-2 text-sm font-semibold text-light-text transition-colors hover:bg-light-primary/10 disabled:cursor-not-allowed disabled:opacity-50 dark:text-dark-text dark:hover:bg-dark-primary/10";
export const btnPri = "inline-flex items-center gap-2 rounded-md bg-light-primary px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-light-primary-hover disabled:cursor-not-allowed disabled:opacity-50 dark:bg-dark-primary dark:text-dark-background dark:hover:bg-dark-primary-hover";
export const btnDgr = "inline-flex items-center gap-2 rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50";

export const statusCls = (status: ConnectionStatus) =>
  status === "ok"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
    : status === "error"
      ? "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200"
      : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200";

export const rowStatusCls = (tone: IntegrationStatusTone) =>
  tone === "connected"
    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
    : tone === "enabled"
      ? "bg-sky-500/10 text-sky-700 dark:text-sky-300"
      : tone === "error"
        ? "bg-red-500/10 text-red-600 dark:text-red-300"
        : tone === "loading"
          ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
          : "bg-light-text-muted/10 text-light-text-muted dark:text-dark-text-muted";

export const getIntegrationStatus = (
  enabled: boolean,
  connectionStatus: ConnectionStatus,
  loading: boolean,
) => {
  if (loading) return { label: "กำลังตรวจสอบการเชื่อมต่อ", tone: "loading" as const, connected: false };
  if (!enabled) return { label: "ปิดใช้งาน", tone: "disabled" as const, connected: false };
  if (connectionStatus === "ok") return { label: "เชื่อมต่อแล้ว", tone: "connected" as const, connected: true };
  if (connectionStatus === "error") return { label: "เชื่อมต่อล้มเหลว", tone: "error" as const, connected: false };
  return { label: "เปิดใช้งานแล้ว", tone: "enabled" as const, connected: false };
};
