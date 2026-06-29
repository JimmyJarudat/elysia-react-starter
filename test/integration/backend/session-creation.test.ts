import { afterAll, describe, expect, test } from "bun:test";
import prisma, { uniqueMarker } from "../../helpers/db";
import { restorePendingSettingOverrides, withSettingOverride } from "../../helpers/settings";
import { PasswordUtil } from "../../../backend/src/utils/password";
import { createSessionForUser } from "../../../backend/src/modules/auth/session-creation.service";

afterAll(restorePendingSettingOverrides);

async function createUser() {
  const marker = uniqueMarker("session-create");
  return prisma.users.create({
    data: {
      username: marker,
      email: `${marker.replace(/:/g, ".")}@example.invalid`,
      password: await PasswordUtil.hash("Whatever-Pass1!"),
      is_active: true,
      is_approved: true,
    },
  });
}

async function cleanup(userId: number) {
  await prisma.session.deleteMany({ where: { user_id: userId } });
  await prisma.users.delete({ where: { id: userId } });
}

describe("createSessionForUser (real DB)", () => {
  test("deactivates the oldest session once the active session limit is exceeded", async () => {
    const user = await createUser();

    try {
      // Pin max_active_sessions explicitly rather than relying on the ambient value — any other
      // test file that overrides this same shared setting concurrently would otherwise race.
      await withSettingOverride("max_active_sessions", "2", async () => {
        const first = await createSessionForUser(user.id, []);
        const second = await createSessionForUser(user.id, []);
        const third = await createSessionForUser(user.id, []);

        const [s1, s2, s3] = await Promise.all([
          prisma.session.findUnique({ where: { id: first.sessionId } }),
          prisma.session.findUnique({ where: { id: second.sessionId } }),
          prisma.session.findUnique({ where: { id: third.sessionId } }),
        ]);

        expect(s1?.is_active).toBe(false);
        expect(s1?.revocation_reason).toBeTruthy();
        expect(s2?.is_active).toBe(true);
        expect(s3?.is_active).toBe(true);
      });
    } finally {
      await cleanup(user.id);
    }
  }, 20000);

  test("force_single_session=true revokes every prior session on new login", async () => {
    const user = await createUser();

    try {
      const first = await createSessionForUser(user.id, []);

      await withSettingOverride("force_single_session", "true", async () => {
        const second = await createSessionForUser(user.id, []);

        const [s1, s2] = await Promise.all([
          prisma.session.findUnique({ where: { id: first.sessionId } }),
          prisma.session.findUnique({ where: { id: second.sessionId } }),
        ]);

        expect(s1?.is_active).toBe(false);
        expect(s1?.revocation_reason).toBe("FORCE_SINGLE_SESSION");
        expect(s2?.is_active).toBe(true);
      });
    } finally {
      await cleanup(user.id);
    }
  }, 30000);

  test("marks the location as a private network for a loopback client", async () => {
    const user = await createUser();

    try {
      const { sessionId } = await createSessionForUser(user.id, [], {
        ip_address: "127.0.0.1",
        user_agent: null,
        platform: "Unknown",
        device_type: "Unknown",
        browser: "Unknown",
        os: "Unknown",
      });

      const session = await prisma.session.findUnique({ where: { id: sessionId } });
      expect(session?.location).toBe("private network");
    } finally {
      await cleanup(user.id);
    }
  }, 15000);
});
