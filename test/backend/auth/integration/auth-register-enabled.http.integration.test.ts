import { afterAll, describe, expect, test } from "bun:test";
import prisma, { loginSafeMarker } from "../../../helpers/db";
import { apiRequest } from "../../../helpers/app";
import { restorePendingSettingOverrides, withSettingOverride } from "../../../helpers/settings";

afterAll(restorePendingSettingOverrides);

async function cleanupRegisteredUser(username: string) {
  const user = await prisma.users.findUnique({ where: { username } });
  if (!user) return;
  await prisma.notification_settings.deleteMany({ where: { user_id: user.id } });
  await prisma.user_roles.deleteMany({ where: { user_id: user.id } });
  await prisma.profile.deleteMany({ where: { user_id: user.id } });
  await prisma.auth_history.deleteMany({ where: { user_id: user.id } });
  await prisma.notifications.deleteMany({ where: { user_id: user.id } });
  await prisma.users.delete({ where: { id: user.id } });
}

// All tests that read or mutate `self_registration_enabled` live in this one file — bun test
// runs separate test files concurrently, so anything touching this shared system_config row
// must be serialized by living together (tests within one file run sequentially).
describe("POST /api/auth/register with self_registration_enabled=false", () => {
  test("returns the disabled-registration response", async () => {
    await withSettingOverride("self_registration_enabled", "false", async () => {
      const res = await apiRequest("POST", "/api/auth/register", {
        body: {
          username: loginSafeMarker("reg"),
          email: "nobody@example.invalid",
          password: "Sup3r$ecret1",
        },
      });

      expect(res.status).toBe(403);
      expect(res.json).toEqual({ success: false, status: 403, message: "Registration is currently disabled" });
    });
  });
});

describe("POST /api/auth/register with self_registration_enabled=true (real DB, settings restored after)", () => {
  test("creates a pending-approval account when approval is required", async () => {
    const username = loginSafeMarker("reg-pending");

    await withSettingOverride("self_registration_enabled", "true", async () => {
      await withSettingOverride("registration_requires_approval", "true", async () => {
        try {
          const res = await apiRequest("POST", "/api/auth/register", {
            body: {
              username,
              email: `${username.replace(/:/g, ".")}@example.invalid`,
              password: "New-Account-Pass1!",
            },
          });

          expect(res.status).toBe(201);
          const body = res.json as any;
          expect(body.success).toBe(true);
          expect(body.data.requiresApproval).toBe(true);
          expect(body.message).toContain("admin approval");

          const created = await prisma.users.findUnique({ where: { username } });
          expect(created?.is_approved).toBe(false);
          expect(created?.is_active).toBe(true);

          const role = await prisma.user_roles.findFirst({ where: { user_id: created!.id } });
          expect(role?.role_id).toBe("USER");
        } finally {
          await new Promise((resolve) => setTimeout(resolve, 800));
          await cleanupRegisteredUser(username);
        }
      });
    });
  }, 15000);

  test("creates an immediately-usable account when approval is not required", async () => {
    const username = loginSafeMarker("reg-auto");

    await withSettingOverride("self_registration_enabled", "true", async () => {
      await withSettingOverride("registration_requires_approval", "false", async () => {
        try {
          const res = await apiRequest("POST", "/api/auth/register", {
            body: {
              username,
              email: `${username.replace(/:/g, ".")}@example.invalid`,
              password: "New-Account-Pass1!",
              firstName: "Test",
              lastName: "User",
            },
          });

          expect(res.status).toBe(201);
          const body = res.json as any;
          expect(body.data.requiresApproval).toBe(false);
          expect(body.message).toContain("sign in now");

          const created = await prisma.users.findUnique({ where: { username } });
          expect(created?.is_approved).toBe(true);

          const profile = await prisma.profile.findUnique({ where: { user_id: created!.id } });
          expect(profile?.first_name).toBe("Test");
        } finally {
          await new Promise((resolve) => setTimeout(resolve, 800));
          await cleanupRegisteredUser(username);
        }
      });
    });
  }, 15000);

  test("rejects a duplicate username/email", async () => {
    const username = loginSafeMarker("reg-dup");

    await withSettingOverride("self_registration_enabled", "true", async () => {
      const email = `${username.replace(/:/g, ".")}@example.invalid`;

      try {
        const first = await apiRequest("POST", "/api/auth/register", {
          body: { username, email, password: "New-Account-Pass1!" },
        });
        expect(first.status).toBe(201);

        const second = await apiRequest("POST", "/api/auth/register", {
          body: { username, email, password: "New-Account-Pass1!" },
        });

        expect(second.status).toBe(409);
        expect((second.json as any).success).toBe(false);
      } finally {
        await new Promise((resolve) => setTimeout(resolve, 800));
        await cleanupRegisteredUser(username);
      }
    });
  }, 15000);
});
