import { Elysia } from "elysia";
import { CronService } from "@/cron";
import { authMiddleware } from "@/middleware/auth-middleware";
import { router } from "@/routes";
import { pingRedis, clearAllCache } from "@/config/redis.config";

const app = new Elysia()
  .get("/", () => ({
    service: "it-utils-api",
    status: "ok",
  }))
  .use(authMiddleware)
  .use(router);

for (const cronJob of CronService) {
  app.use(cronJob);
}

app.listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);

pingRedis().then(async (result) => {
  if (result.connected) {
    console.log(`[Redis] OK — latency ${result.latencyMs}ms`);
    const cleared = await clearAllCache();
    console.log(`[Redis] Cleared ${cleared} cache keys on startup`);
  } else {
    console.warn(`[Redis] Not available — ${result.error}`);
  }
});
