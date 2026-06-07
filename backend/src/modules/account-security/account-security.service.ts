import prisma from "@/config/prisma.config";
import { invalidateAuthUserCache } from "@/utils/cache-invalidation";
import {
  deleteEmailChallenge,
  EMAIL_CODE_MAX_ATTEMPTS,
  EMAIL_CODE_TTL_SECONDS,
  generateEmailCode,
  getEmailChallenge,
  hashEmailCode,
  setEmailChallenge,
} from "@/utils/email-challenge";
import type { EmailChallenge, EmailChallengeType } from "@/utils/email-challenge";
import { parseJsonObject } from "@/utils/parse-json-object";
import { PasswordUtil } from "@/utils/password";
import { getPasswordPolicy, isPasswordInHistory, validatePasswordPolicy } from "@/utils/password-policy";
import { EmailVerificationEmailService } from "@/templates/email/email-verification";
import { NotificationService } from "@/modules/notifications/notification.service";
import { getSettingValue } from "@/utils/get-setting-value";
import { randomBytes } from "node:crypto";
import * as OTPAuth from "otpauth";
import QRCode from "qrcode";
import { verifyTotpCode } from "@/utils/totp";
import { ActivityLogUtil } from "@/utils/activity-log";
import { ErrorLogUtil } from "@/utils/error-log";

export class AccountSecurityService {
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

    const metadata = parseJsonObject(user.metadata);

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

    const metadata = parseJsonObject(user.metadata);
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

    const code = generateEmailCode();
    const challenge: EmailChallenge = {
      userId,
      type: input.type,
      targetEmail,
      codeHash: hashEmailCode(code),
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
      ErrorLogUtil.log(emailResult.error ?? "Failed to send verification email", {
        source: "account-security:send-email-verification",
        userId,
        context: { type: input.type },
      });
      return { success: false, status: 503, message: "ไม่สามารถส่งอีเมลยืนยันได้" };
    }

