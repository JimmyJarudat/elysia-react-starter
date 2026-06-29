import { describe, expect, test } from "bun:test";
import { PasswordUtil } from "../../../backend/src/utils/password";

describe("backend PasswordUtil", () => {
  test("hash produces a bcrypt hash that compare can verify", async () => {
    const hash = await PasswordUtil.hash("S3cret!23");

    expect(hash).not.toBe("S3cret!23");
    expect(hash.startsWith("$2")).toBe(true);
    expect(await PasswordUtil.compare("S3cret!23", hash)).toBe(true);
    expect(await PasswordUtil.compare("wrong-password", hash)).toBe(false);
  });

  test("hashing the same password twice yields different hashes (random salt)", async () => {
    const [a, b] = await Promise.all([PasswordUtil.hash("same-password"), PasswordUtil.hash("same-password")]);

    expect(a).not.toBe(b);
  });

  test("validate rejects passwords shorter than 8 characters", () => {
    expect(PasswordUtil.validate("short")).toEqual({
      isValid: false,
      message: "Password must be at least 8 characters",
    });
  });

  test("validate accepts passwords with 8 or more characters", () => {
    expect(PasswordUtil.validate("longenough")).toEqual({ isValid: true });
  });
});
