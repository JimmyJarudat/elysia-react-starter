import prisma from "@/config/prisma.config";
import redis from "@/config/redis.config";
import { randomInt } from "node:crypto";
import { invalidateAuthUserCache } from "@/utils/cache-invalidation";
import { PasswordUtil } from "@/utils/password";
import { getPasswordPolicy, isPasswordInHistory, validatePasswordPolicy } from "@/utils/password-policy";
import { EmailVerificationEmailService } from "@/templates/email/email-verification";
import { NotificationService } from "@/services/notification.service";

type EmailChallengeType = "PRIMARY_VERIFY" | "PRIMARY_CHANGE" | "RECOVERY_VERIFY" | "RECOVERY_CHANGE";
type EmailChallenge = {
  userId: number;
  type: EmailChallengeType;
  targetEmail: string;
  codeHash: string;
  attempts: number;
  expiresAt: number;
};

const emailChallenges = new Map<string, EmailChallenge>();
const EMAIL_CODE_TTL_SECONDS = 10 * 60;
const EMAIL_CODE_MAX_ATTEMPTS = 5;

export class AccountSecurityService {
  private static emailChallengeKey(userId: number, type: EmailChallengeType) {
    return `account-security:email-code:${userId}:${type}`;
  }

  private static hashEmailCode(code: string) {
    return new Bun.CryptoHasher("sha256").update(code).digest("hex");
  }

  private static async setEmailChallenge(challenge: EmailChallenge) {
    const key = this.emailChallengeKey(challenge.userId, challenge.type);
    emailChallenges.set(key, challenge);
    if (redis) {
      try {
        await redis.set(key, JSON.stringify(challenge), "EX", EMAIL_CODE_TTL_SECONDS);
      } catch {
        // Fall back to runtime memory when Redis becomes unavailable.
      }
    }
  }

  private static async getEmailChallenge(userId: number, type: EmailChallengeType) {
    const key = this.emailChallengeKey(userId, type);
    let raw: string | EmailChallenge | null | undefined;
    if (redis) {
      try {
        raw = await redis.get(key) ?? emailChallenges.get(key);
      } catch {
        raw = emailChallenges.get(key);
      }
    } else {
      raw = emailChallenges.get(key);
    }
    if (!raw) return null;
    const challenge = typeof raw === "string" ? JSON.parse(raw) as EmailChallenge : raw;
    if (challenge.expiresAt <= Date.now()) {
      await this.deleteEmailChallenge(userId, type);
      return null;
    }
    return challenge;
  }

  private static async deleteEmailChallenge(userId: number, type: EmailChallengeType) {
    const key = this.emailChallengeKey(userId, type);
    if (redis) {
      try {
        await redis.del(key);
      } catch {
        // Memory fallback is still cleared below.
      }
    }
    emailChallenges.delete(key);
  }

  static async getNotificationSettings(userId: number) {
    const settings = await prisma.notification_settings.upsert({
      where: { user_id: userId },
      create: { user_id: userId },
      update: {},
    });

    return {
      success: true,
      data: {
        loginNotifications: settings.login_notifications,
        securityNotifications: settings.security_notifications,
        systemNotifications: settings.system_notifications,
        emailNotifications: settings.email_notifications,
        soundNotifications: settings.sound_notifications,
      },
    };
  }

  static async updateNotificationSettings(userId: number, input: {
    loginNotifications: boolean;
    securityNotifications: boolean;
    systemNotifications: boolean;
    emailNotifications: boolean;
    soundNotifications: boolean;
  }) {
    const settings = await prisma.notification_settings.upsert({
      where: { user_id: userId },
      create: {
        user_id: userId,
        login_notifications: input.loginNotifications,
        security_notifications: input.securityNotifications,
        system_notifications: input.systemNotifications,
        email_notifications: input.emailNotifications,
        sound_notifications: input.soundNotifications,
      },
      update: {
        login_notifications: input.loginNotifications,
        security_notifications: input.securityNotifications,
        system_notifications: input.systemNotifications,
        email_notifications: input.emailNotifications,
        sound_notifications: input.soundNotifications,
        updated_at: new Date(),
      },
    });

    return {
      success: true,
      message: "บันทึกการตั้งค่าการแจ้งเตือนเรียบร้อยแล้ว",
      data: {
        loginNotifications: settings.login_notifications,
        securityNotifications: settings.security_notifications,
        systemNotifications: settings.system_notifications,
        emailNotifications: settings.email_notifications,
        soundNotifications: settings.sound_notifications,
      },
    };
  }

