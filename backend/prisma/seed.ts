import "dotenv/config";
import { PrismaMssql } from "@prisma/adapter-mssql";
import { PrismaClient } from "../src/generated/prisma/client";
import { PasswordUtil } from "../src/utils/password";
import redis, { deleteCacheKeys, REDIS_KEY_PREFIX } from "../src/config/redis.config";

const databaseUrl = process.env["DATABASE_URL"];

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to run the seed.");
}

const adapter = new PrismaMssql(databaseUrl);
const prisma = new PrismaClient({ adapter });

const now = () => new Date();
const MENU_CACHE_KEYS = ["menus:list", "menus:me:*"] as const;
const ROUTE_CACHE_KEYS = ["routes:*"] as const;

async function clearAccessCache() {
  if (!redis) return;

  try {
    const cacheKeys = await Promise.all([
      redis.keys(MENU_CACHE_KEYS[1]),
      redis.keys(`${REDIS_KEY_PREFIX}${MENU_CACHE_KEYS[1]}`),
      redis.keys(ROUTE_CACHE_KEYS[0]),
      redis.keys(`${REDIS_KEY_PREFIX}${ROUTE_CACHE_KEYS[0]}`),
    ]);
    const keys = [
      MENU_CACHE_KEYS[0],
      ...cacheKeys.flat(),
    ];

    await deleteCacheKeys(keys);
  } catch {
    // Seed should not fail if Redis is unavailable.
  }
}

const roles = [
  {
    id: "SUPERADMIN",
    name: "Super Admin",
    priority: 100,
    description: "Full access to every menu and backend route.",
  },
  {
    id: "ADMIN",
    name: "Admin",
    priority: 90,
    description: "Manage users, roles, menus, and system settings.",
  },
  {
    id: "USER",
    name: "User",
    priority: 10,
    description: "Default user role with basic application access.",
  },
] as const;

const permissions = [
  ["dashboard.read", "Dashboard Read", "dashboard", "read"],
  ["users.read", "Users Read", "users", "read"],
  ["users.create", "Users Create", "users", "create"],
  ["users.update", "Users Update", "users", "update"],
  ["users.delete", "Users Delete", "users", "delete"],
  ["users.impersonate", "Users Impersonate", "users", "impersonate"],
  ["roles.read", "Roles Read", "roles", "read"],
  ["roles.create", "Roles Create", "roles", "create"],
  ["roles.update", "Roles Update", "roles", "update"],
  ["roles.delete", "Roles Delete", "roles", "delete"],
  ["menus.read", "Menus Read", "menus", "read"],
  ["menus.create", "Menus Create", "menus", "create"],
  ["menus.update", "Menus Update", "menus", "update"],
  ["menus.delete", "Menus Delete", "menus", "delete"],
  ["permissions.read", "Permissions Read", "permissions", "read"],
  ["permissions.create", "Permissions Create", "permissions", "create"],
  ["permissions.update", "Permissions Update", "permissions", "update"],
  ["permissions.delete", "Permissions Delete", "permissions", "delete"],
  ["role-permissions.read", "Role Permissions Read", "role_permissions", "read"],
  ["role-permissions.update", "Role Permissions Update", "role_permissions", "update"],
  ["role-hierarchy.read", "Role Hierarchy Read", "role_hierarchy", "read"],
  ["role-hierarchy.create", "Role Hierarchy Create", "role_hierarchy", "create"],
  ["role-hierarchy.delete", "Role Hierarchy Delete", "role_hierarchy", "delete"],
  ["access-tokens.read", "Access Tokens Read", "access_tokens", "read"],
  ["access-tokens.create", "Access Tokens Create", "access_tokens", "create"],
  ["access-tokens.revoke", "Access Tokens Revoke", "access_tokens", "revoke"],
  ["access-tokens.delete", "Access Tokens Delete", "access_tokens", "delete"],
  ["settings.read", "Settings Read", "settings", "read"],
  ["settings.update", "Settings Update", "settings", "update"],
  ["sessions.read", "Sessions Read", "sessions", "read"],
  ["sessions.delete", "Sessions Delete", "sessions", "delete"],
  ["audit_logs.read", "Audit Logs Read", "audit_logs", "read"],
] as const;

