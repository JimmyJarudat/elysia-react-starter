import redis from "@/config/redis.config";

const ONLINE_TTL_SECONDS = 300;
const ONLINE_USER_KEY = (userId: number) => `online:user:${userId}`;

export async function markUserOnline(userId: number) {
  if (!redis) return;

  try {
    await redis.set(ONLINE_USER_KEY(userId), "1", "EX", ONLINE_TTL_SECONDS);
  } catch {
    /* non-critical */
  }
}

export async function markUserOffline(userId: number) {
  if (!redis) return;

  try {
    await redis.del(ONLINE_USER_KEY(userId));
  } catch {
    /* non-critical */
  }
}

export async function getOnlineUserIds(userIds: number[]) {
  if (!redis || userIds.length === 0) return new Set<number>();

  try {
    const values = await redis.mget(userIds.map(ONLINE_USER_KEY));
    return new Set(
      userIds.filter((userId, index) => values[index] !== null),
    );
  } catch {
    return new Set<number>();
  }
}
