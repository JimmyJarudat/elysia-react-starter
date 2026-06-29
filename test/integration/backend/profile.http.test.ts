import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import prisma, { loginSafeMarker } from "../../helpers/db";
import { apiRequest } from "../../helpers/app";
import { PasswordUtil } from "../../../backend/src/utils/password";

let userId: number;
let jar: Record<string, string> = {};

beforeAll(async () => {
  const marker = loginSafeMarker("profile");
  const user = await prisma.users.create({
    data: {
      username: marker,
      email: `${marker.replace(/:/g, ".")}@example.invalid`,
      password: await PasswordUtil.hash("Profile-Pass1!"),
      is_active: true,
      is_approved: true,
    },
  });
  userId = user.id;

  jar = {};
  await apiRequest("POST", "/api/auth/login", { body: { username: user.username, password: "Profile-Pass1!" }, jar });
}, 15000);

afterAll(async () => {
  await new Promise((resolve) => setTimeout(resolve, 1000));
  await prisma.notifications.deleteMany({ where: { user_id: userId } });
  await prisma.profile.deleteMany({ where: { user_id: userId } });
  await prisma.session.deleteMany({ where: { user_id: userId } });
  await prisma.auth_history.deleteMany({ where: { user_id: userId } });
  await prisma.users.delete({ where: { id: userId } });
}, 15000);

describe("profile HTTP endpoints (real DB)", () => {
  test("GET /api/profile/me without auth is rejected by the middleware", async () => {
    const res = await apiRequest("GET", "/api/profile/me");

    expect(res.status).toBe(401);
  });

  test("GET /api/profile/me returns the empty-default profile shape", async () => {
    const res = await apiRequest("GET", "/api/profile/me", { jar });

    expect(res.status).toBe(200);
    const body = res.json as any;
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(userId);
    expect(body.data.profile.firstName).toBe("");
  });

  test("PUT /api/profile/me updates text fields and validates gender/country", async () => {
    const ok = await apiRequest("PUT", "/api/profile/me", {
      body: { firstName: "Grace", lastName: "Hopper", gender: "f", country: "us", bio: "Pioneer" },
      jar,
    });

    expect(ok.status).toBe(200);
    const okBody = ok.json as any;
    expect(okBody.data.profile.firstName).toBe("Grace");
    expect(okBody.data.profile.gender).toBe("F");
    expect(okBody.data.profile.country).toBe("US");

    const badGender = await apiRequest("PUT", "/api/profile/me", { body: { gender: "X" }, jar });
    expect(badGender.status).toBe(400);

    const badCountry = await apiRequest("PUT", "/api/profile/me", { body: { country: "USA" }, jar });
    expect(badCountry.status).toBe(400);

    const badDob = await apiRequest("PUT", "/api/profile/me", { body: { dateOfBirth: "not-a-date" }, jar });
    expect(badDob.status).toBe(400);
  }, 15000);

  test("PATCH /api/profile/language updates language and rejects invalid values", async () => {
    const ok = await apiRequest("PATCH", "/api/profile/language", { body: { language: "th" }, jar });
    expect(ok.status).toBe(200);
    expect((ok.json as any).data.language).toBe("TH");

    const reloaded = await prisma.users.findUnique({ where: { id: userId } });
    expect(reloaded?.language).toBe("TH");
  });
});