  static async getEmailSettings(userId: number) {
    const user = await prisma.users.findUnique({
      where: { id: userId, is_deleted: false },
      select: { email: true, is_email_verified: true, email_verified_at: true, recovery_email: true, metadata: true },
    });
    if (!user) return { success: false, status: 404, message: "User not found" };

    let metadata: Record<string, unknown> = {};
    try {
      metadata = user.metadata ? JSON.parse(user.metadata) : {};
    } catch {
      metadata = {};
    }

    return {
      success: true,
      data: {
        primaryEmail: user.email,
        primaryVerified: user.is_email_verified,
        primaryVerifiedAt: user.email_verified_at,
        recoveryEmail: user.recovery_email ?? "",
        recoveryVerified: Boolean(metadata.recoveryEmailVerified)
          && metadata.recoveryEmailVerifiedAddress === user.recovery_email,
        recoveryVerifiedAt: metadata.recoveryEmailVerifiedAddress === user.recovery_email
          ? String(metadata.recoveryEmailVerifiedAt || "") || null
          : null,
      },
    };
  }

  static async sendEmailVerificationCode(userId: number, input: { type: EmailChallengeType; email?: string }) {
    const user = await prisma.users.findUnique({
      where: { id: userId, is_deleted: false },
      select: { email: true, is_email_verified: true, recovery_email: true, metadata: true },
    });
    if (!user) return { success: false, status: 404, message: "User not found" };

    let metadata: Record<string, unknown> = {};
    try {
      metadata = user.metadata ? JSON.parse(user.metadata) : {};
    } catch {
      metadata = {};
    }
    const recoveryVerified = Boolean(metadata.recoveryEmailVerified)
      && metadata.recoveryEmailVerifiedAddress === user.recovery_email;
    const targetEmail = (
      input.type === "PRIMARY_VERIFY"
        ? user.email
        : input.type === "RECOVERY_VERIFY"
          ? user.recovery_email
          : input.email
    )?.trim().toLowerCase();
    if (!targetEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail)) {
      return { success: false, status: 400, message: "รูปแบบอีเมลไม่ถูกต้อง" };
    }
    if (input.type === "PRIMARY_CHANGE") {
      if (!user.is_email_verified) {
        return { success: false, status: 403, message: "กรุณายืนยันอีเมลหลักเดิมก่อนเปลี่ยนอีเมล" };
      }
      const exists = await prisma.users.findFirst({
        where: { email: targetEmail, id: { not: userId }, is_deleted: false },
        select: { id: true },
      });
      if (exists) return { success: false, status: 409, message: "อีเมลนี้ถูกใช้งานแล้ว" };
      if (targetEmail === user.email) return { success: false, status: 400, message: "กรุณาระบุอีเมลใหม่" };
    }
    if (input.type === "RECOVERY_VERIFY" && !user.recovery_email) {
      return { success: false, status: 400, message: "ยังไม่มีอีเมลสำรองให้ยืนยัน" };
    }
    if (input.type === "RECOVERY_CHANGE" && user.recovery_email && !recoveryVerified) {
      return { success: false, status: 403, message: "กรุณายืนยันอีเมลสำรองเดิมก่อนเปลี่ยนอีเมล" };
    }
    if (input.type === "RECOVERY_CHANGE" && targetEmail === user.email) {
      return { success: false, status: 400, message: "อีเมลสำรองต้องไม่ซ้ำกับอีเมลหลัก" };
    }

    const code = String(randomInt(100000, 1000000));
    const challenge: EmailChallenge = {
      userId,
      type: input.type,
      targetEmail,
      codeHash: this.hashEmailCode(code),
      attempts: 0,
      expiresAt: Date.now() + EMAIL_CODE_TTL_SECONDS * 1000,
    };
    const emailResult = await EmailVerificationEmailService.send({
      email: targetEmail,
      code,
      purpose: input.type,
      expiresInMinutes: EMAIL_CODE_TTL_SECONDS / 60,
    });
    if (!emailResult.success) {
      console.error("[AccountSecurity] Failed to send verification email:", emailResult.error);
      return { success: false, status: 503, message: "ไม่สามารถส่งอีเมลยืนยันได้" };
    }

