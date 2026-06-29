import { createHmac } from "node:crypto";
import { afterAll, beforeAll, describe, expect, spyOn, test } from "bun:test";
import prisma, { loginSafeMarker } from "../../../helpers/db";
import { apiRequest } from "../../../helpers/app";
import { PasswordUtil } from "../../../../backend/src/utils/password";
import { EmailVerificationEmailService } from "../../../../backend/src/templates/email/email-verification";

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

let userId: number;
let username: string;
let jar: Record<string, string> = {};

beforeAll(async () => {
  const marker = loginSafeMarker("acsec");
  username = marker;
  const user = await prisma.users.create({
    data: {
      username: marker,
      email: `${marker.replace(/:/g, ".")}@example.invalid`,
      password: await PasswordUtil.hash("Original-Pass1!"),
      is_active: true,
      is_approved: true,
    },
  });
  userId = user.id;

  jar = {};
  await apiRequest("POST", "/api/auth/login", { body: { username: marker, password: "Original-Pass1!" }, jar });
}, 15000);

afterAll(async () => {
  await new Promise((resolve) => setTimeout(resolve, 1200));
  await prisma.notifications.deleteMany({ where: { user_id: userId } });
  await prisma.notification_settings.deleteMany({ where: { user_id: userId } });
  await prisma.two_factor_auth.deleteMany({ where: { user_id: userId } });
  await prisma.password_history.deleteMany({ where: { user_id: userId } });
  await prisma.session.deleteMany({ where: { user_id: userId } });
  await prisma.auth_history.deleteMany({ where: { user_id: userId } });
  await prisma.users.delete({ where: { id: userId } });
}, 15000);

describe("account-security HTTP endpoints (real DB)", () => {
  test("GET/PUT /api/account-security/notifications round-trips preferences", async () => {
    const get = await apiRequest("GET", "/api/account-security/notifications", { jar });
    expect(get.status).toBe(200);
    expect(typeof (get.json as any).data.loginNotifications).toBe("boolean");

    const put = await apiRequest("PUT", "/api/account-security/notifications", {
      body: {
        loginNotifications: false,
        securityNotifications: true,
        systemNotifications: false,
        emailNotifications: false,
        soundNotifications: true,
      },
      jar,
    });
    expect(put.status).toBe(200);
    expect((put.json as any).data.loginNotifications).toBe(false);
    expect((put.json as any).data.soundNotifications).toBe(true);
  }, 15000);

  test("GET /api/account-security/emails reflects the primary email's unverified state", async () => {
    const res = await apiRequest("GET", "/api/account-security/emails", { jar });

    expect(res.status).toBe(200);
    const body = res.json as any;
    expect(body.data.primaryVerified).toBe(false);
    expect(body.data.recoveryEmail).toBe("");
  });

  test("send-code -> verify-code marks the primary email verified", async () => {
    // Spy on the real email sender so the verification code (otherwise only hashed and stored)
    // is captured here, and so this doesn't fire a real SMTP send to an @example.invalid address.
    let capturedCode = "";
    const sendSpy = spyOn(EmailVerificationEmailService, "send").mockImplementation(async (data) => {
      capturedCode = data.code;
      return { success: true };
    });

    try {
      const send = await apiRequest("POST", "/api/account-security/emails/send-code", {
        body: { type: "PRIMARY_VERIFY" },
        jar,
      });
      expect(send.status).toBe(200);
      expect((send.json as any).success).toBe(true);
      expect(capturedCode).toMatch(/^\d{6}$/);

      const wrong = await apiRequest("POST", "/api/account-security/emails/verify-code", {
        body: { type: "PRIMARY_VERIFY", code: "000000" },
        jar,
      });
      expect(wrong.status).toBe(400);

      const ok = await apiRequest("POST", "/api/account-security/emails/verify-code", {
        body: { type: "PRIMARY_VERIFY", code: capturedCode },
        jar,
      });
      expect(ok.status).toBe(200);
      expect((ok.json as any).data.primaryVerified).toBe(true);
    } finally {
      sendSpy.mockRestore();
    }
  }, 15000);

  test("PUT /api/account-security/password rejects an incorrect current password", async () => {
    const res = await apiRequest("PUT", "/api/account-security/password", {
      body: { currentPassword: "Totally-Wrong!", newPassword: "Brand-N3w-Pass!" },
      jar,
    });

    expect(res.status).toBe(400);
    expect((res.json as any).success).toBe(false);
  });

  test("PUT /api/account-security/password changes the password and records history", async () => {
    const res = await apiRequest("PUT", "/api/account-security/password", {
      body: { currentPassword: "Original-Pass1!", newPassword: "Brand-N3w-Pass!" },
      jar,
    });

    expect(res.status).toBe(200);
    expect((res.json as any).success).toBe(true);

    const reloaded = await prisma.users.findUnique({ where: { id: userId } });
    expect(await PasswordUtil.compare("Brand-N3w-Pass!", reloaded!.password)).toBe(true);

    const history = await apiRequest("GET", "/api/account-security/password-history", { jar });
    expect(history.status).toBe(200);
    expect((history.json as any).data.items.length).toBeGreaterThan(0);
  }, 15000);

  test("2FA: setup -> enable -> status -> disable", async () => {
    const setup = await apiRequest("POST", "/api/account-security/tfa/setup", { jar });
    expect(setup.status).toBe(200);
    const manualKey = (setup.json as any).data.manualKey as string;
    expect(manualKey).toBeTruthy();

    const badEnable = await apiRequest("POST", "/api/account-security/tfa/enable", { body: { code: "000000" }, jar });
    expect(badEnable.status).toBe(400);

    const enable = await apiRequest("POST", "/api/account-security/tfa/enable", {
      body: { code: generateTotp(manualKey) },
      jar,
    });
    expect(enable.status).toBe(200);
    expect((enable.json as any).data.backupCodes.length).toBe(8);

    const status = await apiRequest("GET", "/api/account-security/tfa", { jar });
    expect((status.json as any).data.isEnabled).toBe(true);
    expect((status.json as any).data.backupCodesRemaining).toBe(8);

    const disable = await apiRequest("POST", "/api/account-security/tfa/disable", {
      body: { code: generateTotp(manualKey) },
      jar,
    });
    expect(disable.status).toBe(200);

    const statusAfter = await apiRequest("GET", "/api/account-security/tfa", { jar });
    expect((statusAfter.json as any).data.isEnabled).toBe(false);
  }, 20000);
});
