import "dotenv/config";
import { PrismaMssql } from "@prisma/adapter-mssql";
import { PrismaClient } from "../src/generated/prisma/client";
import { PasswordUtil } from "../src/utils/password";

const databaseUrl = process.env["DATABASE_URL"];

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to run the seed.");
}

const adapter = new PrismaMssql(databaseUrl);
const prisma = new PrismaClient({ adapter });

const now = () => new Date();

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
  ["roles.read", "Roles Read", "roles", "read"],
  ["roles.create", "Roles Create", "roles", "create"],
  ["roles.update", "Roles Update", "roles", "update"],
  ["roles.delete", "Roles Delete", "roles", "delete"],
  ["menus.read", "Menus Read", "menus", "read"],
  ["menus.create", "Menus Create", "menus", "create"],
  ["menus.update", "Menus Update", "menus", "update"],
  ["menus.delete", "Menus Delete", "menus", "delete"],
  ["permissions.read", "Permissions Read", "permissions", "read"],
  ["permissions.update", "Permissions Update", "permissions", "update"],
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
    sort_order: 10,
  },
  {
    code: "users",
    label: "Users",
    path: "/users",
    icon_name: "UsersRound",
    permission_id: "users.read",
    sort_order: 20,
  },
  {
    code: "roles",
    label: "Roles",
    path: "/roles",
    icon_name: "ShieldCheck",
    permission_id: "roles.read",
    sort_order: 30,
  },
  {
    code: "menus",
    label: "Menus",
    path: "/menus",
    icon_name: "Menu",
    permission_id: "menus.read",
    sort_order: 40,
  },
  {
    code: "permissions",
    label: "Permissions",
    path: "/permissions",
    icon_name: "KeyRound",
    permission_id: "permissions.read",
    sort_order: 50,
  },
  {
    code: "settings",
    label: "Settings",
    path: "/settings",
    icon_name: "Settings",
    permission_id: "settings.read",
    sort_order: 90,
  },
] as const;

const apiRoutes = [
  ["GET", "/api/dashboard", "dashboard.read"],
  ["GET", "/api/users", "users.read"],
  ["POST", "/api/users", "users.create"],
  ["PUT", "/api/users/:id", "users.update"],
  ["DELETE", "/api/users/:id", "users.delete"],
  ["GET", "/api/roles", "roles.read"],
  ["POST", "/api/roles", "roles.create"],
  ["PUT", "/api/roles/:id", "roles.update"],
  ["DELETE", "/api/roles/:id", "roles.delete"],
  ["GET", "/api/menus", "menus.read"],
  ["POST", "/api/menus", "menus.create"],
  ["PUT", "/api/menus/:id", "menus.update"],
  ["DELETE", "/api/menus/:id", "menus.delete"],
  ["GET", "/api/permissions", "permissions.read"],
  ["PUT", "/api/permissions/:id", "permissions.update"],
  ["GET", "/api/settings", "settings.read"],
  ["PUT", "/api/settings", "settings.update"],
  ["GET", "/api/sessions", "sessions.read"],
  ["DELETE", "/api/sessions/:id", "sessions.delete"],
  ["GET", "/api/audit-logs", "audit_logs.read"],
] as const;

const systemConfigs = [
  {
    id: "cron_cleanup_expired_sessions_enabled",
    value: "true",
    description: "Enable expired session cleanup cron job",
    category: "CRON",
    display_name: "Cleanup Expired Sessions Cron Enabled",
    data_type: "BOOLEAN",
  },
  {
    id: "cron_cleanup_expired_sessions_cron",
    value: "0 2 * * *",
    description: "Cron expression for expired session cleanup job",
    category: "CRON",
    display_name: "Cleanup Expired Sessions Cron Expression",
    data_type: "STRING",
  },
] as const;

async function upsertMenu(menu: (typeof menus)[number]) {
  const existing = await prisma.menu_items.findFirst({
    where: { code: menu.code },
    select: { id: true },
  });

  const data = {
    path: menu.path,
    label: menu.label,
    icon_name: menu.icon_name,
    icon_library: "lucide-react",
    code: menu.code,
    permission_id: menu.permission_id,
    sort_order: menu.sort_order,
    is_active: true,
    updated_at: now(),
  };

  if (existing) {
    return prisma.menu_items.update({
      where: { id: existing.id },
      data,
    });
  }

  return prisma.menu_items.create({
    data: {
      ...data,
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
    await upsertMenu(menu);
  }
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

async function seedRoleMenus() {
  const seededMenus = await prisma.menu_items.findMany({
    where: {
      code: {
        in: menus.map((menu) => menu.code),
      },
    },
    select: {
      id: true,
      code: true,
    },
  });

  const adminMenuCodes = new Set(["dashboard", "users", "roles", "menus", "permissions", "settings"]);
  const userMenuCodes = new Set(["dashboard"]);

  for (const menu of seededMenus) {
    const roleIds = [
      "SUPERADMIN",
      ...(adminMenuCodes.has(menu.code ?? "") ? ["ADMIN"] : []),
      ...(userMenuCodes.has(menu.code ?? "") ? ["USER"] : []),
    ];

    for (const role_id of roleIds) {
      await prisma.role_menus.upsert({
        where: {
          role_id_menu_item_id: {
            role_id,
            menu_item_id: menu.id,
          },
        },
        update: {
          can_view: true,
        },
        create: {
          role_id,
          menu_item_id: menu.id,
          can_view: true,
        },
      });
    }
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
}

async function seedSystemConfig() {
  for (const config of systemConfigs) {
    await prisma.system_config.upsert({
      where: { id: config.id },
      update: {
        value: config.value,
        description: config.description,
        category: config.category,
        display_name: config.display_name,
        data_type: config.data_type,
        is_active: true,
        is_encrypted: false,
        updated_at: now(),
      },
      create: {
        id: config.id,
        value: config.value,
        description: config.description,
        category: config.category,
        display_name: config.display_name,
        data_type: config.data_type,
        is_active: true,
        is_encrypted: false,
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
  await seedRoleMenus();
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
    await prisma.$disconnect();
  });
