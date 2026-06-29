import { createHmac } from "node:crypto";
import { describe, expect, test } from "bun:test";
import prisma, { uniqueMarker } from "../../helpers/db";
import { apiRequest } from "../../helpers/app";
import { PasswordUtil } from "../../../backend/src/utils/password";
import { generateTfaSessionToken } from "../../../backend/src/modules/auth/session-creation.service";

// Same self-contained TOTP generator as totp.test.ts — otpauth lives only in
// backend/node_modules, so this test computes codes itself (RFC 6238).
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Decode(base32: string): Buffer {
  const cleaned = base32.toUpperCase().replace(/=+$/, "");
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;
  for (const char of cleaned) {
    value = (value << 5) | BASE32_ALPHABET.indexOf(char);
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function generateTotp(secret: string, period = 30, digits = 6): string {
  const counter = Math.floor(Date.now() / 1000 / period);
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

const TFA_SECRET = "JBSWY3DPEHPK3PXP";

async function createUserWithTfa() {
  const marker = uniqueMarker("auth-tfa");
  const user = await prisma.users.create({
    data: {
      username: marker,
      email: `${marker.replace(/:/g, ".")}@example.invalid`,
      password: await PasswordUtil.hash("Whatever-Pass1!"),
      is_active: true,
      is_approved: true,
    },
  });
  const tfaToken = await generateTfaSessionToken(user.id);
  await prisma.two_factor_auth.create({
    data: {
      user_id: user.id,
      method: "TOTP",
      secret: TFA_SECRET,
      is_enabled: true,
      tfaSessionToken: tfaToken,
    },
  });
  return { user, tfaToken };
}

async function cleanup(userId: number) {
  await new Promise((resolve) => setTimeout(resolve, 800));
  await prisma.notifications.deleteMany({ where: { user_id: userId } });
  await prisma.session.deleteMany({ where: { user_id: userId } });
  await prisma.auth_history.deleteMany({ where: { user_id: userId } });
  await prisma.two_factor_auth.deleteMany({ where: { user_id: userId } });
  await prisma.users.delete({ where: { id: userId } });
}

describe("POST /api/auth/tfa-verify (real DB)", () => {
  test("completes login with a valid TOTP code and sets session cookies", async () => {
    const { user, tfaToken } = await createUserWithTfa();
    const jar: Record<string, string> = {};

    try {
      const res = await apiRequest("POST", "/api/auth/tfa-verify", {
        body: { tfaToken, code: generateTotp(TFA_SECRET) },
        jar,
      });

      expect(res.status).toBe(200);
      const body = res.json as any;
      expect(body.success).toBe(true);
      expect(body.user.id).toBe(user.id);
      expect(jar.accessToken).toBeTruthy();
      expect(jar.refreshToken).toBeTruthy();
    } finally {
      await cleanup(user.id);
    }
  }, 15000);

  test("rejects an incorrect TOTP code without exhausting the session", async () => {
    const { user, tfaToken } = await createUserWithTfa();

    try {
      const wrong = generateTotp(TFA_SECRET) === "000000" ? "111111" : "000000";
      const res = await apiRequest("POST", "/api/auth/tfa-verify", {
        body: { tfaToken, code: wrong },
      });

      expect(res.status).toBe(401);
      expect((res.json as any).success).toBe(false);
    } finally {
      await cleanup(user.id);
    }
  }, 15000);

  test("rejects an unknown/invalid tfaToken", async () => {
    const res = await apiRequest("POST", "/api/auth/tfa-verify", {
      body: { tfaToken: "not-a-real-token", code: "123456" },
    });

    expect(res.status).toBe(401);
    expect((res.json as any).success).toBe(false);
  });
});