const menus = [
  {
    code: "dashboard",
    label: "Dashboard",
    path: "/dashboard",
    icon_name: "LayoutDashboard",
    permission_id: "dashboard.read",
    parent_code: null,
    sort_order: 10,
  },
  {
    code: "admin_console",
    label: "Admin Console",
    path: "/admin-console",
    icon_name: "ShieldCheck",
    permission_id: null,
    parent_code: null,
    sort_order: 20,
  },
  {
    code: "admin_console_users",
    label: "Users",
    path: "/admin-console/users",
    icon_name: "UsersRound",
    permission_id: "users.read",
    parent_code: "admin_console",
    sort_order: 10,
  },
  {
    code: "admin_console_roles_permissions",
    label: "Roles & Permissions",
    path: "/admin-console/roles-permissions",
    icon_name: "KeyRound",
    permission_id: "role-permissions.read",
    parent_code: "admin_console",
    sort_order: 20,
  },
  {
    code: "admin_console_menus",
    label: "Menus",
    path: "/admin-console/menus",
    icon_name: "Menu",
    permission_id: "menus.read",
    parent_code: "admin_console",
    sort_order: 30,
  },
  {
    code: "settings",
    label: "Settings",
    path: "/settings",
    icon_name: "Settings",
    permission_id: "settings.read",
    parent_code: null,
    sort_order: 90,
  },
] as const;

const apiRoutes = [
  ["GET", "/api/dashboard", "dashboard.read"],

  ["GET", "/api/users", "users.read"],
  ["GET", "/api/users/deleted", "users.read"],
  ["POST", "/api/users", "users.create"],
  ["GET", "/api/users/:id", "users.read"],
  ["PUT", "/api/users/:id", "users.update"],
  ["POST", "/api/users/:id/unlock", "users.update"],
  ["DELETE", "/api/users/:id/sessions", "users.update"],
  ["POST", "/api/users/:id/reset-password", "users.update"],
  ["GET", "/api/users/:id/roles", "users.read"],
  ["PUT", "/api/users/:id/roles", "users.update"],
  ["PATCH", "/api/users/:id/status", "users.update"],
  ["PATCH", "/api/users/:id/restore", "users.update"],
  ["DELETE", "/api/users/:id", "users.delete"],
  ["DELETE", "/api/users/:id/permanent", "users.delete"],
  ["POST", "/api/auth/impersonate/:userId", "users.impersonate"],

  ["GET", "/api/menus", "menus.read"],
  ["POST", "/api/menus", "menus.create"],
  ["PUT", "/api/menus/:id", "menus.update"],
  ["DELETE", "/api/menus/:id", "menus.delete"],

  ["GET", "/api/access-control/roles-permissions", "role-permissions.read"],
  ["POST", "/api/access-control/roles", "roles.create"],
  ["POST", "/api/access-control/roles/:id/clone", "roles.create"],
  ["PUT", "/api/access-control/roles/:id", "roles.update"],
  ["DELETE", "/api/access-control/roles/:id", "roles.delete"],
  ["DELETE", "/api/access-control/roles", "roles.delete"],
  ["PUT", "/api/access-control/roles/:id/permissions", "role-permissions.update"],
  ["GET", "/api/access-control/role-hierarchy", "role-hierarchy.read"],
  ["POST", "/api/access-control/role-hierarchy", "role-hierarchy.create"],
  ["DELETE", "/api/access-control/role-hierarchy/:parentId/:childId", "role-hierarchy.delete"],
  ["POST", "/api/access-control/permissions", "permissions.create"],
  ["PUT", "/api/access-control/permissions/:id", "permissions.update"],
  ["DELETE", "/api/access-control/permissions/:id", "permissions.delete"],

  ["GET", "/api/personal-access-tokens", "access-tokens.read"],
  ["POST", "/api/personal-access-tokens", "access-tokens.create"],
  ["POST", "/api/personal-access-tokens/:id/revoke", "access-tokens.revoke"],
  ["DELETE", "/api/personal-access-tokens/:id", "access-tokens.delete"],

  ["GET", "/api/settings", "settings.read"],
  ["PUT", "/api/settings", "settings.update"],
  ["GET", "/api/sessions", "sessions.read"],
  ["DELETE", "/api/sessions/:id", "sessions.delete"],
  ["GET", "/api/audit-logs", "audit_logs.read"],
] as const;

