import { afterAll, beforeAll, describe, expect, test } from "bun:test";

process.env.ENCRYPTION_SECRET ||= "unit-test-encryption-secret";
const { encryptText, decryptText, testEncryption } = await import(
  "../../../../backend/src/utils/encryption"
);

const originalConsoleError = console.error;
const originalConsoleLog = console.log;

beforeAll(() => {
  console.error = () => {};
  console.log = () => {};
});

afterAll(() => {
  console.error = originalConsoleError;
  console.log = originalConsoleLog;
});

describe("backend encryptText / decryptText", () => {
  test("round-trips plain and unicode text", () => {
    const encrypted = encryptText("hello world");
    expect(encrypted).not.toBe("hello world");
    expect(decryptText(encrypted)).toBe("hello world");

    const thai = "ทดสอบภาษาไทย ABC 123";
    expect(decryptText(encryptText(thai))).toBe(thai);
  });

  test("produces different ciphertext for different inputs", () => {
    expect(encryptText("a")).not.toBe(encryptText("b"));
  });

  test("throws for empty or non-string input", () => {
    expect(() => encryptText("")).toThrow();
    // @ts-expect-error intentional invalid input
    expect(() => encryptText(null)).toThrow();
  });

  test("throws when decrypting invalid ciphertext", () => {
    expect(() => decryptText("")).toThrow();
    expect(() => decryptText("not-valid-ciphertext")).toThrow();
  });

  test("testEncryption returns true for a successful round-trip", () => {
    expect(testEncryption("sample")).toBe(true);
  });
});
