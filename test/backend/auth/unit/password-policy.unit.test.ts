import { describe, expect, test } from "bun:test";

// password-policy.ts imports the Prisma client module, which requires these
// env vars to be present at import time. No real DB/Redis connection happens
// for the pure functions under test here.
process.env.DATABASE_URL ||=
  "sqlserver://localhost:1433;database=unit-test;user=sa;password=x;trustServerCertificate=true";
process.env.ENCRYPTION_SECRET ||= "unit-test-encryption-secret";

const { isPasswordExpired, validatePasswordPolicy } = await import(
  "../../../../backend/src/utils/password-policy"
);

const STRICT_POLICY = {
  minLength: 8,
  requireLowercase: true,
  requireUppercase: true,
  requireNumber: true,
  requireSpecial: true,
  historyCount: 0,
};

describe("backend validatePasswordPolicy", () => {
  test("returns no failures when the password satisfies every rule", () => {
    expect(validatePasswordPolicy("Str0ng!Pass", STRICT_POLICY)).toEqual([]);
  });

  test("reports a failure per unmet rule", () => {
    const failures = validatePasswordPolicy("short", STRICT_POLICY);

    expect(failures).toEqual([
      "ต้องมีอย่างน้อย 8 ตัวอักษร",
      "ต้องมีตัวอักษรพิมพ์ใหญ่",
      "ต้องมีตัวเลข",
      "ต้องมีอักขระพิเศษ",
    ]);
  });

  test("skips rules that are disabled in the policy", () => {
    const failures = validatePasswordPolicy("alllowercase", {
      ...STRICT_POLICY,
      requireUppercase: false,
      requireNumber: false,
      requireSpecial: false,
    });

    expect(failures).toEqual([]);
  });
});

describe("backend isPasswordExpired", () => {
  test("does not treat a null changed-at date as expired", () => {
    expect(isPasswordExpired(null, 90)).toBe(false);
  });

  test("treats an invalid date as expired", () => {
    expect(isPasswordExpired(new Date("not-a-date"), 90)).toBe(true);
  });

  test("is not expired when within the expiry window", () => {
    const changedAt = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);

    expect(isPasswordExpired(changedAt, 90)).toBe(false);
  });

  test("is expired once the expiry window has passed", () => {
    const changedAt = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000);

    expect(isPasswordExpired(changedAt, 90)).toBe(true);
  });

  test("falls back to a 90-day default when expiryDays is 0 (falsy)", () => {
    const changedAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

    expect(isPasswordExpired(changedAt, 0)).toBe(false);
  });

  test("clamps a negative expiry to a minimum of 1 day", () => {
    const changedAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

    expect(isPasswordExpired(changedAt, -5)).toBe(true);
  });
});