    await setEmailChallenge(challenge);
    return { success: true, message: "ส่งรหัสยืนยันแล้ว", data: { email: targetEmail, expiresInSeconds: EMAIL_CODE_TTL_SECONDS } };
  }

  static async verifyEmailCode(userId: number, input: { type: EmailChallengeType; code: string }) {
    const challenge = await getEmailChallenge(userId, input.type);
    if (!challenge) return { success: false, status: 400, message: "รหัสหมดอายุหรือยังไม่ได้ขอรหัส" };

    if (hashEmailCode(input.code.trim()) !== challenge.codeHash) {
      challenge.attempts += 1;
      if (challenge.attempts >= EMAIL_CODE_MAX_ATTEMPTS) {
        await deleteEmailChallenge(userId, input.type);
        return { success: false, status: 400, message: "กรอกรหัสผิดเกินจำนวนที่กำหนด กรุณาขอรหัสใหม่" };
      }
      await setEmailChallenge(challenge);
      return { success: false, status: 400, message: `รหัสไม่ถูกต้อง เหลืออีก ${EMAIL_CODE_MAX_ATTEMPTS - challenge.attempts} ครั้ง` };
    }

    const current = await prisma.users.findUnique({
      where: { id: userId },
      select: { email: true, is_email_verified: true, recovery_email: true, metadata: true },
    });
    if (input.type === "PRIMARY_VERIFY" && current?.email !== challenge.targetEmail) {
      await deleteEmailChallenge(userId, input.type);
      return { success: false, status: 400, message: "อีเมลหลักถูกเปลี่ยนแล้ว กรุณาขอรหัสใหม่" };
    }
    if (input.type === "RECOVERY_VERIFY" && current?.recovery_email !== challenge.targetEmail) {
      await deleteEmailChallenge(userId, input.type);
      return { success: false, status: 400, message: "อีเมลสำรองถูกเปลี่ยนแล้ว กรุณาขอรหัสใหม่" };
    }
    if (input.type === "PRIMARY_CHANGE") {
      if (!current?.is_email_verified) {
        await deleteEmailChallenge(userId, input.type);
        return { success: false, status: 403, message: "กรุณายืนยันอีเมลหลักเดิมก่อนเปลี่ยนอีเมล" };
      }
      const exists = await prisma.users.findFirst({
        where: { email: challenge.targetEmail, id: { not: userId }, is_deleted: false },
        select: { id: true },
      });
      if (exists) {
        await deleteEmailChallenge(userId, input.type);
        return { success: false, status: 409, message: "อีเมลนี้ถูกใช้งานแล้ว" };
      }
    }
    const metadata = parseJsonObject(current?.metadata);

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

    await deleteEmailChallenge(userId, input.type);
    await invalidateAuthUserCache(userId);
    ActivityLogUtil.log({
      userId,
      action: "UPDATE",
      resourceType: "account_email",
      resourceId: userId,
      description: "Verified or changed account email",
      metadata: { type: input.type },
    });
    void NotificationService.notifyEmailChanged({ userId, type: input.type, targetEmail: challenge.targetEmail });
    return { success: true, message: "ยืนยันอีเมลเรียบร้อยแล้ว", data: (await this.getEmailSettings(userId)).data };
  }

  static async getPasswordPolicy() {
    return { success: true, data: await getPasswordPolicy() };
  }

  static async getPasswordHistory(userId: number) {
    const user = await prisma.users.findUnique({
      where: { id: userId, is_deleted: false },
      select: { password_changed_at: true },
    });
    if (!user) return { success: false, status: 404, message: "User not found" };

    const history = await prisma.password_history.findMany({
      where: { user_id: userId },
      orderBy: { created_at: "desc" },
      take: 20,
      select: {
        id: true,
        created_at: true,
        change_reason: true,
        ip_address: true,
        changed_by_user_id: true,
        users_password_history_changed_by_user_idTousers: {
          select: { username: true },
        },
      },
    });

    return {
      success: true,
      data: {
        lastChangedAt: user.password_changed_at,
        items: history.map((item) => ({
          id: item.id,
          changedAt: item.created_at,
          reason: item.change_reason,
          ipAddress: item.ip_address,
          changedByUserId: item.changed_by_user_id,
          changedByUsername: item.users_password_history_changed_by_user_idTousers?.username ?? null,
        })),
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
    ActivityLogUtil.log({ userId, action: 'CHANGE_PASSWORD', resourceType: 'users', resourceId: userId, description: 'Changed password (self-service)' });
    return { success: true, message: "เปลี่ยนรหัสผ่านเรียบร้อยแล้ว" };
  }

  // ─── Two-Factor Authentication ────────────────────────────────────────────

  private static generateBackupCodes(count = 8): string[] {
    return Array.from({ length: count }, () => {
      const hex = randomBytes(4).toString("hex").toUpperCase();
      return `${hex.slice(0, 4)}-${hex.slice(4, 8)}`;
    });
  }

  static async getTfaStatus(userId: number) {
    const record = await prisma.two_factor_auth.findUnique({
      where: { user_id: userId },
      select: { is_enabled: true, method: true, last_verified_at: true, backup_codes: true, backup_codes_used: true },
    });

    if (!record?.is_enabled) {
      return { success: true, data: { isEnabled: false, method: null, lastVerifiedAt: null, backupCodesRemaining: 0 } };
    }

    const total = (JSON.parse(record.backup_codes ?? "[]") as string[]).length;
    const used = (JSON.parse(record.backup_codes_used ?? "[]") as string[]).length;

    return {
      success: true,
      data: {
        isEnabled: true,
        method: record.method,
        lastVerifiedAt: record.last_verified_at,
        backupCodesRemaining: Math.max(0, total - used),
      },
    };
  }

  static async setupTfa(userId: number) {
    const [user, existing] = await Promise.all([
      prisma.users.findUnique({ where: { id: userId }, select: { username: true } }),
      prisma.two_factor_auth.findUnique({ where: { user_id: userId }, select: { is_enabled: true } }),
    ]);

    if (!user) return { success: false, status: 404, message: "User not found" };
    if (existing?.is_enabled) return { success: false, status: 400, message: "2FA เปิดใช้งานอยู่แล้ว กรุณาปิดก่อนตั้งค่าใหม่" };

    const issuer = String(await getSettingValue("system_name", "System"));
    const secret = new OTPAuth.Secret({ size: 20 });
    const totp = new OTPAuth.TOTP({ issuer, label: user.username, algorithm: "SHA1", digits: 6, period: 30, secret });

    const [qrCodeDataUrl] = await Promise.all([
      QRCode.toDataURL(totp.toString(), { width: 256, margin: 2 }),
      prisma.two_factor_auth.upsert({
        where: { user_id: userId },
        create: { user_id: userId, method: "TOTP", secret: secret.base32, is_enabled: false },
        update: { secret: secret.base32, is_enabled: false, backup_codes: null, backup_codes_used: null, updated_at: new Date() },
      }),
    ]);

    return { success: true, data: { qrCodeDataUrl, manualKey: secret.base32, issuer, label: user.username } };
  }

  static async enableTfa(userId: number, code: string) {
    const MAX_ATTEMPTS = 10;
    const record = await prisma.two_factor_auth.findUnique({
      where: { user_id: userId },
      select: { secret: true, is_enabled: true, verification_attempts: true },
    });

    if (!record?.secret) return { success: false, status: 400, message: "กรุณาเริ่มต้นตั้งค่า 2FA ก่อน" };
    if (record.is_enabled) return { success: false, status: 400, message: "2FA เปิดใช้งานอยู่แล้ว" };
    if (record.verification_attempts >= MAX_ATTEMPTS) {
      return { success: false, status: 429, message: "พยายามยืนยันเกินจำนวนที่กำหนด กรุณาตั้งค่า 2FA ใหม่อีกครั้ง" };
    }

    if (!verifyTotpCode(record.secret, code)) {
      await prisma.two_factor_auth.update({
        where: { user_id: userId },
        data: { verification_attempts: { increment: 1 }, updated_at: new Date() },
      });
      return { success: false, status: 400, message: "รหัส OTP ไม่ถูกต้อง กรุณาตรวจสอบนาฬิกาของอุปกรณ์แล้วลองใหม่" };
    }

    const plainCodes = this.generateBackupCodes(8);
    const hashedCodes = await Promise.all(plainCodes.map((c) => PasswordUtil.hash(c.replace("-", ""))));

    await prisma.two_factor_auth.update({
      where: { user_id: userId },
      data: {
        is_enabled: true,
        method: "TOTP",
        backup_codes: JSON.stringify(hashedCodes),
        backup_codes_used: null,
        last_verified_at: new Date(),
        verification_attempts: 0,
        updated_at: new Date(),
      },
    });

    await invalidateAuthUserCache(userId);
    void NotificationService.notifyTfaChanged({ userId, enabled: true });
    ActivityLogUtil.log({ userId, action: 'ENABLE', resourceType: 'two_factor_auth', resourceId: userId, description: 'Enabled 2FA' });

    return { success: true, data: { backupCodes: plainCodes } };
  }

  static async disableTfa(userId: number, code: string) {
    const MAX_ATTEMPTS = 10;
    const record = await prisma.two_factor_auth.findUnique({
      where: { user_id: userId },
      select: { secret: true, is_enabled: true, verification_attempts: true },
    });

    if (!record?.is_enabled) return { success: false, status: 400, message: "2FA ยังไม่ได้เปิดใช้งาน" };
    if (!record.secret) return { success: false, status: 400, message: "ไม่พบข้อมูล 2FA" };
    if (record.verification_attempts >= MAX_ATTEMPTS) {
      return { success: false, status: 429, message: "พยายามยืนยันเกินจำนวนที่กำหนด กรุณาลองใหม่ภายหลัง" };
    }

    if (!verifyTotpCode(record.secret, code)) {
      await prisma.two_factor_auth.update({
        where: { user_id: userId },
        data: { verification_attempts: { increment: 1 }, updated_at: new Date() },
      });
      return { success: false, status: 400, message: "รหัส OTP ไม่ถูกต้อง" };
    }

    await prisma.two_factor_auth.update({
      where: { user_id: userId },
      data: {
        is_enabled: false,
        secret: null,
        backup_codes: null,
        backup_codes_used: null,
        tfaSessionToken: null,
        last_verified_at: null,
        verification_attempts: 0,
        updated_at: new Date(),
      },
    });

    await invalidateAuthUserCache(userId);
    void NotificationService.notifyTfaChanged({ userId, enabled: false });
    ActivityLogUtil.log({ userId, action: 'DISABLE', resourceType: 'two_factor_auth', resourceId: userId, description: 'Disabled 2FA' });

    return { success: true, message: "ปิดใช้งาน 2FA เรียบร้อยแล้ว" };
  }

  static async regenerateBackupCodes(userId: number, code: string) {
    const MAX_ATTEMPTS = 10;
    const record = await prisma.two_factor_auth.findUnique({
      where: { user_id: userId },
      select: { secret: true, is_enabled: true, verification_attempts: true },
    });

    if (!record?.is_enabled) return { success: false, status: 400, message: "2FA ยังไม่ได้เปิดใช้งาน" };
    if (!record.secret) return { success: false, status: 400, message: "ไม่พบข้อมูล 2FA" };
    if (record.verification_attempts >= MAX_ATTEMPTS) {
      return { success: false, status: 429, message: "พยายามยืนยันเกินจำนวนที่กำหนด กรุณาลองใหม่ภายหลัง" };
    }

    if (!verifyTotpCode(record.secret, code)) {
      await prisma.two_factor_auth.update({
        where: { user_id: userId },
        data: { verification_attempts: { increment: 1 }, updated_at: new Date() },
      });
      return { success: false, status: 400, message: "รหัส OTP ไม่ถูกต้อง" };
    }

    const plainCodes = this.generateBackupCodes(8);
    const hashedCodes = await Promise.all(plainCodes.map((c) => PasswordUtil.hash(c.replace("-", ""))));

    await prisma.two_factor_auth.update({
      where: { user_id: userId },
      data: {
        backup_codes: JSON.stringify(hashedCodes),
        backup_codes_used: null,
        verification_attempts: 0,
        updated_at: new Date(),
      },
    });

    ActivityLogUtil.log({ userId, action: 'UPDATE', resourceType: 'two_factor_auth', resourceId: userId, description: 'Regenerated 2FA backup codes' });
    return { success: true, data: { backupCodes: plainCodes } };
  }
}
