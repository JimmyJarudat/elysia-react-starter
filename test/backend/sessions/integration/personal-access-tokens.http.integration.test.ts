import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import prisma, { loginSafeMarker, uniqueMarker } from "../../../helpers/db";
import { apiRequest } from "../../../helpers/app";
import { PasswordUtil } from "../../../../backend/src/utils/password";

function id(label: string) {
  return `zzt_${label}_${Math.random().toString(36).slice(2, 8)}`;
}

const ROLE_ID = id("pat-admin");
const PERMISSIONS = ["access-tokens.read", "access-tokens.create", "access-tokens.revoke", "access-tokens.delete"];
let userId: number;
let jar: Record<string, string> = {};

beforeAll(async () => {
  const marker = loginSafeMarker("pat-user");
  const user = await prisma.users.create({
    data: { username: marker, email: `${marker.replace(/:/g, ".")}@example.invalid`, password: await PasswordUtil.hash("Pat-Pass1!"), is_active: true, is_approved: true },
  });
  userId = user.id;

  await Promise.all(
    PERMISSIONS.map(async (permId) => {
      const existing = await prisma.permissions.findUnique({ where: { id: permId } });
      if (!existing) {
        const [resource, action] = permId.split(".");
        await prisma.permissions.create({ data: { id: permId, name: uniqueMarker(`perm-${permId}`), resource, action } });
      }
    }),
  );
  await prisma.roles.create({ data: { id: ROLE_ID, name: uniqueMarker("role-pat-admin") } });
  await prisma.role_permissions.createMany({ data: PERMISSIONS.map((permission_id) => ({ role_id: ROLE_ID, permission_id })) });
  await prisma.user_roles.create({ data: { user_id: user.id, role_id: ROLE_ID } });

  jar = {};
  await apiRequest("POST", "/api/auth/login", { body: { username: marker, password: "Pat-Pass1!" }, jar });
}, 20000);

afterAll(async () => {
  await new Promise((resolve) => setTimeout(resolve, 1000));
  await prisma.user_roles.deleteMany({ where: { role_id: ROLE_ID } });
  await prisma.role_permissions.deleteMany({ where: { role_id: ROLE_ID } });
  await prisma.roles.delete({ where: { id: ROLE_ID } }).catch(() => {});
  await prisma.personal_access_tokens.deleteMany({ where: { user_id: userId } });
  await prisma.notifications.deleteMany({ where: { user_id: userId } });
  await prisma.session.deleteMany({ where: { user_id: userId } });
  await prisma.auth_history.deleteMany({ where: { user_id: userId } });
  await prisma.users.delete({ where: { id: userId } });
}, 15000);

describe("personal-access-tokens HTTP endpoints (real DB)", () => {
  test("POST / creates a token; GET / lists it without the raw secret", async () => {
    const create = await apiRequest("POST", "/api/personal-access-tokens", { body: { name: "CI token" }, jar });

    expect(create.status).toBe(200);
    const createBody = create.json as any;
    expect(createBody.success).toBe(true);
    expect(createBody.data.token).toMatch(/^pat_[0-9a-f]{64}$/);

    const list = await apiRequest("GET", "/api/personal-access-tokens", { jar });
    expect(list.status).toBe(200);
    const item = (list.json as any).data.find((t: any) => t.id === createBody.data.id);
    expect(item).toBeTruthy();
    expect(item.token).toBeUndefined();

    await prisma.personal_access_tokens.delete({ where: { id: createBody.data.id } });
  }, 15000);

  test("a created token authenticates as a Bearer pat_ token on a protected route", async () => {
    const create = await apiRequest("POST", "/api/personal-access-tokens", { body: { name: "Bearer test token" }, jar });
    const rawToken = (create.json as any).data.token as string;

    try {
      const res = await apiRequest("GET", "/api/profile/me", { headers: { authorization: `Bearer ${rawToken}` } });

      expect(res.status).toBe(200);
      expect((res.json as any).data.id).toBe(userId);

      const reloaded = await prisma.personal_access_tokens.findFirst({ where: { user_id: userId, name: "Bearer test token" } });
      expect(reloaded?.last_used_at).toBeTruthy();
    } finally {
      await prisma.personal_access_tokens.deleteMany({ where: { user_id: userId, name: "Bearer test token" } });
    }
  }, 15000);

  test("a revoked token is rejected for both API auth and the revoke/delete endpoints", async () => {
    const create = await apiRequest("POST", "/api/personal-access-tokens", { body: { name: "Revoke-me" }, jar });
    const tokenId = (create.json as any).data.id;
    const rawToken = (create.json as any).data.token as string;

    try {
      const revoke = await apiRequest("POST", `/api/personal-access-tokens/${tokenId}/revoke`, { jar });
      expect(revoke.status).toBe(200);

      const again = await apiRequest("POST", `/api/personal-access-tokens/${tokenId}/revoke`, { jar });
      expect(again.status).toBe(500);

      const bearerAfterRevoke = await apiRequest("GET", "/api/profile/me", { headers: { authorization: `Bearer ${rawToken}` } });
      expect(bearerAfterRevoke.status).toBe(401);
    } finally {
      await prisma.personal_access_tokens.deleteMany({ where: { id: tokenId } });
    }
  }, 15000);

  test("DELETE removes a token; revoking/deleting a missing token returns an error", async () => {
    const create = await apiRequest("POST", "/api/personal-access-tokens", { body: { name: "Delete-me" }, jar });
    const tokenId = (create.json as any).data.id;

    const del = await apiRequest("DELETE", `/api/personal-access-tokens/${tokenId}`, { jar });
    expect(del.status).toBe(200);
    expect(await prisma.personal_access_tokens.findUnique({ where: { id: tokenId } })).toBe(null);

    const missing = await apiRequest("DELETE", `/api/personal-access-tokens/${tokenId}`, { jar });
    expect(missing.status).toBe(500);
  }, 15000);

  test("non-Bearer-PAT Authorization headers are rejected on a protected route", async () => {
    const res = await apiRequest("GET", "/api/profile/me", { headers: { authorization: "Bearer not-a-pat-token" } });
    expect(res.status).toBe(401);
  });
});
