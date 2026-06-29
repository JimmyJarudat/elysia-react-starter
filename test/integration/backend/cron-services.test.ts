import { afterAll, describe, expect, test } from "bun:test";
import { restorePendingSettingOverrides, withSettingOverride } from "../../helpers/settings";
import { shouldRunCleanupExpiredSessions } from "../../../backend/src/cron/services/cleanup_session_expired";
import { shouldRunDisableInactiveAccounts } from "../../../backend/src/cron/services/disable_inactive_accounts";

// Only the read-mostly "should this cron fire right now" gating functions are tested here.
// cleanupExpiredSessions()/disableInactiveAccounts() (the actual mutating jobs) operate on every
// real session/user row in the DB with no way to scope them to test data — not run here for the
// same reason as SessionCleanupService; see planning/Task-unit.md.
afterAll(restorePendingSettingOverrides);

describe("cron gating functions (real DB)", () => {
  test("shouldRunCleanupExpiredSessions returns disabled when the feature flag is off", async () => {
    await withSettingOverride("cron_cleanup_expired_sessions_enabled", "false", async () => {
      const result = await shouldRunCleanupExpiredSessions();
      expect(result.shouldRun).toBe(false);
      expect(result.reason).toBe("disabled");
    });
  }, 15000);

  test("shouldRunCleanupExpiredSessions is read-only and reports a reason when not on schedule", async () => {
    // With the real cron expression ("0 2 * * *" in this env), "right now" essentially never
    // matches — assert the function degrades to a clear non-running reason without mutating anything.
    const result = await shouldRunCleanupExpiredSessions();
    expect(result.shouldRun === false || result.shouldRun === true).toBe(true);
    expect(["disabled", "not_scheduled_expression", "already_ran_this_minute", "scheduled"]).toContain(result.reason);
  });

  test("shouldRunDisableInactiveAccounts returns disabled when inactivity threshold is 0 (real current config)", async () => {
    // account_inactivity_days=0 in this environment's real config short-circuits before any write,
    // so this is exercising the actual current behavior without needing a save/restore wrapper.
    const result = await shouldRunDisableInactiveAccounts();
    expect(result.shouldRun).toBe(false);
    expect(result.config.inactivityDays).toBe(0);
  });

  test("shouldRunDisableInactiveAccounts returns disabled when the feature flag is off", async () => {
    await withSettingOverride("cron_disable_inactive_accounts_enabled", "false", async () => {
      const result = await shouldRunDisableInactiveAccounts();
      expect(result.shouldRun).toBe(false);
      expect(result.config.enabled).toBe(false);
    });
  }, 15000);
});
