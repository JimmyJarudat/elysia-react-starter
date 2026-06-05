// services/cron.service.ts
import { cron } from "@elysiajs/cron";
import {
  cleanupExpiredSessions,
  shouldRunCleanupExpiredSessions,
} from "@/cron/services/cleanup_session_expired";
import {
  disableInactiveAccounts,
  shouldRunDisableInactiveAccounts,
} from "@/cron/services/disable_inactive_accounts";

export const CronService = [

  // Archive expired sessions to session_history.
  cron({
    name: "cleanup-expired-sessions",
    pattern: "* * * * *",
    async run() {
      const schedule = await shouldRunCleanupExpiredSessions();

      if (!schedule.shouldRun) {
        return;
      }

      console.log(
        "[CRON] Cleanup expired sessions started:",
        new Date().toLocaleString(),
      );
      const result = await cleanupExpiredSessions(schedule.config);
      console.log(
        `[CRON] Cleanup expired sessions finished: archived=${result.archived}, deleted=${result.deleted}`,
      );
    }
  }),

  // Disable accounts that haven't logged in for X days.
  cron({
    name: "disable-inactive-accounts",
    pattern: "* * * * *",
    async run() {
      const schedule = await shouldRunDisableInactiveAccounts();

      if (!schedule.shouldRun) {
        return;
      }

      console.log(
        "[CRON] Disable inactive accounts started:",
        new Date().toLocaleString(),
      );
      const result = await disableInactiveAccounts(schedule.config);
      console.log(
        `[CRON] Disable inactive accounts finished: disabled=${result.disabled}`,
      );
    }
  }),
];
