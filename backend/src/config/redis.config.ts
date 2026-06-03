import Redis from "ioredis";
import prisma from "@/config/prisma.config";
import { decryptText } from "@/utils/encryption";

export const REDIS_KEY_PREFIX = "it-utils:";

async function getRedisConfig() {
  const configs = await prisma.system_config.findMany({
    where: {
      id: { in: ["redis_enabled", "redis_host", "redis_port", "redis_password", "redis_db"] },
      is_active: true,
    },
  });

  const raw = new Map(configs.map((c) => [c.id, c]));

  const enabledRow = raw.get("redis_enabled");
  const enabled = enabledRow ? enabledRow.value.toLowerCase() === "true" : false;

  if (!enabled) return { enabled: false as const };

  const hostRow = raw.get("redis_host");
  const portRow = raw.get("redis_port");
  const passwordRow = raw.get("redis_password");
  const dbRow = raw.get("redis_db");

  const host = hostRow?.value ?? "127.0.0.1";
  const port = portRow ? parseInt(portRow.value, 10) : 6379;
  const db = dbRow ? parseInt(dbRow.value, 10) : 0;

  let password: string | undefined;
  if (passwordRow?.value) {
    password = passwordRow.is_encrypted
      ? decryptText(passwordRow.value)
      : passwordRow.value;
  }

  return { enabled: true as const, host, port, password, db };
}

async function createRedisClient(): Promise<Redis | null> {
  const config = await getRedisConfig();

  if (!config.enabled) {
    console.log("[Redis] Disabled via system_config");
    return null;
  }

  const client = new Redis({
    host: config.host,
    port: config.port,
    password: config.password,
    db: config.db,
    keyPrefix: REDIS_KEY_PREFIX,
    lazyConnect: true,
    enableReadyCheck: true,
    maxRetriesPerRequest: 3,
  });

  client.on("error", (err) => {
    console.error("[Redis] Error:", err.message);
  });

  try {
    await client.connect();
    console.log(
      `[Redis] Connected — ${config.host}:${config.port} db=${config.db} prefix="${REDIS_KEY_PREFIX}"`,
    );
    return client;
  } catch (err) {
    console.error("[Redis] Failed to connect:", err);
    return null;
  }
}

// Initialize once at module load — same pattern as prisma.config.ts
const redis: Redis | null = await createRedisClient();
export default redis;

export function stripRedisKeyPrefix(key: string) {
  return key.startsWith(REDIS_KEY_PREFIX)
    ? key.slice(REDIS_KEY_PREFIX.length)
    : key;
}

export async function deleteCacheKeys(keys: string[]): Promise<number> {
  if (!redis || keys.length === 0) return 0;

  const normalizedKeys = Array.from(
    new Set(keys.map(stripRedisKeyPrefix).filter(Boolean)),
  );

  if (normalizedKeys.length === 0) return 0;

  return redis.del(...normalizedKeys);
}

export async function pingRedis(): Promise<{ connected: boolean; latencyMs?: number; error?: string }> {
  if (!redis) return { connected: false, error: "Redis disabled or unavailable" };

  try {
    const start = Date.now();
    const result = await redis.ping();
    const latencyMs = Date.now() - start;
    return result === "PONG"
      ? { connected: true, latencyMs }
      : { connected: false, error: `Unexpected PING response: ${result}` };
  } catch (err) {
    return { connected: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function clearAllCache(): Promise<number> {
  if (!redis) return 0;
  const keys = await redis.keys("*");
  if (keys.length === 0) return 0;
  return deleteCacheKeys(keys);
}

export async function disconnectRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    console.log("[Redis] Disconnected");
  }
}
