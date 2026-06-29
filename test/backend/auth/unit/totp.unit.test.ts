import { createHmac } from "node:crypto";
import { describe, expect, test } from "bun:test";
import { verifyTotpCode } from "../../../../backend/src/utils/totp";

// otpauth lives only in backend/node_modules, so this test computes
// TOTP codes itself (RFC 6238) instead of importing that package directly.
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const TEST_SECRET = "JBSWY3DPEHPK3PXP";

function base32Decode(base32: string): Buffer {
  const cleaned = base32.toUpperCase().replace(/=+$/, "");
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;

  for (const char of cleaned) {
    const index = BASE32_ALPHABET.indexOf(char);
    value = (value << 5) | index;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

function generateTotp(secret: string, period = 30, digits = 6, offsetSeconds = 0): string {
  const counter = Math.floor((Date.now() / 1000 + offsetSeconds) / period);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeUInt32BE(Math.floor(counter / 2 ** 32), 0);
  counterBuffer.writeUInt32BE(counter % 2 ** 32, 4);

  const hmac = createHmac("sha1", base32Decode(secret)).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return String(binary % 10 ** digits).padStart(digits, "0");
}

describe("backend verifyTotpCode", () => {
  test("accepts the currently valid code for the secret", () => {
    expect(verifyTotpCode(TEST_SECRET, generateTotp(TEST_SECRET))).toBe(true);
  });

  test("accepts a code from the previous time step (window: 1)", () => {
    expect(verifyTotpCode(TEST_SECRET, generateTotp(TEST_SECRET, 30, 6, -30))).toBe(true);
  });

  test("ignores whitespace inside the submitted code", () => {
    const code = generateTotp(TEST_SECRET);
    const spaced = `${code.slice(0, 3)} ${code.slice(3)}`;

    expect(verifyTotpCode(TEST_SECRET, spaced)).toBe(true);
  });

  test("rejects an incorrect code", () => {
    const code = generateTotp(TEST_SECRET);
    const wrong = code === "000000" ? "111111" : "000000";

    expect(verifyTotpCode(TEST_SECRET, wrong)).toBe(false);
  });

  test("returns false instead of throwing for an invalid secret", () => {
    expect(verifyTotpCode("not-valid-base32!!", "123456")).toBe(false);
  });
});
