import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import prisma, { loginSafeMarker } from "../../helpers/db";
import { apiRequest } from "../../helpers/app";
import { PasswordUtil } from "../../../backend/src/utils/password";

let userId: number;
let jar: Record<string, string> = {};

beforeAll(async () => {
  const marker = loginSafeMarker("notif-user");
  const user = await prisma.users.create({
    data: { username: marker, email: `${marker.replace(/:/g, ".")}@example.invalid`, password: await PasswordUtil.hash("Notif-Pass1!"), is_active: true, is_approved: true },
  });
  userId = user.id;

  await prisma.notifications.createMany({
    data: [
      { user_id: userId, title: "First unread", message: "msg one", type: "INFO", is_read: false },
      { user_id: userId, title: "Second read", message: "msg two", type: "INFO", is_read: true },
      { user_id: userId, title: "Security alert", message: "msg three", type: "SECURITY", is_read: false },
    ],
  });

  jar = {};
  await apiRequest("POST", "/api/auth/login", { body: { username: marker, password: "Notif-Pass1!" }, jar });
}, 15000);

afterAll(async () => {
  await new Promise((resolve) => setTimeout(resolve, 1000));
  await prisma.notifications.deleteMany({ where: { user_id: userId } });
  await prisma.session.deleteMany({ where: { user_id: userId } });
  await prisma.auth_history.deleteMany({ where: { user_id: userId } });
  await prisma.users.delete({ where: { id: userId } });
}, 15000);

describe("notifications HTTP endpoints (real DB)", () => {
  test("GET / lists the caller's notifications with pagination and stats", async () => {
    const res = await apiRequest("GET", "/api/notifications", { jar });

    expect(res.status).toBe(200);
    const body = res.json as any;
    expect(body.data.items.length).toBeGreaterThanOrEqual(3);
    expect(body.data.stats.total).toBeGreaterThanOrEqual(3);
    expect(body.data.stats.unread).toBeGreaterThanOrEqual(2);
  });

  test("GET / filters by status=unread and by type", async () => {
    const unread = await apiRequest("GET", "/api/notifications?status=unread", { jar });
    expect((unread.json as any).data.items.every((i: any) => !i.isRead)).toBe(true);

    const byType = await apiRequest("GET", "/api/notifications?type=SECURITY", { jar });
    expect((byType.json as any).data.items.every((i: any) => i.type === "SECURITY")).toBe(true);
    expect((byType.json as any).data.items.some((i: any) => i.title === "Security alert")).toBe(true);
  });

  test("GET / searches by title/message", async () => {
    const res = await apiRequest("GET", "/api/notifications?search=Security alert", { jar });
    const titles = (res.json as any).data.items.map((i: any) => i.title);
    expect(titles).toContain("Security alert");
    expect(titles).not.toContain("First unread");
  });

  test("PATCH /:id/read marks a single notification as read; 404 for someone else's notification", async () => {
    const target = await prisma.notifications.findFirst({ where: { user_id: userId, title: "First unread" } });

    const res = await apiRequest("PATCH", `/api/notifications/${target!.id}/read`, { jar });
    expect(res.status).toBe(200);
    expect((await prisma.notifications.findUnique({ where: { id: target!.id } }))?.is_read).toBe(true);

    const notFound = await apiRequest("PATCH", "/api/notifications/999999999/read", { jar });
    expect(notFound.status).toBe(404);
  });

  test("PATCH /read-all marks every unread notification as read", async () => {
    const res = await apiRequest("PATCH", "/api/notifications/read-all", { jar });
    expect(res.status).toBe(200);

    const remainingUnread = await prisma.notifications.count({ where: { user_id: userId, is_read: false } });
    expect(remainingUnread).toBe(0);
  });

  test("GET / without auth is rejected", async () => {
    const res = await apiRequest("GET", "/api/notifications");
    expect(res.status).toBe(401);
  });
});
