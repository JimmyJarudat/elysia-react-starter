import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import prisma, { loginSafeMarker, uniqueMarker } from "../../../helpers/db";
import { apiRequest } from "../../../helpers/app";
import { PasswordUtil } from "../../../../backend/src/utils/password";

let userId: number;
let jar: Record<string, string> = {};

beforeAll(async () => {
  const marker = loginSafeMarker("mah-user");
  const user = await prisma.users.create({
    data: { username: marker, email: `${marker.replace(/:/g, ".")}@example.invalid`, password: await PasswordUtil.hash("Mah-Pass1!"), is_active: true, is_approved: true },
  });
  userId = user.id;

  jar = {};
  await apiRequest("POST", "/api/auth/login", { body: { username: marker, password: "Mah-Pass1!" }, jar });
}, 15000);

afterAll(async () => {
  await new Promise((resolve) => setTimeout(resolve, 1000));
  await prisma.notifications.deleteMany({ where: { user_id: userId } });
  await prisma.session.deleteMany({ where: { user_id: userId } });
  await prisma.auth_history.deleteMany({ where: { user_id: userId } });
  await prisma.users.delete({ where: { id: userId } });
}, 15000);

describe("my-auth-history HTTP endpoints (real DB)", () => {
  test("GET / returns the caller's own active sessions and auth history, marking the current session", async () => {
    const res = await apiRequest("GET", "/api/my-auth-history", { jar });

    expect(res.status).toBe(200);
    const body = res.json as any;
    expect(body.success).toBe(true);
    expect(body.data.sessions.length).toBeGreaterThan(0);
    expect(body.data.sessions.some((s: any) => s.isCurrent)).toBe(true);
    expect(body.data.authHistory.some((h: any) => h.auth_type === "LOGIN" && h.auth_status === "SUCCESS")).toBe(true);
  }, 15000);

  test("DELETE /sessions/:id cannot revoke the current session, but can revoke another one", async () => {
    const other = await prisma.session.create({
      data: {
        user_id: userId,
        access_token: uniqueMarker("mah-token"),
        refresh_token: uniqueMarker("mah-refresh"),
        is_active: true,
        expires_at: new Date(Date.now() + 60_000),
      },
    });

    const overview = await apiRequest("GET", "/api/my-auth-history", { jar });
    const currentSessionId = (overview.json as any).data.sessions.find((s: any) => s.isCurrent).id;

    const selfRevoke = await apiRequest("DELETE", `/api/my-auth-history/sessions/${currentSessionId}`, { jar });
    expect(selfRevoke.status).toBe(400);

    const revoke = await apiRequest("DELETE", `/api/my-auth-history/sessions/${other.id}`, { jar });
    expect(revoke.status).toBe(200);
    expect((await prisma.session.findUnique({ where: { id: other.id } }))?.is_active).toBe(false);

    const notFound = await apiRequest("DELETE", "/api/my-auth-history/sessions/999999999", { jar });
    expect(notFound.status).toBe(404);
  }, 15000);
});
