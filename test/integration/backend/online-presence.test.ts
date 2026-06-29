import { describe, expect, test } from "bun:test";
import "../../helpers/db"; // loads DATABASE_URL/ENCRYPTION_SECRET before redis.config initializes
import {
  getOnlineUserIds,
  markUserOffline,
  markUserOnline,
} from "../../../backend/src/utils/online-presence";

// Redis is unreachable in this environment (see cache-invalidation.test.ts) — verify the
// presence utils degrade gracefully instead of throwing when Redis is unavailable.
describe("backend online-presence (Redis unavailable, real fallback path)", () => {
  test("markUserOnline / markUserOffline do not throw", async () => {
    await expect(markUserOnline(1)).resolves.toBeUndefined();
    await expect(markUserOffline(1)).resolves.toBeUndefined();
  });

  test("getOnlineUserIds returns an empty set when Redis is unavailable", async () => {
    expect(await getOnlineUserIds([1, 2, 3])).toEqual(new Set());
  });

  test("getOnlineUserIds returns an empty set for an empty input without querying Redis", async () => {
    expect(await getOnlineUserIds([])).toEqual(new Set());
  });
});
