import prisma from "@/config/prisma.config";
import { getRedisClient } from "@/config/redis.config";

export const CORS_CONFIG_KEY = "cors_allowed_origins";
export const CORS_CACHE_KEY = "security:cors_origins";
const CORS_CACHE_TTL = 60; // seconds

// Origins จาก .env — เป็น base เสมอ ใช้สำหรับโดเมนจริงที่ต้องทำงานได้ตั้งแต่วันแรก
const getEnvOrigins = (): string[] =>
  (process.env["CORS_ALLOWED_ORIGINS"] ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

export async function getAllowedOrigins(): Promise<Set<string>> {
  const redis = getRedisClient();

  if (redis) {
    try {
      const cached = await redis.get(CORS_CACHE_KEY);
      if (cached) {
        return new Set(JSON.parse(cached) as string[]);
      }
    } catch { /* fall through */ }
  }

  const config = await prisma.system_config.findUnique({
    where: { id: CORS_CONFIG_KEY },
    select: { value: true },
  });

  const dbOrigins = config?.value
    ? config.value.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  // Merge: ENV เป็น base + DB เพิ่มเติม (union ไม่ซ้ำ)
  const origins = [...new Set([...getEnvOrigins(), ...dbOrigins])];

  if (redis) {
    try {
      await redis.set(CORS_CACHE_KEY, JSON.stringify(origins), "EX", CORS_CACHE_TTL);
    } catch { /* non-critical */ }
  }

  return new Set(origins);
}

export async function clearCorsCache(): Promise<void> {
  const redis = getRedisClient();
  if (redis) {
    try { await redis.del(CORS_CACHE_KEY); } catch { /* non-critical */ }
  }
}