const systemConfigs = [
  ["access_token_expiry_minutes", "60", "Access token lifetime in minutes", "AUTH", "Access Token Expiry Minutes", "NUMBER", false],
  ["account_lock_minutes", "5", "Minutes to lock an account after too many failed login attempts", "AUTH", "Account Lock Minutes", "NUMBER", false],
  ["max_active_sessions", "2", "Maximum active sessions per user", "AUTH", "Max Active Sessions", "NUMBER", false],
  ["max_login_attempts", "5", "Maximum failed login attempts before account lock", "AUTH", "Max Login Attempts", "NUMBER", false],
  ["password_expiry_days", "90", "Password expiry period in days", "AUTH", "Password Expiry Days", "NUMBER", false],
  ["refresh_token_expiry_minutes", "10080", "Refresh token lifetime in minutes", "AUTH", "Refresh Token Expiry Minutes", "NUMBER", false],
  ["session_expiry_minutes", "2880", "Session lifetime in minutes", "AUTH", "Session Expiry Minutes", "NUMBER", false],
  ["cron_cleanup_expired_sessions_cron", "0 2 * * *", "Cron expression for expired session cleanup job", "CRON", "Cleanup Expired Sessions Cron Expression", "STRING", false],
  ["cron_cleanup_expired_sessions_enabled", "true", "Enable expired session cleanup cron job", "CRON", "Cleanup Expired Sessions Cron Enabled", "BOOLEAN", false],
  ["redis_db", "0", "Redis database index", "REDIS", "Redis DB Index", "NUMBER", false],
  ["redis_enabled", "true", "Enable Redis cache and presence features", "REDIS", "Redis Enabled", "BOOLEAN", false],
  ["redis_host", "172.17.235.1", "Redis host", "REDIS", "Redis Host", "STRING", false],
  ["redis_password", "", "Redis password. Set this in the database or settings UI.", "REDIS", "Redis Password", "STRING", true],
  ["redis_port", "1999", "Redis port", "REDIS", "Redis Port", "NUMBER", false],
  ["smtp_enabled", "true", "Enable SMTP email sending", "SMTP", "SMTP Enabled", "BOOLEAN", false],
  ["smtp_from_email", "test", "SMTP sender email address", "SMTP", "SMTP From Email", "STRING", false],
  ["smtp_from_name", "IT Utilities", "SMTP sender display name", "SMTP", "SMTP From Name", "STRING", false],
  ["smtp_host", "smtp.gmail.com", "SMTP host", "SMTP", "SMTP Host", "STRING", false],
  ["smtp_password", "", "SMTP password. Set this in the database or settings UI.", "SMTP", "SMTP Password", "STRING", true],
  ["smtp_port", "587", "SMTP port", "SMTP", "SMTP Port", "NUMBER", false],
  ["smtp_require_tls", "true", "Require TLS for SMTP connection", "SMTP", "SMTP Require TLS", "BOOLEAN", false],
  ["smtp_secure", "false", "Use secure SMTP connection", "SMTP", "SMTP Secure", "BOOLEAN", false],
  ["smtp_user", "jarudat.jc@gmail.com", "SMTP username", "SMTP", "SMTP User", "STRING", false],
] as const;

async function createMenuIfMissing(menu: (typeof menus)[number]) {
  const existing = await prisma.menu_items.findFirst({
    where: { code: menu.code },
    select: { id: true },
  });

  if (existing) {
    return existing;
  }

  const parent = menu.parent_code
    ? await prisma.menu_items.findFirst({
        where: { code: menu.parent_code },
        select: { id: true },
      })
    : null;

  return prisma.menu_items.create({
    data: {
      path: menu.path,
      label: menu.label,
      icon_name: menu.icon_name,
      icon_library: "lucide-react",
      code: menu.code,
      permission_id: menu.permission_id,
      parent_id: parent?.id ?? null,
      sort_order: menu.sort_order,
      is_active: true,
      created_at: now(),
    },
  });
}

