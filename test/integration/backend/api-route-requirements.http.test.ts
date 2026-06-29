import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import prisma, { loginSafeMarker, uniqueMarker } from "../../helpers/db";
import { apiRequest } from "../../helpers/app";
import { PasswordUtil } from "../../../backend/src/utils/password";

function id(label: string) {
  return `zzt_${label}_${Math.random().toString(36).slice(2, 8)}`;
}

const ROLE_ID = id("arr-admin");
const PERMISSIONS = ["api-route-requirements.read", "api-route-requirements.update", "api-route-requirements.delete"];
let callerId: number;
let jar: Record<string, string> = {};

beforeAll(async () => {
  const marker = loginSafeMarker("arr-call");
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
  await prisma.roles.create({ data: { id: ROLE_ID, name: uniqueMarker("role-arr-admin") } });
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

describe("api-route-requirements HTTP endpoints (real DB, only touches disposable fixture routes)", () => {
  test("GET / includes the seeded real routes plus a disposable fixture row", async () => {
    const fixture = await prisma.api_route_requirements.create({
      data: { method: "GET", path: `/api/zzt-fixture-${Date.now()}`, is_active: true },
    });

    try {
      const res = await apiRequest("GET", "/api/api-route-requirements", { jar });

      expect(res.status).toBe(200);
      const body = res.json as any;
      expect(body.data.routes.some((r: any) => r.id === fixture.id)).toBe(true);
      expect(body.data.routes.length).toBeGreaterThan(1);
      expect(Array.isArray(body.data.permissions)).toBe(true);
      expect(Array.isArray(body.data.roles)).toBe(true);
    } finally {
      await prisma.api_route_requirements.delete({ where: { id: fixture.id } });
    }
  }, 15000);

  test("PUT /:id updates role/permission/active on a disposable fixture row only", async () => {
    const fixture = await prisma.api_route_requirements.create({
      data: { method: "POST", path: `/api/zzt-fixture-${Date.now()}`, is_active: false },
    });
    const permId = id("arr-target-perm");
    await prisma.permissions.create({ data: { id: permId, name: uniqueMarker("arr-target-perm"), resource: "zzt", action: "read" } });

    try {
      const res = await apiRequest("PUT", `/api/api-route-requirements/${fixture.id}`, {
        body: { permission_id: permId, is_active: true },
        jar,
      });

      expect(res.status).toBe(200);
      const reloaded = await prisma.api_route_requirements.findUnique({ where: { id: fixture.id } });
      expect(reloaded?.permission_id).toBe(permId);
      expect(reloaded?.is_active).toBe(true);
    } finally {
      await prisma.api_route_requirements.delete({ where: { id: fixture.id } }).catch(() => {});
      await prisma.permissions.delete({ where: { id: permId } }).catch(() => {});
    }
  }, 15000);

  test("DELETE /:id removes a disposable fixture row; deleting a missing id errors", async () => {
    const fixture = await prisma.api_route_requirements.create({
      data: { method: "DELETE", path: `/api/zzt-fixture-${Date.now()}`, is_active: true },
    });

    const res = await apiRequest("DELETE", `/api/api-route-requirements/${fixture.id}`, { jar });
    expect(res.status).toBe(200);
    expect(await prisma.api_route_requirements.findUnique({ where: { id: fixture.id } })).toBe(null);

    const missing = await apiRequest("DELETE", `/api/api-route-requirements/${fixture.id}`, { jar });
    expect(missing.status).toBe(500);
  }, 15000);

  test("a caller without api-route-requirements.read is rejected from GET /", async () => {
    const marker = loginSafeMarker("arr-plain");
    const plain = await prisma.users.create({
      data: { username: marker, email: `${marker.replace(/:/g, ".")}@example.invalid`, password: await PasswordUtil.hash("Plain-Pass1!"), is_active: true, is_approved: true },
    });
    const plainJar: Record<string, string> = {};

    try {
      await apiRequest("POST", "/api/auth/login", { body: { username: marker, password: "Plain-Pass1!" }, jar: plainJar });
      const res = await apiRequest("GET", "/api/api-route-requirements", { jar: plainJar });
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
