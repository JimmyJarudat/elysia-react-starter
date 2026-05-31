import Redis from "ioredis";
import prisma from "@/config/prisma.config";
import { decryptText } from "@/utils/encryption";

export const REDIS_KEY_PREFIX = "it-utils:";

const REDIS_CONFIG_KEYS = {
  enabled: "redis_enabled",
  host: "redis_host",
  port: "redis_port",
  password: "redis_password",
  db: "redis_db",
} as const;

async function getRedisConfig() {
  const configs = await prisma.system_config.findMany({
    where: {
      id: { in: Object.values(REDIS_CONFIG_KEYS) },
      is_active: true,
    },
  });

  const raw = new Map(configs.map((c) => [c.id, c]));

  const enabledRow = raw.get(REDIS_CONFIG_KEYS.enabled);
  const enabled = enabledRow
    ? enabledRow.value.toLowerCase() === "true"
    : false;

  if (!enabled) {
    return { enabled: false as const };
  }

  const hostRow = raw.get(REDIS_CONFIG_KEYS.host);
  const portRow = raw.get(REDIS_CONFIG_KEYS.port);
  const passwordRow = raw.get(REDIS_CONFIG_KEYS.password);
  const dbRow = raw.get(REDIS_CONFIG_KEYS.db);

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

let _client: Redis | null = null;
let _initialized = false;

export async function getRedisClient(): Promise<Redis | null> {
  if (_initialized) return _client;
  _initialized = true;

  const config = await getRedisConfig();

  if (!config.enabled) {
    console.log("[Redis] Disabled via system_config");
    return null;
  }

  _client = new Redis({
    host: config.host,
    port: config.port,
    password: config.password,
    db: config.db,
    keyPrefix: REDIS_KEY_PREFIX,
    lazyConnect: true,
    enableReadyCheck: true,
    maxRetriesPerRequest: 3,
  });

  _client.on("error", (err) => {
    console.error("[Redis] Error:", err.message);
  });

  try {
    await _client.connect();
    console.log(
      `[Redis] Connected — ${config.host}:${config.port} db=${config.db} prefix="${REDIS_KEY_PREFIX}"`,
    );
  } catch (err) {
    console.error("[Redis] Failed to connect:", err);
    _client = null;
  }

  return _client;
}

export async function disconnectRedis() {
  if (_client) {
    await _client.quit();
    _client = null;
    _initialized = false;
    console.log("[Redis] Disconnected");
  }
}

export async function clearAllCache(): Promise<number> {
  const client = await getRedisClient();
  if (!client) return 0;

  const keys = await client.keys("*");
  if (keys.length === 0) return 0;

  await client.del(...keys);
  return keys.length;
}

export async function pingRedis(): Promise<{ connected: boolean; latencyMs?: number; error?: string }> {
  try {
    const client = await getRedisClient();

    if (!client) {
      return { connected: false, error: "Redis disabled via system_config" };
    }

    const start = Date.now();
    const result = await client.ping();
    const latencyMs = Date.now() - start;

    if (result === "PONG") {
      return { connected: true, latencyMs };
    }

    return { connected: false, error: `Unexpected PING response: ${result}` };
  } catch (err) {
    return {
      connected: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
