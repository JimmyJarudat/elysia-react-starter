import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import prisma, { loginSafeMarker, uniqueMarker } from "../../../helpers/db";
import { apiRequest } from "../../../helpers/app";
import { PasswordUtil } from "../../../../backend/src/utils/password";

function id(label: string) {
  return `zzt_${label}_${Math.random().toString(36).slice(2, 8)}`;
}

const ROLE_ID = id("ldap-admin");
const PERMISSIONS = [
  "settings.integrations.ldap.read",
  "settings.integrations.ldap.update",
];
const ROUTES = [
  ["GET", "/api/system-setting/integrations/ldap", "settings.integrations.ldap.read"],
  ["PUT", "/api/system-setting/integrations/ldap", "settings.integrations.ldap.update"],
  ["POST", "/api/system-setting/integrations/ldap/fetch-user", "settings.integrations.ldap.update"],
] as const;
const CONFIG_IDS = [
  "ldap_enabled",
  "ldap_url",
  "ldap_encryption",
  "ldap_bind_dn",
  "ldap_bind_password",
  "ldap_base_dn",
  "ldap_user_filter",
];

let callerId: number;
let jar: Record<string, string> = {};
let originalConfigs: Array<{ id: string; value: string; last_modified_by_id: number | null } | null> = [];
let originalRoutes: Array<{
  method: string;
  path: string;
  role_id: string | null;
  permission_id: string | null;
  is_active: boolean;
} | null> = [];

beforeAll(async () => {
  originalConfigs = await Promise.all(
    CONFIG_IDS.map((configId) =>
      prisma.system_config.findUnique({
        where: { id: configId },
        select: { id: true, value: true, last_modified_by_id: true },
      }),
    ),
  );
  originalRoutes = await Promise.all(
    ROUTES.map(([method, path]) =>
      prisma.api_route_requirements.findUnique({
        where: { method_path: { method, path } },
        select: { method: true, path: true, role_id: true, permission_id: true, is_active: true },
      }),
    ),
  );

  await Promise.all(
    PERMISSIONS.map(async (permId) => {
      const existing = await prisma.permissions.findUnique({ where: { id: permId } });
      if (!existing) {
        await prisma.permissions.create({
          data: {
            id: permId,
            name: uniqueMarker(`perm-${permId}`),
            resource: permId.split(".").slice(0, -1).join("."),
            action: permId.split(".").at(-1) ?? "read",
          },
        });
      }
    }),
  );
  await Promise.all(
    ROUTES.map(([method, path, permission_id]) =>
      prisma.api_route_requirements.upsert({
        where: { method_path: { method, path } },
        update: { permission_id, role_id: null, is_active: true },
        create: { method, path, permission_id, role_id: null, is_active: true },
      }),
    ),
  );

  const marker = loginSafeMarker("ldap-call");
  const caller = await prisma.users.create({
    data: {
      username: marker,
      email: `${marker.replace(/:/g, ".")}@example.invalid`,
      password: await PasswordUtil.hash("Caller-Pass1!"),
      is_active: true,
      is_approved: true,
    },
  });
  callerId = caller.id;

  await prisma.roles.create({ data: { id: ROLE_ID, name: uniqueMarker("role-ldap-admin") } });
  await prisma.role_permissions.createMany({ data: PERMISSIONS.map((permission_id) => ({ role_id: ROLE_ID, permission_id })) });
  await prisma.user_roles.create({ data: { user_id: caller.id, role_id: ROLE_ID } });

  jar = {};
  await apiRequest("POST", "/api/auth/login", { body: { username: caller.username, password: "Caller-Pass1!" }, jar });
}, 20000);

afterAll(async () => {
  await new Promise((resolve) => setTimeout(resolve, 1000));
  await Promise.all(
    originalConfigs.map((row, index) => {
      const id = CONFIG_IDS[index];
      return row
        ? prisma.system_config.update({
          where: { id },
          data: { value: row.value, last_modified_by_id: row.last_modified_by_id },
        }).catch(() => {})
        : prisma.system_config.delete({ where: { id } }).catch(() => {});
    }),
  );
  await Promise.all(
    originalRoutes.map((row, index) => {
      const [method, path] = ROUTES[index];
      return row
        ? prisma.api_route_requirements.update({
          where: { method_path: { method, path } },
          data: { role_id: row.role_id, permission_id: row.permission_id, is_active: row.is_active },
        }).catch(() => {})
        : prisma.api_route_requirements.delete({ where: { method_path: { method, path } } }).catch(() => {});
    }),
  );
  await prisma.user_roles.deleteMany({ where: { role_id: ROLE_ID } });
  await prisma.role_permissions.deleteMany({ where: { role_id: ROLE_ID } });
  await prisma.roles.delete({ where: { id: ROLE_ID } }).catch(() => {});
  await prisma.notifications.deleteMany({ where: { user_id: callerId } });
  await prisma.session.deleteMany({ where: { user_id: callerId } });
  await prisma.auth_history.deleteMany({ where: { user_id: callerId } });
  await prisma.users.delete({ where: { id: callerId } });
}, 15000);

describe("LDAP integration HTTP endpoints", () => {
  test("GET/PUT settings and returns lookup failure from an unreachable real LDAP server", async () => {
    const getBefore = await apiRequest("GET", "/api/system-setting/integrations/ldap", { jar });
    expect(getBefore.status).toBe(200);
    expect((getBefore.json as any).success).toBe(true);

    const put = await apiRequest("PUT", "/api/system-setting/integrations/ldap", {
      jar,
      body: {
        enabled: true,
        url: "ldap://test.example.invalid:389",
        encryption: "starttls",
        bindDn: "cn=admin,dc=example,dc=invalid",
        bindPassword: "Secret-Pass1!",
        baseDn: "dc=example,dc=invalid",
        userFilter: "(&(objectClass=person)(uid={{username}}))",
      },
    });
    expect(put.status).toBe(200);
    expect((put.json as any).data.enabled).toBe(true);
    expect((put.json as any).data.hasBindPassword).toBe(true);
    expect((put.json as any).data.bindPassword).toBeUndefined();

    const fetch = await apiRequest("POST", "/api/system-setting/integrations/ldap/fetch-user", {
      jar,
      body: { username: "j.smith" },
    });
    expect(fetch.status).toBe(200);
    expect((fetch.json as any).success).toBe(false);
    expect(typeof (fetch.json as any).message).toBe("string");
    expect((fetch.json as any).data).toBeUndefined();
  }, 15000);
});
