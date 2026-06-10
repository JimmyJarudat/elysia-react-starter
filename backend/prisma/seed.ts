import "dotenv/config";
import { PrismaMssql } from "@prisma/adapter-mssql";
import { PrismaClient } from "../src/generated/prisma/client";
import { PasswordUtil } from "../src/utils/password";

const databaseUrl = process.env["DATABASE_URL"];
if (!databaseUrl) throw new Error("DATABASE_URL is required to run the seed.");

const adapter = new PrismaMssql(databaseUrl);
const prisma = new PrismaClient({ adapter });

const now = () => new Date();
const seedOnly = process.argv.find((arg) => arg.startsWith("--only="))?.split("=")[1];
const shouldSeedMenusOnly =
  seedOnly === "menus" ||
  process.argv.includes("--menus-only") ||
  process.env["SEED_ONLY"] === "menus";

// ─── Data ─────────────────────────────────────────────────────────────────────

const roles = [
  { id: "SUPERADMIN", name: "Super Admin",  priority: 100, description: "Full access to every menu and backend route." },
  { id: "ADMIN",      name: "Admin",         priority: 90,  description: "Manage users, roles, menus, and system settings." },
  { id: "USER",       name: "User",          priority: 10,  description: "Default user role with basic application access." },
] as const;

const permissions = [
  ["dashboard.read",                "Dashboard Read",                "dashboard",            "read"],
  ["users.read",                    "Users Read",                    "users",                "read"],
  ["users.create",                  "Users Create",                  "users",                "create"],
  ["users.update",                  "Users Update",                  "users",                "update"],
  ["users.delete",                  "Users Delete",                  "users",                "delete"],
  ["users.impersonate",             "Users Impersonate",             "users",                "impersonate"],
  ["roles.read",                    "Roles Read",                    "roles",                "read"],
  ["roles.create",                  "Roles Create",                  "roles",                "create"],
  ["roles.update",                  "Roles Update",                  "roles",                "update"],
  ["roles.delete",                  "Roles Delete",                  "roles",                "delete"],
  ["menus.read",                    "Menus Read",                    "menus",                "read"],
  ["menus.create",                  "Menus Create",                  "menus",                "create"],
  ["menus.update",                  "Menus Update",                  "menus",                "update"],
  ["menus.delete",                  "Menus Delete",                  "menus",                "delete"],
  ["permissions.read",              "Permissions Read",              "permissions",          "read"],
  ["permissions.create",            "Permissions Create",            "permissions",          "create"],
  ["permissions.update",            "Permissions Update",            "permissions",          "update"],
  ["permissions.delete",            "Permissions Delete",            "permissions",          "delete"],
  ["role-permissions.read",         "Role Permissions Read",         "role_permissions",     "read"],
  ["role-permissions.update",       "Role Permissions Update",       "role_permissions",     "update"],
  ["role-hierarchy.read",           "Role Hierarchy Read",           "role_hierarchy",       "read"],
  ["role-hierarchy.create",         "Role Hierarchy Create",         "role_hierarchy",       "create"],
  ["role-hierarchy.delete",         "Role Hierarchy Delete",         "role_hierarchy",       "delete"],
  ["access-tokens.read",            "Access Tokens Read",            "access_tokens",        "read"],
  ["access-tokens.create",          "Access Tokens Create",          "access_tokens",        "create"],
  ["access-tokens.revoke",          "Access Tokens Revoke",          "access_tokens",        "revoke"],
  ["access-tokens.delete",          "Access Tokens Delete",          "access_tokens",        "delete"],
  ["settings.read",                 "Settings Read",                 "settings",             "read"],
  ["settings.update",               "Settings Update",               "settings",             "update"],
  // Settings — General (granular per section)
  ["settings.general.identity.read",        "Settings General Identity Read",        "settings.general.identity",      "read"],
  ["settings.general.identity.update",      "Settings General Identity Update",      "settings.general.identity",      "update"],
  ["settings.general.organization.read",    "Settings General Organization Read",    "settings.general.organization",  "read"],
  ["settings.general.organization.update",  "Settings General Organization Update",  "settings.general.organization",  "update"],
  ["settings.general.registration.read",    "Settings General Registration Read",    "settings.general.registration",  "read"],
  ["settings.general.registration.update",  "Settings General Registration Update",  "settings.general.registration",  "update"],
  ["settings.general.regional.read",        "Settings General Regional Read",        "settings.general.regional",      "read"],
  ["settings.general.regional.update",      "Settings General Regional Update",      "settings.general.regional",      "update"],
  ["settings.general.maintenance.read",     "Settings General Maintenance Read",     "settings.general.maintenance",   "read"],
  ["settings.general.maintenance.update",   "Settings General Maintenance Update",   "settings.general.maintenance",   "update"],
  // Settings — Security (granular per section)
  ["settings.security.jwt.read",            "Settings Security JWT Read",            "settings.security.jwt",          "read"],
  ["settings.security.jwt.update",          "Settings Security JWT Update",          "settings.security.jwt",          "update"],
  ["settings.security.password.read",       "Settings Security Password Read",       "settings.security.password",     "read"],
  ["settings.security.password.update",     "Settings Security Password Update",     "settings.security.password",     "update"],
  ["settings.security.lockout.read",        "Settings Security Lockout Read",        "settings.security.lockout",      "read"],
  ["settings.security.lockout.update",      "Settings Security Lockout Update",      "settings.security.lockout",      "update"],
  ["settings.security.token.read",          "Settings Security Token Read",          "settings.security.token",        "read"],
  ["settings.security.token.update",        "Settings Security Token Update",        "settings.security.token",        "update"],
  ["settings.security.session.read",        "Settings Security Session Read",        "settings.security.session",      "read"],
  ["settings.security.session.update",      "Settings Security Session Update",      "settings.security.session",      "update"],
  ["settings.security.ip-blocklist.read",   "Settings Security IP Blocklist Read",   "settings.security.ip-blocklist", "read"],
  ["settings.security.ip-blocklist.update", "Settings Security IP Blocklist Update", "settings.security.ip-blocklist", "update"],
  ["settings.security.cors.read",           "Settings Security CORS Read",           "settings.security.cors",         "read"],
  ["settings.security.cors.update",         "Settings Security CORS Update",         "settings.security.cors",         "update"],
  // Settings — Integrations (granular per section)
  ["settings.integrations.redis.read",      "Settings Integrations Redis Read",      "settings.integrations.redis",    "read"],
  ["settings.integrations.redis.update",    "Settings Integrations Redis Update",    "settings.integrations.redis",    "update"],
  ["settings.integrations.smtp.read",       "Settings Integrations SMTP Read",       "settings.integrations.smtp",     "read"],
  ["settings.integrations.smtp.update",     "Settings Integrations SMTP Update",     "settings.integrations.smtp",     "update"],
  ["settings.integrations.storage.read",    "Settings Integrations Storage Read",    "settings.integrations.storage",  "read"],
  ["settings.integrations.storage.update",  "Settings Integrations Storage Update",  "settings.integrations.storage",  "update"],
  ["settings.general",      "Settings General",      "settings.general",      "read"],
  ["settings.security",     "Settings Security",     "settings.security",     "read"],
  ["settings.integrations", "Settings Integrations", "settings.integrations", "read"],
  ["sessions.read",                 "Sessions Read",                 "sessions",             "read"],
  ["sessions.delete",               "Sessions Delete",               "sessions",             "delete"],
  ["logs.read",                      "Logs Read",                     "logs",                 "read"],
  ["request_logs.read",             "Request Logs Read",             "request_logs",         "read"],
  ["auth_logs.read",                "Auth Logs Read",                "auth_logs",            "read"],
  ["activity_logs.read",            "Activity Logs Read",            "activity_logs",        "read"],
  ["audit_logs.read",               "Audit Logs Read",               "audit_logs",           "read"],
  ["error_logs.read",               "Error Logs Read",               "error_logs",           "read"],
  ["system_events.read",            "System Events Read",            "system_events",        "read"],
  ["live_console.read",             "Live Console Read",             "live_console",         "read"],
  ["api-route-requirements.read",   "API Route Requirements Read",   "api_route_requirements","read"],
  ["api-route-requirements.update", "API Route Requirements Update", "api_route_requirements","update"],
  ["api-route-requirements.delete", "API Route Requirements Delete", "api_route_requirements","delete"],
] as const;

