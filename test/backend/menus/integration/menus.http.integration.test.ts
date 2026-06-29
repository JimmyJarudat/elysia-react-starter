import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import prisma, { loginSafeMarker, uniqueMarker } from "../../../helpers/db";
import { apiRequest } from "../../../helpers/app";
import { PasswordUtil } from "../../../../backend/src/utils/password";

function id(label: string) {
  return `zzt_${label}_${Math.random().toString(36).slice(2, 8)}`;
}

const ROLE_ID = id("menus-admin");
const PERMISSIONS = ["menus.read", "menus.create", "menus.update", "menus.delete"];
let callerId: number;
let jar: Record<string, string> = {};

beforeAll(async () => {
  const marker = loginSafeMarker("menu-call");
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
  await prisma.roles.create({ data: { id: ROLE_ID, name: uniqueMarker("role-menus-admin") } });
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

describe("menus HTTP endpoints (real DB)", () => {
  test("menu lifecycle: create -> update -> delete, with parent/permission validation", async () => {
    const path = `/zzt-menu-${Date.now()}`;

    const missingParent = await apiRequest("POST", "/api/menus", {
      body: { label: "Bad", path, icon_name: "star", parent_id: 999999999 },
      jar,
    });
    expect(missingParent.status).toBe(400);

    const missingPerm = await apiRequest("POST", "/api/menus", {
      body: { label: "Bad", path, icon_name: "star", permission_id: "zzt.does.not.exist" },
      jar,
    });
    expect(missingPerm.status).toBe(400);

    const create = await apiRequest("POST", "/api/menus", { body: { label: "Parent Menu", path, icon_name: "star" }, jar });
    expect(create.status).toBe(200);
    const parentId = (create.json as any).data.id;

    try {
      const update = await apiRequest("PUT", `/api/menus/${parentId}`, {
        body: { label: "Renamed Menu", path, icon_name: "star", sort_order: 5 },
        jar,
      });
      expect(update.status).toBe(200);
      expect((update.json as any).data.label).toBe("Renamed Menu");

      const selfParent = await apiRequest("PUT", `/api/menus/${parentId}`, {
        body: { label: "x", path, icon_name: "star", parent_id: parentId },
        jar,
      });
      expect(selfParent.status).toBe(400);

      const child = await apiRequest("POST", "/api/menus", {
        body: { label: "Child Menu", path: `${path}/child`, icon_name: "star", parent_id: parentId },
        jar,
      });
      expect(child.status).toBe(200);
      const childId = (child.json as any).data.id;

      const blockedDelete = await apiRequest("DELETE", `/api/menus/${parentId}`, { jar });
      expect(blockedDelete.status).toBe(400);

      const deleteChild = await apiRequest("DELETE", `/api/menus/${childId}`, { jar });
      expect(deleteChild.status).toBe(200);

      const deleteParent = await apiRequest("DELETE", `/api/menus/${parentId}`, { jar });
      expect(deleteParent.status).toBe(200);
      expect(await prisma.menu_items.findUnique({ where: { id: parentId } })).toBe(null);

      const missing = await apiRequest("DELETE", `/api/menus/${parentId}`, { jar });
      expect(missing.status).toBe(404);
    } finally {
      await prisma.menu_items.deleteMany({ where: { path: { in: [path, `${path}/child`] } } });
    }
  }, 20000);

  test("GET /api/menus lists every menu item regardless of permission filtering", async () => {
    const res = await apiRequest("GET", "/api/menus", { jar });

    expect(res.status).toBe(200);
    expect(Array.isArray((res.json as any).data)).toBe(true);
  });

  test("GET /api/menus/me returns a permission-filtered tree and hides gated items the caller can't see", async () => {
    const gatedPermId = id("menus-me-gate");
    await prisma.permissions.create({ data: { id: gatedPermId, name: uniqueMarker("menus-me-gate"), resource: "zzt", action: "secret" } });
    // A leaf menu with no permission_id and no children is only shown via a visible
    // descendant — give this one the caller's own "menus.read" permission so it's directly visible.
    const visible = await prisma.menu_items.create({ data: { label: "Visible", path: `/zzt-visible-${Date.now()}`, icon_name: "star", permission_id: "menus.read", is_active: true } });
    const gated = await prisma.menu_items.create({ data: { label: "Gated", path: `/zzt-gated-${Date.now()}`, icon_name: "lock", permission_id: gatedPermId, is_active: true } });

    try {
      const res = await apiRequest("GET", "/api/menus/me", { jar });
      expect(res.status).toBe(200);
      const ids = (res.json as any).data.map((m: any) => m.id);
      expect(ids).toContain(visible.id);
      expect(ids).not.toContain(gated.id);
    } finally {
      await prisma.menu_items.deleteMany({ where: { id: { in: [visible.id, gated.id] } } });
      await prisma.permissions.delete({ where: { id: gatedPermId } });
    }
  }, 15000);
});
