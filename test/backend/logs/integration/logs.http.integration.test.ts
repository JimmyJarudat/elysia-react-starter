import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import prisma, { loginSafeMarker, uniqueMarker } from "../../../helpers/db";
import { apiRequest } from "../../../helpers/app";
import { PasswordUtil } from "../../../../backend/src/utils/password";

function id(label: string) {
  return `zzt_${label}_${Math.random().toString(36).slice(2, 8)}`;
}

const ROLE_ID = id("logs-admin");
const PERMISSIONS = [
  "activity_logs.read", "audit_logs.read", "auth_logs.read",
  "error_logs.read", "system_events.read", "request_logs.read",
];
let callerId: number;
let jar: Record<string, string> = {};

beforeAll(async () => {
  const marker = loginSafeMarker("logs-call");
  const caller = await prisma.users.create({
    data: { username: marker, email: `${marker.replace(/:/g, ".")}@example.invalid`, password: await PasswordUtil.hash("Caller-Pass1!"), is_active: true, is_approved: true },
  });
  callerId = caller.id;

  await Promise.all(
    PERMISSIONS.map(async (permId) => {
      const existing = await prisma.permissions.findUnique({ where: { id: permId } });
      if (!existing) {
        const [resource, action] = permId.split(".");
        await prisma.permissions.create({ data: { id: permId, name: uniqueMarker(`perm-${permId}`), resource, action } });
      }
    }),
  );
  await prisma.roles.create({ data: { id: ROLE_ID, name: uniqueMarker("role-logs-admin") } });
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
  await prisma.notifications.deleteMany({ where: { user_id: callerId } });
  await prisma.session.deleteMany({ where: { user_id: callerId } });
  await prisma.auth_history.deleteMany({ where: { user_id: callerId } });
  await prisma.users.delete({ where: { id: callerId } });
}, 15000);

describe("logs HTTP endpoints (real DB)", () => {
  test("GET /activity finds a disposable row by search; /activity/resources lists resource types", async () => {
    const marker = uniqueMarker("logs-activity");
    const row = await prisma.activity_logs.create({
      data: { username: marker, action: "CREATE", resource_type: "zzt_widget", description: marker },
    });

    try {
      const res = await apiRequest("GET", `/api/logs/activity?search=${encodeURIComponent(marker)}`, { jar });
      expect(res.status).toBe(200);
      expect((res.json as any).data.logs.some((i: any) => i.id === String(row.id) || i.id === row.id)).toBe(true);

      const resources = await apiRequest("GET", "/api/logs/activity/resources", { jar });
      expect(resources.status).toBe(200);
      expect(Array.isArray((resources.json as any).data)).toBe(true);
    } finally {
      await prisma.activity_logs.delete({ where: { id: row.id } });
    }
  }, 15000);

  test("GET /audit finds a disposable row by table name search", async () => {
    const marker = uniqueMarker("logs-audit");
    const row = await prisma.audit_logs.create({
      data: { username: marker, action: "UPDATE", table_name: marker, record_id: "1" },
    });

    try {
      const res = await apiRequest("GET", `/api/logs/audit?search=${encodeURIComponent(marker)}`, { jar });
      expect(res.status).toBe(200);
      expect((res.json as any).data.logs.length).toBeGreaterThan(0);
    } finally {
      await prisma.audit_logs.delete({ where: { id: row.id } });
    }
  }, 15000);

  test("GET /auth finds a disposable row by username search", async () => {
    const marker = uniqueMarker("logs-auth");
    const row = await prisma.auth_history.create({
      data: { username: marker, auth_type: "LOGIN", auth_status: "SUCCESS" },
    });

    try {
      const res = await apiRequest("GET", `/api/logs/auth?search=${encodeURIComponent(marker)}`, { jar });
      expect(res.status).toBe(200);
      expect((res.json as any).data.logs.length).toBeGreaterThan(0);
    } finally {
      await prisma.auth_history.delete({ where: { id: row.id } });
    }
  }, 15000);

  test("GET /error finds a disposable row; PATCH /error/:id/resolve toggles resolution", async () => {
    const marker = uniqueMarker("logs-error");
    const row = await prisma.error_logs.create({
      data: { message: marker, level: "error", source: "test" },
    });

    try {
      const res = await apiRequest("GET", `/api/logs/error?search=${encodeURIComponent(marker)}`, { jar });
      expect(res.status).toBe(200);
      expect((res.json as any).data.logs.length).toBeGreaterThan(0);

      const resolve = await apiRequest("PATCH", `/api/logs/error/${row.id}/resolve`, { body: { resolved: true }, jar });
      expect(resolve.status).toBe(200);
      expect((await prisma.error_logs.findUnique({ where: { id: row.id } }))?.resolved).toBe(true);
    } finally {
      await prisma.error_logs.delete({ where: { id: row.id } });
    }
  }, 15000);

  test("GET /system-events finds a disposable row by search", async () => {
    const marker = uniqueMarker("logs-event");
    const row = await prisma.system_events.create({
      data: { event_type: "SYSTEM", event_name: marker, status: "success" },
    });

    try {
      const res = await apiRequest("GET", `/api/logs/system-events?search=${encodeURIComponent(marker)}`, { jar });
      expect(res.status).toBe(200);
      expect((res.json as any).data.events.length).toBeGreaterThan(0);
    } finally {
      await prisma.system_events.delete({ where: { id: row.id } });
    }
  }, 15000);

  test("GET /request lists request logs (real ones generated by this very HTTP call) and /request/analytics returns a summary", async () => {
    const res = await apiRequest("GET", "/api/logs/request?pageSize=5", { jar });
    expect(res.status).toBe(200);
    expect(Array.isArray((res.json as any).data.logs)).toBe(true);

    const analytics = await apiRequest("GET", "/api/logs/request/analytics?range=24h", { jar });
    expect(analytics.status).toBe(200);
  }, 15000);

  test("a caller without the matching log permission is rejected (403)", async () => {
    const marker = loginSafeMarker("logs-plain");
    const plain = await prisma.users.create({
      data: { username: marker, email: `${marker.replace(/:/g, ".")}@example.invalid`, password: await PasswordUtil.hash("Plain-Pass1!"), is_active: true, is_approved: true },
    });
    const plainJar: Record<string, string> = {};

    try {
      await apiRequest("POST", "/api/auth/login", { body: { username: marker, password: "Plain-Pass1!" }, jar: plainJar });
      const res = await apiRequest("GET", "/api/logs/activity", { jar: plainJar });
      expect(res.status).toBe(403);
    } finally {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await prisma.notifications.deleteMany({ where: { user_id: plain.id } });
      await prisma.session.deleteMany({ where: { user_id: plain.id } });
      await prisma.auth_history.deleteMany({ where: { user_id: plain.id } });
      await prisma.users.delete({ where: { id: plain.id } });
    }
  }, 15000);
});