const menus = [
  { code: "dashboard",                          label: "Dashboard",          path: "/dashboard",                          icon_name: "LayoutDashboard",    permission_id: "dashboard.read",          parent_code: null,          sort_order: 10 },
  { code: "administration",                      label: "Administration",     path: "/administration",                      icon_name: "ShieldCheck",        permission_id: null,                      parent_code: null,             sort_order: 20, legacy_codes: ["admin_console"], legacy_paths: ["/admin-console"] },
  { code: "administration_users",                label: "Users",              path: "/administration/users",                icon_name: "UsersRound",         permission_id: "users.read",              parent_code: "administration", sort_order: 10, legacy_codes: ["admin_console_users"], legacy_paths: ["/admin-console/users"] },
  { code: "administration_roles_permissions",    label: "Roles & Permissions",path: "/administration/roles-permissions",    icon_name: "KeyRound",           permission_id: "role-permissions.read",   parent_code: "administration", sort_order: 20, legacy_codes: ["admin_console_roles_permissions"], legacy_paths: ["/admin-console/roles-permissions"] },
  { code: "administration_menus",                label: "Sidebar Menus",      path: "/administration/menus",                icon_name: "Menu",               permission_id: "menus.read",              parent_code: "administration", sort_order: 30, legacy_codes: ["admin_console_menus"], legacy_paths: ["/admin-console/menus"] },
  { code: "administration_api_route_requirements",label: "API Routes",        path: "/administration/api-route-requirements",icon_name: "Route",             permission_id: "api-route-requirements.read", parent_code: "administration", sort_order: 40, legacy_codes: ["admin_console_api_route_requirements"], legacy_paths: ["/admin-console/api-route-requirements"] },
  { code: "administration_sessions",             label: "Sessions",           path: "/administration/sessions",             icon_name: "MonitorX",           permission_id: "sessions.read",           parent_code: "administration", sort_order: 50, legacy_codes: ["admin_console_sessions"], legacy_paths: ["/admin-console/sessions"] },
  { code: "settings",                           label: "Settings",         path: "/settings",                           icon_name: "Settings",           permission_id: null,                      parent_code: null,          sort_order: 90 },
  { code: "settings_general",                   label: "General",            path: "/settings/general",                   icon_name: "SlidersHorizontal",  permission_id: "settings.general",        parent_code: "settings",    sort_order: 10 },
  { code: "settings_security",                  label: "Security",           path: "/settings/security",                  icon_name: "ShieldCheck",        permission_id: "settings.security",       parent_code: "settings",    sort_order: 20 },
  { code: "settings_integrations",              label: "Integrations",       path: "/settings/integrations",              icon_name: "Plug",               permission_id: "settings.integrations",   parent_code: "settings",    sort_order: 30 },
  { code: "logs",                               label: "Logs",               path: "/logs",                               icon_name: "ScrollText",         permission_id: "logs.read",               parent_code: null,           sort_order: 100 },
  { code: "logs_request",                       label: "Request Logs",       path: "/logs/request",                       icon_name: "Network",            permission_id: "request_logs.read",       parent_code: "logs",         sort_order: 10 },
  { code: "logs_auth",                          label: "Authentication Logs",path: "/logs/auth",                          icon_name: "ShieldAlert",        permission_id: "auth_logs.read",          parent_code: "logs",         sort_order: 20 },
  { code: "logs_activity",                      label: "Activity Logs",      path: "/logs/activity",                      icon_name: "Activity",           permission_id: "activity_logs.read",      parent_code: "logs",         sort_order: 30 },
  { code: "logs_audit",                         label: "Audit Logs",         path: "/logs/audit",                         icon_name: "ClipboardList",      permission_id: "audit_logs.read",         parent_code: "logs",         sort_order: 40 },
  { code: "logs_error",                         label: "Error Logs",         path: "/logs/error",                         icon_name: "Bug",                permission_id: "error_logs.read",         parent_code: "logs",         sort_order: 50 },
  { code: "logs_system_events",                 label: "System Events",      path: "/logs/system-events",                 icon_name: "Cpu",                permission_id: "system_events.read",      parent_code: "logs",         sort_order: 60 },
  { code: "logs_live_console",                  label: "Live Console",       path: "/logs/live-console",                  icon_name: "Terminal",           permission_id: "live_console.read",       parent_code: "logs",         sort_order: 70 },
] as const;