async function seedRoles() {
  for (const role of roles) {
    await prisma.roles.upsert({
      where: { id: role.id },
      update: {
        name: role.name,
        priority: role.priority,
        description: role.description,
        updated_at: now(),
      },
      create: {
        id: role.id,
        name: role.name,
        priority: role.priority,
        description: role.description,
      },
    });
  }
}

async function seedPermissions() {
  for (const [id, name, resource, action] of permissions) {
    await prisma.permissions.upsert({
      where: { id },
      update: {
        name,
        resource,
        action,
        updated_at: now(),
      },
      create: {
        id,
        name,
        resource,
        action,
        description: `${action} access for ${resource}`,
      },
    });
  }
}

async function seedMenus() {
  for (const menu of menus) {
    await createMenuIfMissing(menu);
  }

  await clearAccessCache();
}

async function seedRolePermissions() {
  const allPermissionIds = permissions.map(([id]) => id);
  const adminPermissionIds = allPermissionIds.filter((id) => id !== "audit_logs.read");
  const userPermissionIds = ["dashboard.read"];

  const assignments = [
    ...allPermissionIds.map((permissionId) => ["SUPERADMIN", permissionId] as const),
    ...adminPermissionIds.map((permissionId) => ["ADMIN", permissionId] as const),
    ...userPermissionIds.map((permissionId) => ["USER", permissionId] as const),
  ];

  for (const [role_id, permission_id] of assignments) {
    await prisma.role_permissions.upsert({
      where: {
        role_id_permission_id: {
          role_id,
          permission_id,
        },
      },
      update: {},
      create: {
        role_id,
        permission_id,
      },
    });
  }
}

async function seedApiRoutes() {
  for (const [method, path, permission_id] of apiRoutes) {
    await prisma.api_route_requirements.upsert({
      where: {
        method_path: {
          method,
          path,
        },
      },
      update: {
        permission_id,
        role_id: null,
        is_active: true,
        updated_at: now(),
      },
      create: {
        method,
        path,
        permission_id,
        is_active: true,
      },
    });
  }

  await clearAccessCache();
}

async function seedSystemConfig() {
  for (const [id, value, description, category, display_name, data_type, is_encrypted] of systemConfigs) {
    const existing = await prisma.system_config.findUnique({
      where: { id },
      select: { id: true },
    });

    if (existing) {
      continue;
    }

    await prisma.system_config.create({
      data: {
        id,
        value,
        description,
        category,
        display_name,
        data_type,
        is_active: true,
        is_encrypted,
      },
    });
  }
}

async function seedAdminUser() {
  const username = process.env["SEED_ADMIN_USERNAME"] ?? "admin";
  const email = process.env["SEED_ADMIN_EMAIL"] ?? "admin@example.com";
  const password = process.env["SEED_ADMIN_PASSWORD"] ?? "Admin@1234";
  const shouldResetPassword = process.env["SEED_ADMIN_RESET_PASSWORD"] === "true";

  const existing = await prisma.users.findUnique({
    where: { username },
    select: { id: true },
  });

  const passwordHash =
    !existing || shouldResetPassword ? await PasswordUtil.hash(password) : undefined;

  const user = existing
    ? await prisma.users.update({
        where: { id: existing.id },
        data: {
          email,
          ...(shouldResetPassword ? { password: passwordHash } : {}),
          is_active: true,
          is_email_verified: true,
          is_approved: true,
          updated_at: now(),
        },
      })
    : await prisma.users.create({
        data: {
          username,
          email,
          password: passwordHash!,
          is_active: true,
          is_email_verified: true,
          is_approved: true,
          creation_type: "SYSTEM_SEED",
        },
      });

  await prisma.user_roles.upsert({
    where: {
      user_id_role_id: {
        user_id: user.id,
        role_id: "SUPERADMIN",
      },
    },
    update: {
      updated_at: now(),
    },
    create: {
      user_id: user.id,
      role_id: "SUPERADMIN",
      remark: "Initial seed admin",
    },
  });
}

async function main() {
  await seedRoles();
  await seedPermissions();
  await seedMenus();
  await seedRolePermissions();
  await seedApiRoutes();
  await seedSystemConfig();
  await seedAdminUser();
}

main()
  .then(async () => {
    console.log("Seed completed.");
  })
  .catch(async (error) => {
    console.error("Seed failed.");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (redis) await redis.quit();
    await prisma.$disconnect();
  });
