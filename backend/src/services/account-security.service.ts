import prisma from "@/config/prisma.config";
import { invalidateAuthUserCache } from "@/utils/cache-invalidation";
import { getSettingValue } from "@/utils/get-setting-value";
import { PasswordUtil } from "@/utils/password";

export class AccountSecurityService {
  static async getPasswordPolicy() {
    const [
      minLength,
      requireLowercase,
      requireUppercase,
      requireNumber,
      requireSpecial,
      historyCount,
    ] = await Promise.all([
      getSettingValue("password_min_length", 8),
      getSettingValue("password_require_lowercase", true),
      getSettingValue("password_require_uppercase", true),
      getSettingValue("password_require_number", true),
      getSettingValue("password_require_special", true),
      getSettingValue("password_history_count", 0),
    ]);

    return {
      success: true,
      data: {
        minLength: Math.max(1, Number(minLength) || 8),
        requireLowercase: Boolean(requireLowercase),
        requireUppercase: Boolean(requireUppercase),
        requireNumber: Boolean(requireNumber),
        requireSpecial: Boolean(requireSpecial),
        historyCount: Math.max(0, Number(historyCount) || 0),
      },
    };
  }

  static async changePassword(userId: number, input: {
    currentPassword: string;
    newPassword: string;
    ipAddress?: string | null;
    userAgent?: string | null;
  }) {
    const user = await prisma.users.findUnique({
      where: { id: userId, is_deleted: false },
      select: { id: true, password: true },
    });
    if (!user) return { success: false, status: 404, message: "User not found" };

    if (!(await PasswordUtil.compare(input.currentPassword, user.password))) {
      return { success: false, status: 400, message: "รหัสผ่านปัจจุบันไม่ถูกต้อง" };
    }
    if (await PasswordUtil.compare(input.newPassword, user.password)) {
      return { success: false, status: 400, message: "รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านปัจจุบัน" };
    }

    const policy = (await this.getPasswordPolicy()).data;
    const failures = [
      input.newPassword.length < policy.minLength && `ต้องมีอย่างน้อย ${policy.minLength} ตัวอักษร`,
      policy.requireLowercase && !/[a-z]/.test(input.newPassword) && "ต้องมีตัวอักษรพิมพ์เล็ก",
      policy.requireUppercase && !/[A-Z]/.test(input.newPassword) && "ต้องมีตัวอักษรพิมพ์ใหญ่",
      policy.requireNumber && !/\d/.test(input.newPassword) && "ต้องมีตัวเลข",
      policy.requireSpecial && !/[^A-Za-z0-9]/.test(input.newPassword) && "ต้องมีอักขระพิเศษ",
    ].filter(Boolean);
    if (failures.length > 0) {
      return { success: false, status: 400, message: failures.join(", ") };
    }

    if (policy.historyCount > 0) {
      const history = await prisma.password_history.findMany({
        where: { user_id: userId },
        orderBy: { created_at: "desc" },
        take: policy.historyCount,
        select: { password_hash: true },
      });
      const matchesHistory = (await Promise.all(
        history.map((item) => PasswordUtil.compare(input.newPassword, item.password_hash)),
      )).some(Boolean);
      if (matchesHistory) {
        return {
          success: false,
          status: 400,
          message: `ไม่สามารถใช้รหัสผ่านซ้ำกับ ${policy.historyCount} รหัสล่าสุดได้`,
        };
      }
    }

    const passwordHash = await PasswordUtil.hash(input.newPassword);
    await prisma.$transaction([
      prisma.password_history.create({
        data: {
          user_id: userId,
          password_hash: user.password,
          changed_by_user_id: userId,
          change_reason: "SELF_CHANGE",
          ip_address: input.ipAddress?.slice(0, 50) || null,
          user_agent: input.userAgent?.slice(0, 255) || null,
        },
      }),
      prisma.users.update({
        where: { id: userId },
        data: {
          password: passwordHash,
          password_changed_at: new Date(),
          must_change_password: false,
          updated_at: new Date(),
        },
      }),
    ]);
    await invalidateAuthUserCache(userId);

    return { success: true, message: "เปลี่ยนรหัสผ่านเรียบร้อยแล้ว" };
  }
}