const apiRoutes = [
  ["GET",    "/api/dashboard",                                          "dashboard.read"],
  ["GET",    "/api/users",                                              "users.read"],
  ["GET",    "/api/users/deleted",                                      "users.read"],
  ["GET",    "/api/users/export",                                       "users.read"],
  ["POST",   "/api/users",                                              "users.create"],
  ["GET",    "/api/users/:id",                                          "users.read"],
  ["PUT",    "/api/users/:id",                                          "users.update"],
  ["POST",   "/api/users/:id/unlock",                                   "users.update"],
  ["DELETE", "/api/users/:id/sessions",                                 "users.update"],
  ["POST",   "/api/users/:id/reset-password",                           "users.update"],
  ["GET",    "/api/users/:id/roles",                                    "users.read"],
  ["PUT",    "/api/users/:id/roles",                                    "users.update"],
  ["PATCH",  "/api/users/:id/status",                                   "users.update"],
  ["PATCH",  "/api/users/:id/restore",                                  "users.update"],
  ["DELETE", "/api/users/:id",                                          "users.delete"],
  ["DELETE", "/api/users/:id/permanent",                                "users.delete"],
  ["POST",   "/api/auth/tfa-verify",                                   null],
  ["POST",   "/api/auth/forgot-password",                              null],
  ["GET",    "/api/auth/password-policy",                              null],
  ["POST",   "/api/auth/reset-password",                               null],
  ["GET",    "/api/account-security/tfa",                              null],
  ["POST",   "/api/account-security/tfa/setup",                        null],
  ["POST",   "/api/account-security/tfa/enable",                       null],
  ["POST",   "/api/account-security/tfa/disable",                      null],
  ["POST",   "/api/account-security/tfa/backup-codes/regenerate",      null],
  ["POST",   "/api/auth/impersonate/:userId",                           "users.impersonate"],
  ["GET",    "/api/menus",                                              "menus.read"],
  ["POST",   "/api/menus",                                              "menus.create"],
  ["PUT",    "/api/menus/:id",                                          "menus.update"],
  ["DELETE", "/api/menus/:id",                                          "menus.delete"],
  ["GET",    "/api/access-control/roles-permissions/export",            "role-permissions.read"],
  ["POST",   "/api/access-control/roles",                               "roles.create"],
  ["POST",   "/api/access-control/roles/:id/clone",                     "roles.create"],
  ["PUT",    "/api/access-control/roles/:id",                           "roles.update"],
  ["DELETE", "/api/access-control/roles/:id",                           "roles.delete"],
  ["DELETE", "/api/access-control/roles",                               "roles.delete"],
  ["PUT",    "/api/access-control/roles/:id/permissions",               "role-permissions.update"],
  ["POST",   "/api/access-control/role-hierarchy",                      "role-hierarchy.create"],
  ["DELETE", "/api/access-control/role-hierarchy/:parentId/:childId",   "role-hierarchy.delete"],
  ["POST",   "/api/access-control/permissions",                         "permissions.create"],
  ["PUT",    "/api/access-control/permissions/:id",                     "permissions.update"],
  ["DELETE", "/api/access-control/permissions/:id",                     "permissions.delete"],
  ["GET",    "/api/personal-access-tokens",                             "access-tokens.read"],
  ["POST",   "/api/personal-access-tokens",                             "access-tokens.create"],
  ["POST",   "/api/personal-access-tokens/:id/revoke",                  "access-tokens.revoke"],
  ["DELETE", "/api/personal-access-tokens/:id",                         "access-tokens.delete"],
  ["GET",    "/api/my-auth-history",                                     null],
  ["DELETE", "/api/my-auth-history/sessions/:id",                       null],
  ["GET",    "/api/notifications/sse",                                   null],
  ["GET",    "/api/notifications",                                        null],
  ["PATCH",  "/api/notifications/read-all",                              null],
  ["PATCH",  "/api/notifications/:id/read",                              null],
  ["GET",    "/api/profile/me",                                          null],
  ["PUT",    "/api/profile/me",                                          null],
  ["PATCH",  "/api/profile/language",                                    null],
  ["PUT",    "/api/account-security/password",                           null],
  ["GET",    "/api/account-security/password-history",                   null],
  ["GET",    "/api/account-security/notifications",                      null],
  ["PUT",    "/api/account-security/notifications",                      null],
  ["GET",    "/api/account-security/emails",                             null],
  ["POST",   "/api/account-security/emails/send-code",                   null],
  ["POST",   "/api/account-security/emails/verify-code",                 null],
  ["GET",    "/api/settings",                                           "settings.read"],
  ["PUT",    "/api/settings",                                           "settings.update"],
  ["GET",    "/api/system-setting/organization-support",                "settings.general.organization.read"],
  ["PUT",    "/api/system-setting/organization-support",                "settings.general.organization.update"],
  ["GET",    "/api/system-setting/registration",                        "settings.general.registration.read"],
  ["PUT",    "/api/system-setting/registration",                        "settings.general.registration.update"],
  // security combined endpoint — ใช้ settings.security namespace; auth middleware รองรับ child/parent matching
  // user ที่มี settings.read, settings.update, หรือ settings.security.* จะผ่านได้
  ["GET",    "/api/system-setting/security",                            "settings.security"],
  ["PUT",    "/api/system-setting/security",                            "settings.security"],
  ["GET",    "/api/system-setting/ip-blocklist",                        "settings.security.ip-blocklist.read"],
  ["POST",   "/api/system-setting/ip-blocklist",                        "settings.security.ip-blocklist.update"],
  ["DELETE", "/api/system-setting/ip-blocklist/:id",                    "settings.security.ip-blocklist.update"],
  ["GET",    "/api/system-setting/cors",                                "settings.security.cors.read"],
  ["PUT",    "/api/system-setting/cors",                                "settings.security.cors.update"],
  ["GET",    "/api/system-setting/smtp",                                "settings.integrations.smtp.read"],
  ["PUT",    "/api/system-setting/smtp",                                "settings.integrations.smtp.update"],
  ["POST",   "/api/system-setting/smtp/test",                           "settings.integrations.smtp.update"],
  ["POST",   "/api/system-setting/smtp/send-test",                      "settings.integrations.smtp.update"],
  ["GET",    "/api/system-setting/redis",                               "settings.integrations.redis.read"],
  ["PUT",    "/api/system-setting/redis",                               "settings.integrations.redis.update"],
  ["POST",   "/api/system-setting/redis/test",                          "settings.integrations.redis.update"],
  ["GET",    "/api/system-setting/redis/status",                        "settings.integrations.redis.read"],
  ["GET",    "/api/system-setting/redis/keys",                          "settings.integrations.redis.read"],
  ["POST",   "/api/system-setting/redis/key",                           "settings.integrations.redis.read"],
  ["DELETE", "/api/system-setting/redis/key",                           "settings.integrations.redis.update"],
  ["POST",   "/api/system-setting/redis/clear",                         "settings.integrations.redis.update"],
  ["GET",    "/api/system-setting/storage",                             "settings.integrations.storage.read"],
  ["PUT",    "/api/system-setting/storage",                             "settings.integrations.storage.update"],
  ["POST",   "/api/system-setting/storage/test",                        "settings.integrations.storage.update"],
  ["PUT",    "/api/system-setting/identity",                            "settings.general.identity.update"],
  ["GET",    "/api/system-setting/notification-sound",                  null],
  ["PUT",    "/api/system-setting/notification-sound",                  "settings.general.identity.update"],
  ["DELETE", "/api/system-setting/notification-sound",                  "settings.general.identity.update"],
  ["GET",    "/api/system-setting/regional",                            "settings.general.regional.read"],
  ["PUT",    "/api/system-setting/regional",                            "settings.general.regional.update"],
  ["GET",    "/api/system-setting/maintenance",                         "settings.general.maintenance.read"],
  ["PUT",    "/api/system-setting/maintenance",                         "settings.general.maintenance.update"],
  ["GET",    "/api/sessions",                                           "sessions.read"],
  ["DELETE", "/api/sessions/:id",                                       "sessions.delete"],
  ["GET",    "/api/logs/request",                                       "request_logs.read"],
  ["GET",    "/api/logs/request/export",                                "request_logs.read"],
  ["GET",    "/api/logs/request/analytics",                             "request_logs.read"],
  ["GET",    "/api/logs/auth",                                          "auth_logs.read"],
  ["GET",    "/api/logs/auth/export",                                   "auth_logs.read"],
  ["GET",    "/api/logs/activity",                                      "activity_logs.read"],
  ["GET",    "/api/logs/activity/resources",                            "activity_logs.read"],
  ["GET",    "/api/logs/activity/export",                               "activity_logs.read"],
  ["GET",    "/api/logs/audit",                                         "audit_logs.read"],
  ["GET",    "/api/logs/audit/export",                                  "audit_logs.read"],
  ["GET",    "/api/logs/error",                                         "error_logs.read"],
  ["PATCH",  "/api/logs/error/:id/resolve",                            "error_logs.read"],
  ["GET",    "/api/logs/error/export",                                  "error_logs.read"],
  ["GET",    "/api/logs/system-events",                                 "system_events.read"],
  ["GET",    "/api/logs/system-events/export",                          "system_events.read"],
  ["GET",    "/api/logs/live-console",                                  "live_console.read"],
  ["GET",    "/api/logs/live-console/stream",                           "live_console.read"],
  ["GET",    "/api/audit-logs",                                         "audit_logs.read"],
  ["GET",    "/api/api-route-requirements",                             "api-route-requirements.read"],
  ["GET",    "/api/api-route-requirements/export",                      "api-route-requirements.read"],
  ["PUT",    "/api/api-route-requirements/:id",                         "api-route-requirements.update"],
  ["DELETE", "/api/api-route-requirements/:id",                         "api-route-requirements.delete"],
] as const;

