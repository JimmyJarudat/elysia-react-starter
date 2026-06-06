import prisma from "@/config/prisma.config";
import { getSettingValue } from "@/utils/get-setting-value";
import { PasswordUtil } from "@/utils/password";

export type PasswordPolicy = {
  minLength: number;
  requireLowercase: boolean;
  requireUppercase: boolean;
  requireNumber: boolean;
  requireSpecial: boolean;
  historyCount: number;
};

export async function getPasswordPolicy(): Promise<PasswordPolicy> {
  const [minLength, requireLowercase, requireUppercase, requireNumber, requireSpecial, historyCount] =
    await Promise.all([
      getSettingValue("password_min_length", 8),
      getSettingValue("password_require_lowercase", true),
      getSettingValue("password_require_uppercase", true),
      getSettingValue("password_require_number", true),
      getSettingValue("password_require_special", true),
      getSettingValue("password_history_count", 0),
    ]);

  return {
    minLength: Math.max(1, Number(minLength) || 8),
    requireLowercase: Boolean(requireLowercase),
    requireUppercase: Boolean(requireUppercase),
    requireNumber: Boolean(requireNumber),
    requireSpecial: Boolean(requireSpecial),
    historyCount: Math.max(0, Number(historyCount) || 0),
  };
}

export function validatePasswordPolicy(password: string, policy: PasswordPolicy) {
  return [
    password.length < policy.minLength && `ต้องมีอย่างน้อย ${policy.minLength} ตัวอักษร`,
    policy.requireLowercase && !/[a-z]/.test(password) && "ต้องมีตัวอักษรพิมพ์เล็ก",
    policy.requireUppercase && !/[A-Z]/.test(password) && "ต้องมีตัวอักษรพิมพ์ใหญ่",
    policy.requireNumber && !/\d/.test(password) && "ต้องมีตัวเลข",
    policy.requireSpecial && !/[^A-Za-z0-9]/.test(password) && "ต้องมีอักขระพิเศษ",
  ].filter((failure): failure is string => Boolean(failure));
}

export async function isPasswordInHistory(userId: number, password: string, historyCount: number) {
  if (historyCount <= 0) return false;

  const history = await prisma.password_history.findMany({
    where: { user_id: userId },
    orderBy: { created_at: "desc" },
    take: historyCount,
    select: { password_hash: true },
  });

  return (await Promise.all(
    history.map((item) => PasswordUtil.compare(password, item.password_hash)),
  )).some(Boolean);
}
