import * as OTPAuth from "otpauth";

export function verifyTotpCode(secret: string, code: string): boolean {
  try {
    const totp = new OTPAuth.TOTP({
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret),
    });
    return totp.validate({ token: code.replace(/\s/g, ""), window: 1 }) !== null;
  } catch {
    return false;
  }
}