const systemConfigs = [
  ["access_token_expiry_minutes",              "60",           "Access token lifetime in minutes",                                    "AUTH",            "Access Token Expiry Minutes",              "NUMBER",  false],
  ["account_lock_minutes",                     "5",            "Minutes to lock an account after too many failed login attempts",     "AUTH",            "Account Lock Minutes",                     "NUMBER",  false],
  ["jwt_secret",                               "change-this-jwt-secret", "JWT signing secret. Changing this invalidates existing tokens.",          "AUTH",            "JWT Secret",                               "STRING",  false],
  ["jwt_jit",                                  "", "Optional JWT ID override. Leave empty to generate a unique token ID.",         "AUTH",            "JWT JTI Override",                         "STRING",  false],
  ["jwt_issuer",                               "genesenn-it-utils", "JWT issuer claim",                                                   "AUTH",            "JWT Issuer",                               "STRING",  false],
  ["jwt_audience",                             "genesenn-it-utils-users", "JWT audience claim",                                             "AUTH",            "JWT Audience",                             "STRING",  false],
  ["max_active_sessions",                      "2",            "Maximum active sessions per user",                                    "AUTH",            "Max Active Sessions",                      "NUMBER",  false],
  ["max_login_attempts",                       "5",            "Maximum failed login attempts before account lock",                   "AUTH",            "Max Login Attempts",                       "NUMBER",  false],
  ["password_expiry_days",                     "90",           "Password expiry period in days",                                      "AUTH",            "Password Expiry Days",                     "NUMBER",  false],
  ["password_min_length",                      "8",            "Minimum password length",                                             "PASSWORD",        "Password Minimum Length",                  "NUMBER",  false],
  ["password_require_lowercase",               "true",         "Require at least one lowercase letter in passwords",                  "PASSWORD",        "Require Lowercase Letter",                 "BOOLEAN", false],
  ["password_require_number",                  "true",         "Require at least one number in passwords",                            "PASSWORD",        "Require Number",                           "BOOLEAN", false],
  ["password_require_special",                 "true",         "Require at least one special character in passwords",                 "PASSWORD",        "Require Special Character",                "BOOLEAN", false],
  ["password_require_uppercase",               "true",         "Require at least one uppercase letter in passwords",                  "PASSWORD",        "Require Uppercase Letter",                 "BOOLEAN", false],
  ["password_reset_expiry_minutes",            "60",           "Minutes before password reset link expires",                          "ACCESS",          "Password Reset Expiry Minutes",            "NUMBER",  false],
  ["refresh_token_expiry_minutes",             "10080",        "Refresh token lifetime in minutes",                                   "AUTH",            "Refresh Token Expiry Minutes",             "NUMBER",  false],
  ["session_expiry_minutes",                   "2880",         "Session lifetime in minutes",                                         "AUTH",            "Session Expiry Minutes",                   "NUMBER",  false],
  ["cron_cleanup_expired_sessions_cron",       "0 2 * * *",    "Cron expression for expired session cleanup job",                     "CRON",            "Cleanup Expired Sessions Cron Expression", "STRING",  false],
  ["cron_cleanup_expired_sessions_enabled",    "true",         "Enable expired session cleanup cron job",                             "CRON",            "Cleanup Expired Sessions Cron Enabled",    "BOOLEAN", false],
  ["redis_db",                                 "0",            "Redis database index",                                                "REDIS",           "Redis DB Index",                           "NUMBER",  false],
  ["redis_enabled",                            "true",         "Enable Redis cache and presence features",                            "REDIS",           "Redis Enabled",                            "BOOLEAN", false],
  ["redis_host",                               "127.0.0.1",    "Redis host",                                                          "REDIS",           "Redis Host",                               "STRING",  false],
  ["redis_key_prefix",                         "it-utils:",    "Redis key prefix",                                                    "REDIS",           "Redis Key Prefix",                         "STRING",  false],
  ["redis_password",                           "",             "Redis password. Set this in the database or settings UI.",            "REDIS",           "Redis Password",                           "STRING",  true],
  ["redis_port",                               "6379",         "Redis port",                                                          "REDIS",           "Redis Port",                               "NUMBER",  false],
  ["smtp_enabled",                             "false",        "Enable SMTP email sending",                                           "SMTP",            "SMTP Enabled",                             "BOOLEAN", false],
  ["smtp_encryption",                          "starttls",     "SMTP encryption mode: starttls, ssl, or none",                        "SMTP",            "SMTP Encryption",                          "STRING",  false],
  ["email_app_name",                           "IT Utilities", "Application name shown in system emails",                             "SMTP",            "Email App Name",                           "STRING",  false],
  ["email_app_url",                            "http://localhost:5173", "Application URL used in system emails",                    "SMTP",            "Email App URL",                            "STRING",  false],
  ["smtp_from_email",                          "",             "SMTP sender email address",                                           "SMTP",            "SMTP From Email",                          "STRING",  false],
  ["smtp_from_name",                           "IT Utilities", "SMTP sender display name",                                            "SMTP",            "SMTP From Name",                           "STRING",  false],
  ["smtp_host",                                "",             "SMTP host",                                                           "SMTP",            "SMTP Host",                                "STRING",  false],
  ["smtp_password",                            "",             "SMTP password. Set this in the database or settings UI.",             "SMTP",            "SMTP Password",                            "STRING",  true],
  ["smtp_port",                                "587",          "SMTP port",                                                           "SMTP",            "SMTP Port",                                "NUMBER",  false],
  ["smtp_require_tls",                         "true",         "Require TLS for SMTP connection",                                     "SMTP",            "SMTP Require TLS",                         "BOOLEAN", false],
  ["smtp_secure",                              "false",        "Use secure SMTP connection",                                          "SMTP",            "SMTP Secure",                              "BOOLEAN", false],
  ["smtp_user",                                "",             "SMTP username",                                                       "SMTP",            "SMTP User",                                "STRING",  false],
  ["storage_provider",                         "local",        "Active storage provider: local or smb",                               "STORAGE",         "Storage Provider",                         "STRING",  false],
  ["storage_smb_base_path",                    "",             "Base path inside SMB share",                                          "STORAGE",         "SMB Base Path",                            "STRING",  false],
  ["storage_smb_domain",                       "",             "Optional SMB domain",                                                 "STORAGE",         "SMB Domain",                               "STRING",  false],
  ["storage_smb_host",                         "",             "SMB server host",                                                     "STORAGE",         "SMB Host",                                 "STRING",  false],
  ["storage_smb_password",                     "",             "SMB password. Set this in the database or settings UI.",              "STORAGE",         "SMB Password",                             "STRING",  true],
  ["storage_smb_share_name",                   "",             "SMB share name",                                                       "STORAGE",         "SMB Share Name",                           "STRING",  false],
  ["storage_smb_username",                     "",             "SMB username",                                                         "STORAGE",         "SMB Username",                             "STRING",  false],
  ["organization_name",                        "",             "Organization display name",                                           "ORGANIZATION",    "Organization Name",                        "STRING",  false],
  ["organization_logo_url",                    "",             "Organization logo used on login and reports",                        "ORGANIZATION",    "Organization Logo URL",                    "STRING",  false],
  ["support_email",                            "",             "Support contact email",                                               "ORGANIZATION",    "Support Email",                            "STRING",  false],
  ["website_url",                              "",             "Organization website URL",                                            "ORGANIZATION",    "Website URL",                              "STRING",  false],
  ["help_center_url",                          "/help",        "Help center path or URL",                                             "ORGANIZATION",    "Help Center URL",                          "STRING",  false],
  ["system_name",                              "IT Utils",     "Primary application name",                                            "SYSTEM_IDENTITY", "System Name",                              "STRING",  false],
  ["system_subtitle",                          "Internal tools and admin workspace", "Short application subtitle",                    "SYSTEM_IDENTITY", "System Subtitle",                          "STRING",  false],
  ["app_title",                                "IT Utils",     "Browser document title",                                             "SYSTEM_IDENTITY", "App Title",                                "STRING",  false],
  ["app_title_mode",                           "title_only",   "Browser title display mode",                                         "SYSTEM_IDENTITY", "App Title Mode",                           "STRING",  false],
  ["system_logo_url",                          "https://upload-os-bbs.hoyolab.com/upload/2024/08/18/369597573/4c52870d1d0e53bd602194965f4219e5_7079231097089141906.png?x-oss-process=image%2Fresize%2Cs_1000%2Fauto-orient%2C0%2Finterlace%2C1%2Fformat%2Cwebp%2Fquality%2Cq_70",             "Application logo path or URL",                                        "SYSTEM_IDENTITY", "System Logo URL",                          "STRING",  false],
  ["system_favicon_url",                       "https://static.wikia.nocookie.net/p__/images/3/37/Miss_Pink_Elf.webp/revision/latest?cb=20240209214557&path-prefix=protagonist",             "Browser favicon path or URL",                                         "SYSTEM_IDENTITY", "System Favicon URL",                       "STRING",  false],
  ["timezone",                                 "Asia/Bangkok", "System timezone",                                                     "REGIONAL",        "Timezone",                                 "STRING",  false],
  ["date_format",                              "DD/MM/YYYY",   "System date display format",                                          "REGIONAL",        "Date Format",                              "STRING",  false],
  ["time_format",                              "24h",          "System time display format (24h or 12h)",                             "REGIONAL",        "Time Format",                              "STRING",  false],
  ["maintenance_mode",                         "false",        "Enable maintenance mode to block access",                             "MAINTENANCE",     "Maintenance Mode",                         "BOOLEAN", false],
  ["maintenance_message",                      "",             "Message shown to users during maintenance",                           "MAINTENANCE",     "Maintenance Message",                      "STRING",  false],
  ["self_registration_enabled",                "false",        "Allow users to register from the login page",                         "REGISTRATION",    "Self Registration",                        "BOOLEAN", false],
  ["registration_requires_approval",           "true",         "Require admin approval for self-registered users",                    "REGISTRATION",    "Require Approval",                         "BOOLEAN", false],
  ["registration_default_role",                "USER",         "Default role assigned to self-registered users",                      "REGISTRATION",    "Default Registration Role",                "STRING",  false],
  ["year_era",                                 "CE",           "Year era: CE (Christian/ค.ศ.) or BE (Buddhist/พ.ศ.)",                "REGIONAL",        "Year Era",                                 "STRING",  false],
  ["idle_timeout_minutes",                     "0",            "Auto logout after inactivity. 0 = disabled.",                         "AUTH",            "Idle Timeout Minutes",                     "NUMBER",  false],
  ["account_inactivity_days",                  "0",            "Disable account if no login for X days. 0 = disabled.",              "AUTH",            "Account Inactivity Days",                  "NUMBER",  false],
  ["password_history_count",                   "0",            "Prevent reuse of last N passwords. 0 = disabled.",                   "PASSWORD",        "Password History Count",                   "NUMBER",  false],
  ["force_single_session",                     "false",        "Log out all other sessions when a new login occurs.",                "AUTH",            "Force Single Session",                     "BOOLEAN", false],
  ["cron_disable_inactive_accounts_enabled",   "true",         "Enable disable inactive accounts cron job",                          "CRON",            "Disable Inactive Accounts Cron Enabled",   "BOOLEAN", false],
  ["cron_disable_inactive_accounts_cron",      "0 3 * * *",    "Cron expression for disable inactive accounts job",                  "CRON",            "Disable Inactive Accounts Cron Expression","STRING",  false],
  ["cors_allowed_origins",                     "http://localhost:5173,https://localhost:5173,http://127.0.0.1:5173,https://127.0.0.1:5173", "Comma-separated list of allowed frontend origins for CORS", "CORS", "CORS Allowed Origins", "STRING", false],
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function log(msg: string) {
  process.stdout.write(`  ${msg}\n`);
}

// ─── Seed functions ───────────────────────────────────────────────────────────

async function seedRoles() {
  log(`Roles: upserting ${roles.length}...`);
  await Promise.all(
    roles.map((role) =>
      prisma.roles.upsert({
        where: { id: role.id },
        update: { name: role.name, priority: role.priority, description: role.description, updated_at: now() },
        create: { id: role.id, name: role.name, priority: role.priority, description: role.description },
      })
    )
  );
  log(`Roles: done ✓`);
}

async function seedPermissions() {
  log(`Permissions: upserting ${permissions.length}...`);
  await Promise.all(
    permissions.map(([id, name, resource, action]) =>
      prisma.permissions.upsert({
        where: { id },
        update: { name, resource, action, updated_at: now() },
        create: { id, name, resource, action, description: `${action} access for ${resource}` },
      })
    )
  );
  log(`Permissions: done ✓`);
}

async function seedMenus() {
  log(`Menus: upserting ${menus.length}...`);
  // ดึง existing menus ทีเดียว แล้วซ่อมเฉพาะเมนูหลักที่ seed เป็นเจ้าของ
  const existingMenus = await prisma.menu_items.findMany({ select: { id: true, code: true, path: true } });
  const codeToId = new Map(existingMenus.filter(m => m.code).map((m) => [m.code!, m.id]));
  const pathToId = new Map(existingMenus.map((m) => [m.path, m.id]));

  let created = 0;
  let updated = 0;
  for (const menu of menus) {
    const parentId = menu.parent_code ? codeToId.get(menu.parent_code) ?? null : null;
    const legacyCodes = "legacy_codes" in menu ? menu.legacy_codes : [];
    const legacyPaths = "legacy_paths" in menu ? menu.legacy_paths : [];
    const existingId =
      codeToId.get(menu.code) ??
      legacyCodes.map((code) => codeToId.get(code)).find(Boolean) ??
      pathToId.get(menu.path) ??
      legacyPaths.map((path) => pathToId.get(path)).find(Boolean);

    if (existingId) {
      await prisma.menu_items.update({
        where: { id: existingId },
        data: {
          path: menu.path,
          label: menu.label,
          icon_name: menu.icon_name,
          icon_library: "lucide-react",
          code: menu.code,
          permission_id: menu.permission_id,
          parent_id: parentId,
          sort_order: menu.sort_order,
          is_active: true,
          updated_at: now(),
        },
      });
      codeToId.set(menu.code, existingId);
      pathToId.set(menu.path, existingId);
      updated++;
      continue;
    }

    const created_ = await prisma.menu_items.create({
      data: {
        path: menu.path, label: menu.label, icon_name: menu.icon_name,
        icon_library: "lucide-react", code: menu.code,
        permission_id: menu.permission_id, parent_id: parentId,
        sort_order: menu.sort_order, is_active: true, created_at: now(),
      },
    });
    codeToId.set(menu.code, created_.id);
    pathToId.set(menu.path, created_.id);
    created++;
  }
  log(`Menus: done ✓  (${created} created, ${updated} updated)`);

  // Migrate permission_ids for settings menu items to use namespace-based values
  const menuPermFixes: { code: string; permission_id: string | null }[] = [
    { code: "settings",              permission_id: null },
    { code: "settings_general",      permission_id: "settings.general" },
    { code: "settings_security",     permission_id: "settings.security" },
    { code: "settings_integrations", permission_id: "settings.integrations" },
  ];
  let menuUpdated = 0;
  for (const fix of menuPermFixes) {
    const menuId = codeToId.get(fix.code);
    if (menuId) {
      await prisma.menu_items.update({ where: { id: menuId }, data: { permission_id: fix.permission_id, updated_at: now() } });
      menuUpdated++;
    }
  }
  if (menuUpdated > 0) log(`Menus: updated ${menuUpdated} permission_ids ✓`);
}

async function seedRolePermissions() {
  const allPermIds = permissions.map(([id]) => id);
  const adminPermIds = allPermIds.filter((id) => id !== "audit_logs.read");
  const assignments: [string, string][] = [
    ...allPermIds.map((p) => ["SUPERADMIN", p] as [string, string]),
    ...adminPermIds.map((p) => ["ADMIN", p] as [string, string]),
    ...["dashboard.read"].map((p) => ["USER", p] as [string, string]),
  ];

  log(`Role permissions: checking ${assignments.length} assignments...`);
  const existing = await prisma.role_permissions.findMany({ select: { role_id: true, permission_id: true } });
  const existingSet = new Set(existing.map((e) => `${e.role_id}:${e.permission_id}`));
  const toCreate = assignments.filter(([r, p]) => !existingSet.has(`${r}:${p}`));

  if (toCreate.length > 0) {
    await prisma.role_permissions.createMany({
      data: toCreate.map(([role_id, permission_id]) => ({ role_id, permission_id })),
    });
  }
  log(`Role permissions: done ✓  (${toCreate.length} created, ${existing.length} already existed)`);
}

async function seedApiRoutes() {
  log(`API routes: checking ${apiRoutes.length}...`);
  const existing = await prisma.api_route_requirements.findMany({
    select: { method: true, path: true, permission_id: true },
  });
  const existingMap = new Map(existing.map((e) => [`${e.method}:${e.path}`, e.permission_id]));

  const toCreate: { method: string; path: string; permission_id: string | null; is_active: boolean }[] = [];
  const toUpdate: { method: string; path: string; permission_id: string | null }[] = [];

  for (const [method, path, permission_id] of apiRoutes) {
    const key = `${method}:${path}`;
    if (!existingMap.has(key)) {
      toCreate.push({ method, path, permission_id, is_active: true });
    } else if (existingMap.get(key) !== permission_id) {
      toUpdate.push({ method, path, permission_id });
    }
  }

  if (toCreate.length > 0) {
    await prisma.api_route_requirements.createMany({ data: toCreate });
  }
  if (toUpdate.length > 0) {
    await Promise.all(
      toUpdate.map(({ method, path, permission_id }) =>
        prisma.api_route_requirements.update({
          where: { method_path: { method, path } },
          data: { permission_id, is_active: true, updated_at: now() },
        })
      )
    );
  }
  log(`API routes: done ✓  (${toCreate.length} created, ${toUpdate.length} updated, ${existing.length - toUpdate.length} unchanged)`);
}

// Keys ที่ seed จะ upsert เสมอ (ไม่ skip ถ้ามีค่าเดิมอยู่) เพราะ default ของมันสำคัญและควรตรงกับ seed
const ALWAYS_UPSERT_CONFIGS = new Set(["cors_allowed_origins"]);

async function seedSystemConfig() {
  log(`System config: checking ${systemConfigs.length}...`);
  const existing = await prisma.system_config.findMany({ select: { id: true } });
  const existingIds = new Set(existing.map((e) => e.id));
  const toCreate = systemConfigs.filter(([id]) => !existingIds.has(id));
  const toUpsert = systemConfigs.filter(([id]) => existingIds.has(id) && ALWAYS_UPSERT_CONFIGS.has(id));

  if (toCreate.length > 0) {
    await prisma.system_config.createMany({
      data: toCreate.map(([id, value, description, category, display_name, data_type, is_encrypted]) => ({
        id, value, description, category, display_name, data_type, is_active: true, is_encrypted,
      })),
    });
  }
  for (const [id, value, description, category, display_name, data_type, is_encrypted] of toUpsert) {
    await prisma.system_config.update({
      where: { id },
      data: { value, description, category, display_name, data_type, is_encrypted },
    });
  }
  log(`System config: done ✓  (${toCreate.length} created, ${toUpsert.length} force-updated, ${existingIds.size - toUpsert.length} skipped)`);
}

async function seedAdminUser() {
  const username = process.env["SEED_ADMIN_USERNAME"] ?? "admin";
  const email = process.env["SEED_ADMIN_EMAIL"] ?? "admin@example.com";
  const password = process.env["SEED_ADMIN_PASSWORD"] ?? "Admin@1234";
  const shouldResetPassword = process.env["SEED_ADMIN_RESET_PASSWORD"] === "true";

  log(`Admin user: "${username}"...`);
  const existing = await prisma.users.findUnique({ where: { username }, select: { id: true } });
  const passwordHash = !existing || shouldResetPassword ? await PasswordUtil.hash(password) : undefined;

  const user = existing
    ? await prisma.users.update({
        where: { id: existing.id },
        data: { email, ...(shouldResetPassword ? { password: passwordHash } : {}), is_active: true, is_email_verified: true, is_approved: true, updated_at: now() },
      })
    : await prisma.users.create({
        data: { username, email, password: passwordHash!, is_active: true, is_email_verified: true, is_approved: true, creation_type: "SYSTEM_SEED" },
      });

  await prisma.user_roles.upsert({
    where: { user_id_role_id: { user_id: user.id, role_id: "SUPERADMIN" } },
    update: { updated_at: now() },
    create: { user_id: user.id, role_id: "SUPERADMIN", remark: "Initial seed admin" },
  });
  log(`Admin user: done ✓  (${existing ? "updated" : "created"})`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const t0 = Date.now();
  console.log("\n🌱 Seeding database...\n");

  if (shouldSeedMenusOnly) {
    console.log("[1/1] Menus");
    await seedMenus();
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`\n✅ Menu seed completed in ${elapsed}s\n`);
    return;
  }

  // Step 1 — Roles & Permissions (parallel, both needed before step 2)
  console.log("[1/4] Roles & Permissions");
  await Promise.all([seedRoles(), seedPermissions()]);

  // Step 2 — Everything that depends on roles+permissions (parallel)
  console.log("\n[2/4] Role Permissions");
  await seedRolePermissions();

  // Step 3 — Independent data (parallel)
  console.log("\n[3/4] Menus · API Routes · System Config");
  await Promise.all([seedMenus(), seedApiRoutes(), seedSystemConfig()]);

  // Step 4 — Admin user
  console.log("\n[4/4] Admin User");
  await seedAdminUser();

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n✅ Seed completed in ${elapsed}s\n`);
}

main()
  .catch(async (error) => {
    console.error("\n❌ Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
