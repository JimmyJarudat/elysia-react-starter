import { AccountLockedEmailService } from "@/templates/email/account-locked";
import { LoginNotificationEmailService } from "@/templates/email/login-notification";
import { formatSystemDate } from "@/utils/date-formatter";
import { createInAppNotification } from "@/utils/inapp-notification";

export class NotificationService {
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
}
