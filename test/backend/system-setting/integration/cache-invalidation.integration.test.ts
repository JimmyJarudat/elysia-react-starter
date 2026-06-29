import { describe, expect, test } from "bun:test";
import "../../../helpers/db"; // loads DATABASE_URL/ENCRYPTION_SECRET before redis.config initializes
import {
  invalidateAccessControlCache,
  invalidateAuthUserCache,
  invalidateMenuCache,
  invalidateRouteRequirementCache,
} from "../../../../backend/src/utils/cache-invalidation";

// Redis is configured as enabled in this environment's system_config but no Redis server is
// actually reachable, so redis.config resolves to `null`. These utils must stay no-ops (and
// never throw) in that state — that's exactly the resiliency guide.md requires.
describe("backend cache-invalidation (Redis unavailable, real fallback path)", () => {
  test("invalidateAuthUserCache resolves to 0 with and without a userId", async () => {
    expect(await invalidateAuthUserCache(123)).toBe(0);
    expect(await invalidateAuthUserCache()).toBe(0);
  });

  test("invalidateMenuCache resolves to 0", async () => {
    expect(await invalidateMenuCache()).toBe(0);
  });

  test("invalidateRouteRequirementCache resolves to 0", async () => {
    expect(await invalidateRouteRequirementCache()).toBe(0);
  });

  test("invalidateAccessControlCache aggregates all three and resolves to 0", async () => {
    expect(await invalidateAccessControlCache()).toBe(0);
  });
});
