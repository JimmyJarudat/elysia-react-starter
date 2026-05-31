// services/cron.service.ts
import { cron } from "@elysiajs/cron";
import { cleanupExpiredSessions } from "@/cron/services/cleanup_session_expired";


export const CronService = [

  // Archive expired sessions to session_history.
  cron({
    name: "cleanup-expired-sessions",
    pattern: "*/5 * * * *",
    async run() {
      console.log("[CRON] Cleanup expired sessions started:", new Date().toLocaleString());
      const result = await cleanupExpiredSessions();
      console.log(
        `[CRON] Cleanup expired sessions finished: archived=${result.archived}, deleted=${result.deleted}`,
      );
    }
  }),

  // เพิ่ม cron job อื่นๆ ได้ที่นี่
  // cron({
  //   name: "cleanup-old-files",
  //   pattern: "0 3 * * *",
  //   async run() {
  //     console.log("🧹 Cleanup cron started:", new Date().toLocaleString());
  //     // await cleanupOldFiles();
  //   }
  // }),
];
