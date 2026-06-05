import "dotenv/config";
import { PrismaMssql } from "@prisma/adapter-mssql";
import { PrismaClient } from "../src/generated/prisma/client";
import { PasswordUtil } from "../src/utils/password";

const databaseUrl = process.env["DATABASE_URL"];
if (!databaseUrl) throw new Error("DATABASE_URL is required to run the seed.");

const adapter = new PrismaMssql(databaseUrl);
const prisma = new PrismaClient({ adapter });

const now = () => new Date();

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
  ["sessions.read",                 "Sessions Read",                 "sessions",             "read"],
  ["sessions.delete",               "Sessions Delete",               "sessions",             "delete"],
  ["audit_logs.read",               "Audit Logs Read",               "audit_logs",           "read"],
  ["api-route-requirements.read",   "API Route Requirements Read",   "api_route_requirements","read"],
  ["api-route-requirements.update", "API Route Requirements Update", "api_route_requirements","update"],
  ["api-route-requirements.delete", "API Route Requirements Delete", "api_route_requirements","delete"],
] as const;

const menus = [
  { code: "dashboard",                          label: "Dashboard",          path: "/dashboard",                          icon_name: "LayoutDashboard",    permission_id: "dashboard.read",          parent_code: null,          sort_order: 10 },
  { code: "admin_console",                      label: "Admin Console",      path: "/admin-console",                      icon_name: "ShieldCheck",        permission_id: null,                      parent_code: null,          sort_order: 20 },
  { code: "admin_console_users",                label: "Users",              path: "/admin-console/users",                icon_name: "UsersRound",         permission_id: "users.read",              parent_code: "admin_console", sort_order: 10 },
  { code: "admin_console_roles_permissions",    label: "Roles & Permissions",path: "/admin-console/roles-permissions",    icon_name: "KeyRound",           permission_id: "role-permissions.read",   parent_code: "admin_console", sort_order: 20 },
  { code: "admin_console_menus",                label: "Sidebar Menus",      path: "/admin-console/menus",                icon_name: "Menu",               permission_id: "menus.read",              parent_code: "admin_console", sort_order: 30 },
  { code: "admin_console_api_route_requirements",label: "API Routes",        path: "/admin-console/api-route-requirements",icon_name: "Route",             permission_id: "api-route-requirements.read", parent_code: "admin_console", sort_order: 40 },
  { code: "settings",                           label: "System Settings",    path: "/settings",                           icon_name: "Settings",           permission_id: "settings.read",           parent_code: null,          sort_order: 90 },
  { code: "settings_general",                   label: "General",            path: "/settings/general",                   icon_name: "SlidersHorizontal",  permission_id: "settings.read",           parent_code: "settings",    sort_order: 10 },
  { code: "settings_security",                  label: "Security",           path: "/settings/security",                  icon_name: "ShieldCheck",        permission_id: "settings.read",           parent_code: "settings",    sort_order: 20 },
  { code: "settings_integrations",              label: "Integrations",       path: "/settings/integrations",              icon_name: "Plug",               permission_id: "settings.read",           parent_code: "settings",    sort_order: 30 },
] as const;

