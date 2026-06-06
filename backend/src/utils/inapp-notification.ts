import prisma from "@/config/prisma.config";
import { ssePushToUser } from "@/utils/notification-sse";

export type NotificationType = "LOGIN" | "SECURITY" | "SYSTEM" | "INFO" | "WARNING";
export type NotificationPriority = "LOW" | "NORMAL" | "HIGH" | "CRITICAL";

export type UserNotificationSettings = {
  login_notifications: boolean;
  security_notifications: boolean;
  system_notifications: boolean;
  email_notifications: boolean;
  sound_notifications: boolean;
};

// Maps notification type → the settings flag that gates it
const typeSettingMap: Partial<Record<NotificationType, keyof UserNotificationSettings>> = {
  LOGIN: "login_notifications",
  SECURITY: "security_notifications",
  SYSTEM: "system_notifications",
};

/**
 * Creates an in-app notification for a user, respecting their notification settings.
 *
 * Returns { sent, settings } so callers can read settings (e.g. email_notifications)
 * without an extra DB round-trip.
 *
 * If the type-specific setting is disabled, the notification is skipped and sent = false.
 * Types with no mapping (INFO, WARNING) are always created.
 */
export async function createInAppNotification(input: {
  userId: number;
  title: string;
  message: string;
  type: NotificationType;
  priority?: NotificationPriority;
}): Promise<{ sent: boolean; settings: UserNotificationSettings }> {
  const settings = await prisma.notification_settings.upsert({
    where: { user_id: input.userId },
    create: { user_id: input.userId },
    update: {},
  });

  const settingField = typeSettingMap[input.type];
  if (settingField && !settings[settingField]) {
    return { sent: false, settings };
  }

  const notification = await prisma.notifications.create({
    data: {
      user_id: input.userId,
      title: input.title,
      message: input.message,
      type: input.type,
      priority: input.priority ?? "NORMAL",
    },
  });

  const unreadCount = await prisma.notifications.count({
    where: { user_id: input.userId, is_read: false },
  });

  ssePushToUser(input.userId, {
    type: "new_notification",
    notification: {
      id: notification.id,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      priority: notification.priority,
      isRead: false,
      createdAt: notification.created_at,
    },
    unreadCount,
  });

  return { sent: true, settings };
}