    await this.setEmailChallenge(challenge);
    return { success: true, message: "ส่งรหัสยืนยันแล้ว", data: { email: targetEmail, expiresInSeconds: EMAIL_CODE_TTL_SECONDS } };
  }

  static async verifyEmailCode(userId: number, input: { type: EmailChallengeType; code: string }) {
    const challenge = await this.getEmailChallenge(userId, input.type);
    if (!challenge) return { success: false, status: 400, message: "รหัสหมดอายุหรือยังไม่ได้ขอรหัส" };

    if (this.hashEmailCode(input.code.trim()) !== challenge.codeHash) {
      challenge.attempts += 1;
      if (challenge.attempts >= EMAIL_CODE_MAX_ATTEMPTS) {
        await this.deleteEmailChallenge(userId, input.type);
        return { success: false, status: 400, message: "กรอกรหัสผิดเกินจำนวนที่กำหนด กรุณาขอรหัสใหม่" };
      }
      await this.setEmailChallenge(challenge);
      return { success: false, status: 400, message: `รหัสไม่ถูกต้อง เหลืออีก ${EMAIL_CODE_MAX_ATTEMPTS - challenge.attempts} ครั้ง` };
    }

    const current = await prisma.users.findUnique({
      where: { id: userId },
      select: { email: true, is_email_verified: true, recovery_email: true, metadata: true },
    });
    if (input.type === "PRIMARY_VERIFY" && current?.email !== challenge.targetEmail) {
      await this.deleteEmailChallenge(userId, input.type);
      return { success: false, status: 400, message: "อีเมลหลักถูกเปลี่ยนแล้ว กรุณาขอรหัสใหม่" };
    }
    if (input.type === "RECOVERY_VERIFY" && current?.recovery_email !== challenge.targetEmail) {
      await this.deleteEmailChallenge(userId, input.type);
      return { success: false, status: 400, message: "อีเมลสำรองถูกเปลี่ยนแล้ว กรุณาขอรหัสใหม่" };
    }
    if (input.type === "PRIMARY_CHANGE") {
      if (!current?.is_email_verified) {
        await this.deleteEmailChallenge(userId, input.type);
        return { success: false, status: 403, message: "กรุณายืนยันอีเมลหลักเดิมก่อนเปลี่ยนอีเมล" };
      }
      const exists = await prisma.users.findFirst({
        where: { email: challenge.targetEmail, id: { not: userId }, is_deleted: false },
        select: { id: true },
      });
      if (exists) {
        await this.deleteEmailChallenge(userId, input.type);
        return { success: false, status: 409, message: "อีเมลนี้ถูกใช้งานแล้ว" };
      }
    }
    let metadata: Record<string, unknown> = {};
    try {
      metadata = current?.metadata ? JSON.parse(current.metadata) : {};
    } catch {
      metadata = {};
    }

    const now = new Date();
    if (input.type === "PRIMARY_VERIFY") {
      await prisma.users.update({
        where: { id: userId },
        data: { is_email_verified: true, email_verified_at: now, updated_at: now },
      });
    } else if (input.type === "PRIMARY_CHANGE") {
      await prisma.users.update({
        where: { id: userId },
        data: { email: challenge.targetEmail, is_email_verified: true, email_verified_at: now, updated_at: now },
      });
    } else if (input.type === "RECOVERY_VERIFY" || input.type === "RECOVERY_CHANGE") {
      await prisma.users.update({
        where: { id: userId },
        data: {
          recovery_email: challenge.targetEmail,
          metadata: JSON.stringify({
            ...metadata,
            recoveryEmailVerified: true,
            recoveryEmailVerifiedAddress: challenge.targetEmail,
            recoveryEmailVerifiedAt: now.toISOString(),
          }),
          updated_at: now,
        },
      });
    }

    await this.deleteEmailChallenge(userId, input.type);
    await invalidateAuthUserCache(userId);
    void NotificationService.notifyEmailChanged({ userId, type: input.type, targetEmail: challenge.targetEmail });
    return { success: true, message: "ยืนยันอีเมลเรียบร้อยแล้ว", data: (await this.getEmailSettings(userId)).data };
  }

  static async getPasswordPolicy() {
    return { success: true, data: await getPasswordPolicy() };
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

    const policy = await getPasswordPolicy();
    const failures = validatePasswordPolicy(input.newPassword, policy);
    if (failures.length > 0) {
      return { success: false, status: 400, message: failures.join(", ") };
    }

    if (await isPasswordInHistory(userId, input.newPassword, policy.historyCount)) {
        return {
          success: false,
          status: 400,
          message: `ไม่สามารถใช้รหัสผ่านซ้ำกับ ${policy.historyCount} รหัสล่าสุดได้`,
        };
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
    void NotificationService.notifyPasswordChanged({ userId });
    return { success: true, message: "เปลี่ยนรหัสผ่านเรียบร้อยแล้ว" };
  }
}