const apiRoutes = [
  ["GET",    "/api/dashboard",                                          "dashboard.read"],
  ["GET",    "/api/users",                                              "users.read"],
  ["GET",    "/api/users/deleted",                                      "users.read"],
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
  ["POST",   "/api/auth/impersonate/:userId",                           "users.impersonate"],
  ["GET",    "/api/menus",                                              "menus.read"],
  ["POST",   "/api/menus",                                              "menus.create"],
  ["PUT",    "/api/menus/:id",                                          "menus.update"],
  ["DELETE", "/api/menus/:id",                                          "menus.delete"],
  ["GET",    "/api/access-control/roles-permissions",                   "role-permissions.read"],
  ["POST",   "/api/access-control/roles",                               "roles.create"],
  ["POST",   "/api/access-control/roles/:id/clone",                     "roles.create"],
  ["PUT",    "/api/access-control/roles/:id",                           "roles.update"],
  ["DELETE", "/api/access-control/roles/:id",                           "roles.delete"],
  ["DELETE", "/api/access-control/roles",                               "roles.delete"],
  ["PUT",    "/api/access-control/roles/:id/permissions",               "role-permissions.update"],
  ["GET",    "/api/access-control/role-hierarchy",                      "role-hierarchy.read"],
  ["POST",   "/api/access-control/role-hierarchy",                      "role-hierarchy.create"],
  ["DELETE", "/api/access-control/role-hierarchy/:parentId/:childId",   "role-hierarchy.delete"],
  ["POST",   "/api/access-control/permissions",                         "permissions.create"],
  ["PUT",    "/api/access-control/permissions/:id",                     "permissions.update"],
  ["DELETE", "/api/access-control/permissions/:id",                     "permissions.delete"],
  ["GET",    "/api/personal-access-tokens",                             "access-tokens.read"],
  ["POST",   "/api/personal-access-tokens",                             "access-tokens.create"],
  ["POST",   "/api/personal-access-tokens/:id/revoke",                  "access-tokens.revoke"],
  ["DELETE", "/api/personal-access-tokens/:id",                         "access-tokens.delete"],
  ["GET",    "/api/settings",                                           "settings.read"],
  ["PUT",    "/api/settings",                                           "settings.update"],
  ["GET",    "/api/system-setting/organization-support",                "settings.read"],
  ["PUT",    "/api/system-setting/organization-support",                "settings.update"],
  ["GET",    "/api/system-setting/registration",                        "settings.read"],
  ["PUT",    "/api/system-setting/registration",                        "settings.update"],
  ["GET",    "/api/system-setting/security",                            "settings.read"],
  ["PUT",    "/api/system-setting/security",                            "settings.update"],
  ["GET",    "/api/system-setting/ip-blocklist",                        "settings.read"],
  ["POST",   "/api/system-setting/ip-blocklist",                        "settings.update"],
  ["DELETE", "/api/system-setting/ip-blocklist/:id",                    "settings.update"],
  ["GET",    "/api/system-setting/smtp",                                "settings.read"],
  ["PUT",    "/api/system-setting/smtp",                                "settings.update"],
  ["POST",   "/api/system-setting/smtp/test",                           "settings.update"],
  ["POST",   "/api/system-setting/smtp/send-test",                      "settings.update"],
  ["GET",    "/api/system-setting/redis",                               "settings.read"],
  ["PUT",    "/api/system-setting/redis",                               "settings.update"],
  ["POST",   "/api/system-setting/redis/test",                          "settings.update"],
  ["GET",    "/api/system-setting/redis/status",                        "settings.read"],
  ["GET",    "/api/system-setting/redis/keys",                          "settings.read"],
  ["POST",   "/api/system-setting/redis/key",                           "settings.read"],
  ["DELETE", "/api/system-setting/redis/key",                           "settings.update"],
  ["POST",   "/api/system-setting/redis/clear",                         "settings.update"],
  ["PUT",    "/api/system-setting/identity",                            "settings.update"],
  ["GET",    "/api/system-setting/regional",                            "settings.read"],
  ["PUT",    "/api/system-setting/regional",                            "settings.update"],
  ["GET",    "/api/system-setting/maintenance",                         "settings.read"],
  ["PUT",    "/api/system-setting/maintenance",                         "settings.update"],
  ["GET",    "/api/sessions",                                           "sessions.read"],
  ["DELETE", "/api/sessions/:id",                                       "sessions.delete"],
  ["GET",    "/api/audit-logs",                                         "audit_logs.read"],
  ["GET",    "/api/api-route-requirements",                             "api-route-requirements.read"],
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
  ["organization_name",                        "",             "Organization display name",                                           "ORGANIZATION",    "Organization Name",                        "STRING",  false],
  ["support_email",                            "",             "Support contact email",                                               "ORGANIZATION",    "Support Email",                            "STRING",  false],
  ["website_url",                              "",             "Organization website URL",                                            "ORGANIZATION",    "Website URL",                              "STRING",  false],
  ["help_center_url",                          "/help",        "Help center path or URL",                                             "ORGANIZATION",    "Help Center URL",                          "STRING",  false],
  ["system_name",                              "IT Utils",     "Primary application name",                                            "SYSTEM_IDENTITY", "System Name",                              "STRING",  false],
  ["system_subtitle",                          "Internal tools and admin workspace", "Short application subtitle",                    "SYSTEM_IDENTITY", "System Subtitle",                          "STRING",  false],
  ["app_title",                                "IT Utils",     "Browser document title",                                             "SYSTEM_IDENTITY", "App Title",                                "STRING",  false],
  ["app_title_mode",                           "title_only",   "Browser title display mode",                                         "SYSTEM_IDENTITY", "App Title Mode",                           "STRING",  false],
  ["system_logo_url",                          "",             "Application logo path or URL",                                        "SYSTEM_IDENTITY", "System Logo URL",                          "STRING",  false],
  ["system_favicon_url",                       "",             "Browser favicon path or URL",                                         "SYSTEM_IDENTITY", "System Favicon URL",                       "STRING",  false],
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
  log(`Menus: checking ${menus.length}...`);
  // ดึง existing menus ทีเดียว
  const existingMenus = await prisma.menu_items.findMany({ select: { id: true, code: true, path: true } });
  const existingCodes = new Set(existingMenus.map((m) => m.code).filter(Boolean));
  const existingPaths = new Set(existingMenus.map((m) => m.path));
  const codeToId = new Map(existingMenus.filter(m => m.code).map((m) => [m.code!, m.id]));

  let created = 0;
  for (const menu of menus) {
    if (existingCodes.has(menu.code) || existingPaths.has(menu.path)) continue;

    const parentId = menu.parent_code ? codeToId.get(menu.parent_code) ?? null : null;
    const created_ = await prisma.menu_items.create({
      data: {
        path: menu.path, label: menu.label, icon_name: menu.icon_name,
        icon_library: "lucide-react", code: menu.code,
        permission_id: menu.permission_id, parent_id: parentId,
        sort_order: menu.sort_order, is_active: true, created_at: now(),
      },
    });
    codeToId.set(menu.code, created_.id);
    created++;
  }
  log(`Menus: done ✓  (${created} created, ${menus.length - created} skipped)`);
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

  const toCreate: { method: string; path: string; permission_id: string; is_active: boolean }[] = [];
  const toUpdate: { method: string; path: string; permission_id: string }[] = [];

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

async function seedSystemConfig() {
  log(`System config: checking ${systemConfigs.length}...`);
  const existing = await prisma.system_config.findMany({ select: { id: true } });
  const existingIds = new Set(existing.map((e) => e.id));
  const toCreate = systemConfigs.filter(([id]) => !existingIds.has(id));

  if (toCreate.length > 0) {
    await prisma.system_config.createMany({
      data: toCreate.map(([id, value, description, category, display_name, data_type, is_encrypted]) => ({
        id, value, description, category, display_name, data_type, is_active: true, is_encrypted,
      })),
    });
  }
  log(`System config: done ✓  (${toCreate.length} created, ${existingIds.size} skipped)`);
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
