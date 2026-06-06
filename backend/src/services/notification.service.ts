import prisma from "@/config/prisma.config";
import { AccountLockedEmailService } from "@/templates/email/account-locked";
import { LoginNotificationEmailService } from "@/templates/email/login-notification";
import { PasswordChangedEmailService } from "@/templates/email/password-changed";
import { EmailChangedEmailService } from "@/templates/email/email-changed";
import { PasswordResetByAdminEmailService } from "@/templates/email/password-reset-by-admin";
import { ForceLogoutEmailService } from "@/templates/email/force-logout-notification";
import { AccountUnlockedEmailService } from "@/templates/email/account-unlocked";
import { AccountStatusChangedEmailService } from "@/templates/email/account-status-changed";
import { SessionRevokedEmailService } from "@/templates/email/session-revoked";
import { formatSystemDate } from "@/utils/date-formatter";
import { createInAppNotification, notifyUsersWithRoles } from "@/utils/inapp-notification";

type EmailChallengeType = "PRIMARY_VERIFY" | "PRIMARY_CHANGE" | "RECOVERY_VERIFY" | "RECOVERY_CHANGE";

export class NotificationService {
  private static async getUser(userId: number) {
    return prisma.users.findUnique({
      where: { id: userId },
      select: { username: true, email: true },
    });
  }

  static async notifyLoginSuccess(input: {
    userId: number;
    username: string;
    email: string;
    ipAddress: string;
    deviceType: string;
    browser: string;
    os: string;
    platform: string;
  }) {
    const { sent, settings } = await createInAppNotification({
      userId: input.userId,
      title: "เข้าสู่ระบบสำเร็จ",
      message: `เข้าสู่ระบบจาก ${input.browser} บน ${input.os} (${input.ipAddress})`,
      type: "LOGIN",
      priority: "NORMAL",
    });

    if (!sent) return;

    if (settings.email_notifications) {
      await LoginNotificationEmailService.sendLoginNotificationEmail({
        username: input.username,
        email: input.email,
        login_time: await formatSystemDate(),
        ip_address: input.ipAddress,
        device_type: input.deviceType,
        browser: input.browser,
        os: input.os,
        platform: input.platform,
      });
    }
  }

  static async notifyAccountLocked(input: {
    userId: number;
    username: string;
    email: string;
    lockedUntil: Date;
    failedAttempts: number;
    lockedDurationMinutes: number;
    ipAddress: string;
    deviceType: string;
  }) {
    const { sent, settings } = await createInAppNotification({
      userId: input.userId,
      title: "บัญชีถูกล็อกชั่วคราว",
      message: `บัญชีถูกล็อก ${input.lockedDurationMinutes} นาที เนื่องจากพยายามเข้าสู่ระบบผิดหลายครั้ง`,
      type: "SECURITY",
      priority: "HIGH",
    });

    if (!sent) return;

    if (settings.email_notifications) {
      await AccountLockedEmailService.sendAccountLockedEmail({
        username: input.username,
        email: input.email,
        locked_until: input.lockedUntil,
        failed_attempts: input.failedAttempts,
        locked_duration_minutes: input.lockedDurationMinutes,
        last_attempt_ip: input.ipAddress || "Unknown",
        last_attempt_device: input.deviceType || "Unknown",
        last_attempt_time: await formatSystemDate(),
      });
    }
  }

  static async notifyPasswordChanged(input: {
    userId: number;
  }) {
    const user = await this.getUser(input.userId);
    if (!user) return;

    const { sent, settings } = await createInAppNotification({
      userId: input.userId,
      title: "เปลี่ยนรหัสผ่านแล้ว",
      message: "รหัสผ่านของคุณถูกเปลี่ยนเรียบร้อยแล้ว หากไม่ใช่คุณดำเนินการ กรุณาติดต่อผู้ดูแลระบบทันที",
      type: "SECURITY",
      priority: "HIGH",
    });

    if (!sent) return;

    if (settings.email_notifications) {
      await PasswordChangedEmailService.sendPasswordChangedEmail({
        username: user.username,
        email: user.email,
        changed_at: await formatSystemDate(),
      });
    }
  }

  static async notifyEmailChanged(input: {
    userId: number;
    type: EmailChallengeType;
    targetEmail: string;
  }) {
    const user = await this.getUser(input.userId);
    if (!user) return;

    const titleMap: Record<EmailChallengeType, string> = {
      PRIMARY_VERIFY: "ยืนยันอีเมลสำเร็จ",
      PRIMARY_CHANGE: "เปลี่ยนอีเมลสำเร็จ",
      RECOVERY_VERIFY: "ยืนยันอีเมลสำรองสำเร็จ",
      RECOVERY_CHANGE: "อัปเดตอีเมลสำรองสำเร็จ",
    };
    const messageMap: Record<EmailChallengeType, string> = {
      PRIMARY_VERIFY: "อีเมลหลักของคุณได้รับการยืนยันเรียบร้อยแล้ว",
      PRIMARY_CHANGE: `อีเมลหลักถูกเปลี่ยนเป็น ${input.targetEmail}`,
      RECOVERY_VERIFY: "อีเมลสำรองได้รับการยืนยันเรียบร้อยแล้ว",
      RECOVERY_CHANGE: `อีเมลสำรองถูกอัปเดตเป็น ${input.targetEmail}`,
    };

    const { sent, settings } = await createInAppNotification({
      userId: input.userId,
      title: titleMap[input.type],
      message: messageMap[input.type],
      type: "SECURITY",
      priority: "NORMAL",
    });

    if (!sent) return;

    if (settings.email_notifications) {
      await EmailChangedEmailService.sendEmailChangedEmail({
        username: user.username,
        email: input.targetEmail,
        type: input.type,
        target_email: input.targetEmail,
        changed_at: await formatSystemDate(),
      });
    }
  }

