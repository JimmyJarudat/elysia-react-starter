import { Elysia } from "elysia";
import { isAbsolute, relative, resolve } from "node:path";
import { CronService } from "@/cron";
import { authMiddleware } from "@/middleware/auth-middleware";
import { requestLoggerPlugin } from "@/middleware/request-logger";
import { router } from "@/routes";
import { pingRedis, clearAllCache } from "@/config/redis.config";
import { getAllowedOrigins } from "@/config/cors.config";
import { SystemEventUtil } from "@/utils/system-event";

const isDev = process.env.NODE_ENV === "dev";

const getCorsHeaders = async (origin: string | null): Promise<Record<string, string>> => {
  if (!origin) return {};
  const allowed = await getAllowedOrigins();
  if (!allowed.has(origin)) return {};

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    Vary: "Origin",
  };
};

const app = new Elysia()
  .onRequest(async ({ request, set }) => {
    const headers = await getCorsHeaders(request.headers.get("origin"));
    Object.assign(set.headers, headers);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }
  })
  .get("/", () => ({
    service: "it-utils-api",
    status: "ok",
  }))
  .get("/uploads/*", async ({ request, set }) => {
    const url = new URL(request.url);
    const relativePath = decodeURIComponent(url.pathname.replace(/^\/uploads\/?/, ""));
    const uploadsRoot = resolve(process.cwd(), "uploads");
    const targetPath = resolve(uploadsRoot, relativePath);
    const resolvedRelative = relative(uploadsRoot, targetPath);

    if (resolvedRelative.startsWith("..") || isAbsolute(resolvedRelative)) {
      set.status = 403;
      return "Forbidden";
    }

    const file = Bun.file(targetPath);
    if (!(await file.exists())) {
      set.status = 404;
      return "Not found";
    }

    set.headers["Cache-Control"] = "public, max-age=31536000, immutable";
    return file;
  })
  .use(requestLoggerPlugin)
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
SystemEventUtil.success("STARTUP", "backend-startup", undefined, {
  url: String(app.server?.url ?? ""),
  environment: process.env.NODE_ENV ?? "production",
});

pingRedis().then(async (result) => {
  if (result.connected) {
    console.log(`[Redis] OK — latency ${result.latencyMs}ms`);
    SystemEventUtil.success("REDIS", "redis-startup-check", result.latencyMs, {
      connected: true,
    });
    const cleared = await clearAllCache();
    console.log(`[Redis] Cleared ${cleared} cache keys on startup`);
    SystemEventUtil.success("CACHE", "startup-cache-clear", undefined, { deleted: cleared });
  } else {
    console.warn(`[Redis] Not available — ${result.error}`);
    SystemEventUtil.failed("REDIS", "redis-startup-check", result.error ?? "Redis unavailable");
  }
});
