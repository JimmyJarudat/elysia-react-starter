import { describe, expect, test } from "bun:test";
import prisma, { uniqueMarker } from "../../../helpers/db";
import { SessionCleanupService } from "../../../../backend/src/utils/cleanup-expired-session";

// Only the two methods scoped to a single session/user are tested here.
// SessionCleanupService.moveExpiredSessionsToHistory()/checkAndExpireSessions()/
// cleanupOldSessionHistory()/runFullCleanup() all operate on EVERY session/session_history row
// in the real DB with no way to scope them to test data, so they are intentionally not run —
// see planning/Task-unit.md. (Also: this whole class has no callers anywhere in the codebase —
// the real cron job that does this work lives in backend/src/cron/services/cleanup_session_expired.ts.)
async function createUserWithSessions(count: number) {
  const marker = uniqueMarker("cleanup-sess");
  const user = await prisma.users.create({
    data: { username: marker, email: `${marker.replace(/:/g, ".")}@example.invalid`, password: "unused", is_active: true, is_approved: true },
  });
  const sessions = await Promise.all(
    Array.from({ length: count }, () =>
      prisma.session.create({
        data: {
          user_id: user.id,
          access_token: uniqueMarker("cleanup-token"),
          refresh_token: uniqueMarker("cleanup-refresh"),
          is_active: true,
          expires_at: new Date(Date.now() + 60_000),
        },
      }),
    ),
  );
  return { user, sessions };
}

async function cleanup(userId: number) {
  await prisma.session.deleteMany({ where: { user_id: userId } });
  await prisma.users.delete({ where: { id: userId } });
}

describe("SessionCleanupService (real DB, only the per-session/per-user scoped methods)", () => {
  test("revokeSession deactivates exactly the targeted session", async () => {
    const { user, sessions } = await createUserWithSessions(2);

    try {
      const result = await SessionCleanupService.revokeSession(sessions[0].id, "TEST_REASON");
      expect(result.success).toBe(true);

      const [s1, s2] = await Promise.all([
        prisma.session.findUnique({ where: { id: sessions[0].id } }),
        prisma.session.findUnique({ where: { id: sessions[1].id } }),
      ]);
      expect(s1?.is_active).toBe(false);
      expect(s1?.revocation_reason).toBe("TEST_REASON");
      expect(s2?.is_active).toBe(true);
    } finally {
      await cleanup(user.id);
    }
  }, 15000);

  test("revokeSession returns a failure shape for a nonexistent session", async () => {
    const result = await SessionCleanupService.revokeSession(999999999, "TEST_REASON");
    expect(result.success).toBe(false);
  });

  test("revokeAllUserSessions deactivates only that user's active sessions", async () => {
    const { user: target, sessions: targetSessions } = await createUserWithSessions(2);
    const { user: other, sessions: otherSessions } = await createUserWithSessions(1);

    try {
      const result = await SessionCleanupService.revokeAllUserSessions(target.id, "TEST_LOGOUT_ALL");
      expect(result.success).toBe(true);
      expect(result.revokedCount).toBe(2);

      const targetReloaded = await prisma.session.findMany({ where: { user_id: target.id } });
      expect(targetReloaded.every((s) => !s.is_active && s.revocation_reason === "TEST_LOGOUT_ALL")).toBe(true);

      const otherReloaded = await prisma.session.findUnique({ where: { id: otherSessions[0].id } });
      expect(otherReloaded?.is_active).toBe(true);
    } finally {
      await cleanup(target.id);
      await cleanup(other.id);
    }
  }, 15000);
});