  static async notifyPasswordResetByAdmin(input: {
    userId: number;
    mustChangePassword: boolean;
  }) {
    const user = await this.getUser(input.userId);
    if (!user) return;

    const { sent, settings } = await createInAppNotification({
      userId: input.userId,
      title: "รหัสผ่านถูกรีเซ็ต",
      message: "รหัสผ่านของคุณถูกรีเซ็ตโดยผู้ดูแลระบบ กรุณาเปลี่ยนรหัสผ่านหลังเข้าสู่ระบบ",
      type: "SECURITY",
      priority: "HIGH",
    });

    if (!sent) return;

    if (settings.email_notifications) {
      await PasswordResetByAdminEmailService.sendPasswordResetByAdminEmail({
        username: user.username,
        email: user.email,
        must_change_password: input.mustChangePassword,
        reset_at: await formatSystemDate(),
      });
    }
  }

  static async notifyForceLogout(input: {
    userId: number;
  }) {
    const user = await this.getUser(input.userId);
    if (!user) return;

    const { sent, settings } = await createInAppNotification({
      userId: input.userId,
      title: "ออกจากระบบโดยผู้ดูแล",
      message: "เซสชันทั้งหมดของคุณถูกยกเลิกโดยผู้ดูแลระบบ",
      type: "SECURITY",
      priority: "HIGH",
    });

    if (!sent) return;

    if (settings.email_notifications) {
      await ForceLogoutEmailService.sendForceLogoutEmail({
        username: user.username,
        email: user.email,
        action_at: await formatSystemDate(),
      });
    }
  }

  static async notifyAccountUnlocked(input: {
    userId: number;
  }) {
    const user = await this.getUser(input.userId);
    if (!user) return;

    const { sent, settings } = await createInAppNotification({
      userId: input.userId,
      title: "บัญชีถูกปลดล็อกแล้ว",
      message: "บัญชีของคุณถูกปลดล็อกโดยผู้ดูแลระบบ คุณสามารถเข้าสู่ระบบได้แล้ว",
      type: "SECURITY",
      priority: "NORMAL",
    });

    if (!sent) return;

    if (settings.email_notifications) {
      await AccountUnlockedEmailService.sendAccountUnlockedEmail({
        username: user.username,
        email: user.email,
        unlocked_at: await formatSystemDate(),
      });
    }
  }

  static async notifyAccountStatusChanged(input: {
    userId: number;
    isActive: boolean;
  }) {
    const user = await this.getUser(input.userId);
    if (!user) return;

    const { sent, settings } = await createInAppNotification({
      userId: input.userId,
      title: input.isActive ? "บัญชีถูกเปิดใช้งาน" : "บัญชีถูกปิดใช้งาน",
      message: input.isActive
        ? "บัญชีของคุณถูกเปิดใช้งานโดยผู้ดูแลระบบ"
        : "บัญชีของคุณถูกปิดใช้งานโดยผู้ดูแลระบบ",
      type: input.isActive ? "SYSTEM" : "SECURITY",
      priority: input.isActive ? "NORMAL" : "HIGH",
    });

    if (!sent) return;

    if (settings.email_notifications) {
      await AccountStatusChangedEmailService.sendAccountStatusChangedEmail({
        username: user.username,
        email: user.email,
        is_active: input.isActive,
        changed_at: await formatSystemDate(),
      });
    }
  }

  static async notifyUserRolesUpdated(input: {
    userId: number;
  }) {
    await createInAppNotification({
      userId: input.userId,
      title: "บทบาทถูกอัปเดต",
      message: "บทบาทของบัญชีคุณถูกแก้ไขโดยผู้ดูแลระบบ กรุณาเข้าสู่ระบบใหม่เพื่อให้การเปลี่ยนแปลงมีผล",
      type: "SYSTEM",
      priority: "NORMAL",
    });
  }

  static async notifySessionRevoked(input: {
    userId: number;
  }) {
    const user = await this.getUser(input.userId);
    if (!user) return;

    const { sent, settings } = await createInAppNotification({
      userId: input.userId,
      title: "เซสชันถูกยกเลิก",
      message: "เซสชันหนึ่งของคุณถูกยกเลิกโดยผู้ดูแลระบบ",
      type: "SECURITY",
      priority: "NORMAL",
    });

    if (!sent) return;

    if (settings.email_notifications) {
      await SessionRevokedEmailService.sendSessionRevokedEmail({
        username: user.username,
        email: user.email,
        revoked_at: await formatSystemDate(),
      });
    }
  }

