import redis, { deleteCacheKeys, REDIS_KEY_PREFIX } from "@/config/redis.config";

const AUTH_USER_CACHE_PATTERN = "auth:user:*";
const MENU_LIST_CACHE_KEY = "menus:list";
const MENU_USER_CACHE_PATTERN = "menus:me:*";
const ROUTE_REQUIREMENT_CACHE_PATTERN = "routes:*";

async function keysByPattern(pattern: string) {
  if (!redis) return [];
  const client = redis;

  try {
    const patterns = pattern.startsWith(REDIS_KEY_PREFIX)
      ? [pattern]
      : [pattern, `${REDIS_KEY_PREFIX}${pattern}`];
    const keys = await Promise.all(patterns.map((item) => client.keys(item)));

    return Array.from(new Set(keys.flat()));
  } catch {
    return [];
  }
}

export async function invalidateAuthUserCache(userId?: number) {
  if (!redis) return 0;

  try {
    const keys = typeof userId === "number"
      ? [`auth:user:${userId}`]
      : await keysByPattern(AUTH_USER_CACHE_PATTERN);

    return deleteCacheKeys(keys);
  } catch {
    return 0;
  }
}

export async function invalidateMenuCache() {
  if (!redis) return 0;

  try {
    const userMenuKeys = await keysByPattern(MENU_USER_CACHE_PATTERN);
    return deleteCacheKeys([MENU_LIST_CACHE_KEY, ...userMenuKeys]);
  } catch {
    return 0;
  }
}

export async function invalidateRouteRequirementCache() {
  if (!redis) return 0;

  try {
    const keys = await keysByPattern(ROUTE_REQUIREMENT_CACHE_PATTERN);
    return deleteCacheKeys(keys);
  } catch {
    return 0;
  }
}

export async function invalidateAccessControlCache() {
  const counts = await Promise.all([
    invalidateAuthUserCache(),
    invalidateMenuCache(),
    invalidateRouteRequirementCache(),
  ]);

  return counts.reduce((total, count) => total + count, 0);
}
