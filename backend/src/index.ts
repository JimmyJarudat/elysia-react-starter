import { Elysia } from "elysia";
import { CronService } from "@/cron";
import { authMiddleware } from "@/middleware/auth-middleware";
import { router } from "@/routes";
import { pingRedis, clearAllCache } from "@/config/redis.config";

const isDev = process.env.NODE_ENV === "dev";
const allowedOrigins = new Set(
  (process.env.FRONTEND_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
);

const getCorsHeaders = (origin: string | null): Record<string, string> => {
  if (!origin || !allowedOrigins.has(origin)) {
    return {};
  }

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    Vary: "Origin",
  };
};

const app = new Elysia()
  .onRequest(({ request, set }) => {
    const headers = getCorsHeaders(request.headers.get("origin"));
    Object.assign(set.headers, headers);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }
  })
  .get("/", () => ({
    service: "it-utils-api",
    status: "ok",
  }))
  .use(authMiddleware)
  .use(router);

for (const cronJob of CronService) {
  app.use(cronJob);
}

if (isDev) {
  app.listen({
    port: 3000,
    tls: {
      cert: Bun.file("./certs/localhost+2.pem"),
      key: Bun.file("./certs/localhost+2-key.pem"),
    },
  });
} else {
  app.listen(3000);
}

console.log(
  `Server running at ${app.server?.url}`
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