  static async notifyTfaChanged(input: { userId: number; enabled: boolean }) {
    await createInAppNotification({
      userId: input.userId,
      title: input.enabled ? "เปิดใช้งาน 2FA สำเร็จ" : "ปิดใช้งาน 2FA แล้ว",
      message: input.enabled
        ? "บัญชีของคุณได้รับการป้องกันด้วย Two-Factor Authentication แล้ว"
        : "ปิดใช้งาน Two-Factor Authentication บนบัญชีนี้แล้ว หากไม่ได้ดำเนินการเอง กรุณาติดต่อผู้ดูแลระบบทันที",
      type: "SECURITY",
      priority: input.enabled ? "NORMAL" : "HIGH",
    });
  }

  // ─── Admin / SUPERADMIN Notifications ────────────────────────────────────────

  static async notifyAdminsSecuritySettingsChanged(input: { actorId?: number; jwtSecretChanged: boolean }) {
    const priority = input.jwtSecretChanged ? "CRITICAL" : "HIGH";
    const title = input.jwtSecretChanged
      ? "⚠️ JWT Secret ถูกเปลี่ยน — Session ทั้งหมดจะถูก Invalidate"
      : "ตั้งค่าความปลอดภัยถูกแก้ไข";
    const message = input.jwtSecretChanged
      ? "JWT Secret ถูกเปลี่ยนแปลง ผู้ใช้ทุกคนจะถูก logout อัตโนมัติ"
      : "Security settings ถูกแก้ไข เช่น Token expiry, Login limits หรือ Session limits";
    await notifyUsersWithRoles(["SUPERADMIN"], { title, message, type: "SECURITY", priority }, input.actorId);
  }

  static async notifyAdminsSmtpSettingsChanged(input: { actorId?: number }) {
    await notifyUsersWithRoles(
      ["SUPERADMIN"],
      { title: "SMTP Settings ถูกแก้ไข", message: "การตั้งค่า SMTP สำหรับส่งอีเมลถูกเปลี่ยนแปลง กรุณาตรวจสอบว่าส่งอีเมลได้ปกติ", type: "SYSTEM", priority: "HIGH" },
      input.actorId,
    );
  }

  static async notifyAdminsRedisSettingsChanged(input: { actorId?: number }) {
    await notifyUsersWithRoles(
      ["SUPERADMIN"],
      { title: "Redis Settings ถูกแก้ไข", message: "การตั้งค่า Redis ถูกเปลี่ยนแปลง Cache และ Online Presence อาจได้รับผลกระทบ", type: "SYSTEM", priority: "HIGH" },
      input.actorId,
    );
  }

  static async notifyAdminsCorsSettingsChanged(input: { actorId?: number; origins: string[] }) {
    await notifyUsersWithRoles(
      ["SUPERADMIN"],
      { title: "CORS Origins ถูกแก้ไข", message: `อนุญาต origins: ${input.origins.join(", ") || "(ว่าง)"}`, type: "SECURITY", priority: "HIGH" },
      input.actorId,
    );
  }

  static async notifyAdminsPendingApproval(input: { username: string; email: string }) {
    await notifyUsersWithRoles(
      ["SUPERADMIN", "ADMIN"],
      { title: "ผู้ใช้ใหม่รอการอนุมัติ", message: `${input.username} (${input.email}) สมัครสมาชิกและรอการอนุมัติ`, type: "SYSTEM", priority: "HIGH" },
    );
  }

  static async notifyAdminsIpBlocklistChanged(input: { action: "add" | "remove"; ipAddress: string; actorId?: number }) {
    const title = input.action === "add" ? "เพิ่ม IP ใน Blocklist" : "ลบ IP ออกจาก Blocklist";
    const message = `${input.action === "add" ? "บล็อก" : "ปลดบล็อก"} IP: ${input.ipAddress}`;
    await notifyUsersWithRoles(
      ["SUPERADMIN", "ADMIN"],
      { title, message, type: "SECURITY", priority: "NORMAL" },
      input.actorId,
    );
  }

  static async notifyAdminsRoleDeleted(input: { roleId: string; roleName: string; actorId?: number }) {
    await notifyUsersWithRoles(
      ["SUPERADMIN", "ADMIN"],
      { title: "Role ถูกลบ", message: `Role "${input.roleName}" (${input.roleId}) ถูกลบออกจากระบบ`, type: "SECURITY", priority: "HIGH" },
      input.actorId,
    );
  }

  static async notifyAdminsUserPermanentDeleted(input: { username: string; actorId?: number }) {
    await notifyUsersWithRoles(
      ["SUPERADMIN", "ADMIN"],
      { title: "ลบผู้ใช้อย่างถาวร", message: `บัญชี "${input.username}" ถูกลบออกจากระบบอย่างถาวร ไม่สามารถกู้คืนได้`, type: "SYSTEM", priority: "HIGH" },
      input.actorId,
    );
  }
}
