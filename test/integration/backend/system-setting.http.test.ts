import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import prisma, { loginSafeMarker, uniqueMarker } from "../../helpers/db";
import { apiRequest } from "../../helpers/app";
import { PasswordUtil } from "../../../backend/src/utils/password";
import { withSettingOverride, restorePendingSettingOverrides } from "../../helpers/settings";

// Scope note: this file only covers the lower-risk general/security settings (maintenance,
// IP blocklist, CORS) using the save/restore pattern. It deliberately does NOT touch
// system-setting/integration-setting.service.ts (Redis/SMTP/Storage) — those call
// reloadRedis()/reloadSmtp()/swap the live storage provider, which would disrupt the real
// Redis/SMTP connections this dev environment now has configured. See planning/Task-unit.md.

function id(label: string) {
  return `zzt_${label}_${Math.random().toString(36).slice(2, 8)}`;
}

const ROLE_ID = id("settings-admin");
const PERMISSIONS = [
  "settings.general.maintenance.read", "settings.general.maintenance.update",
  "settings.security.ip-blocklist.read", "settings.security.ip-blocklist.update",
  "settings.security.cors.read", "settings.security.cors.update",
];
let callerId: number;
let jar: Record<string, string> = {};

// upsertSettingValue() stamps `system_config.last_modified_by_id` with the caller's user id,
// which is a real FK (onDelete: NoAction) — capture the original modifiers so the disposable
// caller can be deleted again afterward without violating that constraint.
const TOUCHED_CONFIG_IDS = ["maintenance_mode", "maintenance_message", "cors_allowed_origins"];
let originalModifiedBy: Array<{ id: string; last_modified_by_id: number | null }> = [];

afterAll(restorePendingSettingOverrides);

beforeAll(async () => {
  originalModifiedBy = await prisma.system_config.findMany({
    where: { id: { in: TOUCHED_CONFIG_IDS } },
    select: { id: true, last_modified_by_id: true },
  });

  const marker = loginSafeMarker("set-call");
  const caller = await prisma.users.create({
    data: { username: marker, email: `${marker.replace(/:/g, ".")}@example.invalid`, password: await PasswordUtil.hash("Caller-Pass1!"), is_active: true, is_approved: true },
  });
  callerId = caller.id;

  await Promise.all(
    PERMISSIONS.map(async (permId) => {
      const existing = await prisma.permissions.findUnique({ where: { id: permId } });
      if (!existing) {
        const [resource, action] = [permId.split(".").slice(0, -1).join("."), permId.split(".").pop()!];
        await prisma.permissions.create({ data: { id: permId, name: uniqueMarker(`perm-${permId}`), resource, action } });
      }
    }),
  );
  await prisma.roles.create({ data: { id: ROLE_ID, name: uniqueMarker("role-settings-admin") } });
  await prisma.role_permissions.createMany({ data: PERMISSIONS.map((permission_id) => ({ role_id: ROLE_ID, permission_id })) });
  await prisma.user_roles.create({ data: { user_id: caller.id, role_id: ROLE_ID } });

  jar = {};
  await apiRequest("POST", "/api/auth/login", { body: { username: caller.username, password: "Caller-Pass1!" }, jar });
}, 20000);

afterAll(async () => {
  await new Promise((resolve) => setTimeout(resolve, 1000));
  await prisma.user_roles.deleteMany({ where: { role_id: ROLE_ID } });
  await prisma.role_permissions.deleteMany({ where: { role_id: ROLE_ID } });
  await prisma.roles.delete({ where: { id: ROLE_ID } }).catch(() => {});
  await Promise.all(
    originalModifiedBy.map((row) =>
      prisma.system_config.update({ where: { id: row.id }, data: { last_modified_by_id: row.last_modified_by_id } }).catch(() => {}),
    ),
  );
  await prisma.notifications.deleteMany({ where: { user_id: callerId } });
  await prisma.session.deleteMany({ where: { user_id: callerId } });
  await prisma.auth_history.deleteMany({ where: { user_id: callerId } });
  await prisma.users.delete({ where: { id: callerId } });
}, 15000);

describe("system-setting (general/security) HTTP endpoints (real DB, settings restored after)", () => {
  test("GET/PUT maintenance mode round-trips and is restored", async () => {
    await withSettingOverride("maintenance_mode", "false", async () => {
      await withSettingOverride("maintenance_message", "", async () => {
        const get = await apiRequest("GET", "/api/system-setting/general/maintenance", { jar });
        expect(get.status).toBe(200);
        expect((get.json as any).data.enabled).toBe(false);

        const put = await apiRequest("PUT", "/api/system-setting/general/maintenance", {
          body: { enabled: true, message: "Down for testing" },
          jar,
        });
        expect(put.status).toBe(200);
        expect((put.json as any).data.enabled).toBe(true);
        expect((put.json as any).data.message).toBe("Down for testing");

        const reGet = await apiRequest("GET", "/api/system-setting/general/maintenance", { jar });
        expect((reGet.json as any).data.enabled).toBe(true);
      });
    });
  }, 15000);

  test("IP blocklist: add -> reject duplicate/invalid -> remove", async () => {
    const testIp = "203.0.113.250";

    const invalid = await apiRequest("POST", "/api/system-setting/security/ip-blocklist", {
      body: { ipAddress: "not-an-ip" },
      jar,
    });
    expect(invalid.status).toBe(500);

    const add = await apiRequest("POST", "/api/system-setting/security/ip-blocklist", {
      body: { ipAddress: testIp, reason: "test block" },
      jar,
    });
    expect(add.status).toBe(200);
    const entryId = (add.json as any).data.id;

    try {
      const dup = await apiRequest("POST", "/api/system-setting/security/ip-blocklist", {
        body: { ipAddress: testIp },
        jar,
      });
      expect(dup.status).toBe(500);

      const list = await apiRequest("GET", "/api/system-setting/security/ip-blocklist", { jar });
      expect((list.json as any).data.some((e: any) => e.ipAddress === testIp)).toBe(true);

      const remove = await apiRequest("DELETE", `/api/system-setting/security/ip-blocklist/${entryId}`, { jar });
      expect(remove.status).toBe(200);
      expect(await prisma.ip_blocklist.findUnique({ where: { id: entryId } })).toBe(null);
    } finally {
      await prisma.ip_blocklist.deleteMany({ where: { ip_address: testIp } });
    }
  }, 20000);

  test("CORS origins: update and restore", async () => {
    const original = await prisma.system_config.findUnique({ where: { id: "cors_allowed_origins" } });

    try {
      const put = await apiRequest("PUT", "/api/system-setting/security/cors", {
        body: { origins: ["https://example.invalid", "not a url"] },
        jar,
      });
      expect(put.status).toBe(200);
      // Invalid URLs are filtered out server-side.
      expect((put.json as any).data.origins).toEqual(["https://example.invalid"]);

      const get = await apiRequest("GET", "/api/system-setting/security/cors", { jar });
      expect((get.json as any).data.origins).toEqual(["https://example.invalid"]);
    } finally {
      if (original) {
        await prisma.system_config.update({ where: { id: "cors_allowed_origins" }, data: { value: original.value } });
      } else {
        await prisma.system_config.delete({ where: { id: "cors_allowed_origins" } }).catch(() => {});
      }
    }
  }, 15000);
});
