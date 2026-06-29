import { describe, expect, test } from "bun:test";
import "../../../helpers/db"; // loads DATABASE_URL/ENCRYPTION_SECRET before redis.config initializes
import {
  deleteEmailChallenge,
  generateEmailCode,
  getEmailChallenge,
  hashEmailCode,
  setEmailChallenge,
} from "../../../../backend/src/utils/email-challenge";

// Redis is unreachable in this environment, so these exercise the in-memory fallback Map —
// the same code path real production traffic falls back to whenever Redis is down.
describe("backend email-challenge (Redis unavailable, in-memory fallback)", () => {
  test("generateEmailCode produces a 6-digit numeric code", () => {
    const code = generateEmailCode();

    expect(code).toHaveLength(6);
    expect(/^\d{6}$/.test(code)).toBe(true);
  });

  test("hashEmailCode is deterministic for the same input", () => {
    expect(hashEmailCode("123456")).toBe(hashEmailCode("123456"));
    expect(hashEmailCode("123456")).not.toBe(hashEmailCode("654321"));
  });

  test("set -> get -> delete round-trips a challenge", async () => {
    const userId = Math.floor(Math.random() * 1_000_000) + 1;
    const challenge = {
      userId,
      type: "PRIMARY_VERIFY" as const,
      targetEmail: "user@example.com",
      codeHash: hashEmailCode("111111"),
      attempts: 0,
      expiresAt: Date.now() + 60_000,
    };

    await setEmailChallenge(challenge);
    expect(await getEmailChallenge(userId, "PRIMARY_VERIFY")).toEqual(challenge);

    await deleteEmailChallenge(userId, "PRIMARY_VERIFY");
    expect(await getEmailChallenge(userId, "PRIMARY_VERIFY")).toBe(null);
  });

  test("getEmailChallenge returns null and clears an expired challenge", async () => {
    const userId = Math.floor(Math.random() * 1_000_000) + 1;

    await setEmailChallenge({
      userId,
      type: "RECOVERY_VERIFY",
      targetEmail: "user@example.com",
      codeHash: hashEmailCode("222222"),
      attempts: 0,
      expiresAt: Date.now() - 1000,
    });

    expect(await getEmailChallenge(userId, "RECOVERY_VERIFY")).toBe(null);
  });

  test("returns null for a challenge that was never set", async () => {
    const userId = Math.floor(Math.random() * 1_000_000) + 1;

    expect(await getEmailChallenge(userId, "PRIMARY_CHANGE")).toBe(null);
  });
});
