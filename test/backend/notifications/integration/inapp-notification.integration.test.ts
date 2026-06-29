import { describe, expect, test } from "bun:test";
import prisma, { uniqueMarker } from "../../../helpers/db";
import {
  createInAppNotification,
  notifyUsersWithRoles,
} from "../../../../backend/src/utils/inapp-notification";

async function createTestUser(label: string) {
  const marker = uniqueMarker(label);
  return prisma.users.create({
    data: { username: marker, email: `${marker}@example.invalid`, password: "unused" },
  });
}

async function cleanupUser(userId: number) {
  await prisma.notifications.deleteMany({ where: { user_id: userId } });
  await prisma.users.delete({ where: { id: userId } }); // cascades notification_settings
}

describe("backend createInAppNotification (real DB)", () => {
  test("creates the notification and settings row for a type with no gate (INFO)", async () => {
    const user = await createTestUser("inapp-info");

    try {
      const result = await createInAppNotification({
        userId: user.id,
        title: "Heads up",
        message: "Something happened",
        type: "INFO",
      });

      expect(result.sent).toBe(true);
      // UserNotificationSettings's exported type only declares the gating booleans, but the
      // actual Prisma row (and thus the real return value) also carries user_id/id/timestamps.
      expect((result.settings as unknown as { user_id: number }).user_id).toBe(user.id);

      const notification = await prisma.notifications.findFirst({ where: { user_id: user.id } });
      expect(notification?.title).toBe("Heads up");
      expect(notification?.priority).toBe("NORMAL");
      expect(notification?.is_read).toBe(false);
    } finally {
      await cleanupUser(user.id);
    }
  }, 15000);

  test("skips creating a notification when the gating setting defaults to off (SYSTEM)", async () => {
    const user = await createTestUser("inapp-system-default-off");

    try {
      // notification_settings defaults system_notifications to false on first upsert.
      const result = await createInAppNotification({
        userId: user.id,
        title: "System event",
        message: "...",
        type: "SYSTEM",
      });

      expect(result.sent).toBe(false);
      expect(result.settings.system_notifications).toBe(false);
      expect(await prisma.notifications.count({ where: { user_id: user.id } })).toBe(0);
    } finally {
      await cleanupUser(user.id);
    }
  }, 15000);

  test("sends a gated notification once the setting is enabled (LOGIN)", async () => {
    const user = await createTestUser("inapp-login-enabled");

    try {
      await prisma.notification_settings.create({ data: { user_id: user.id, login_notifications: true } });

      const result = await createInAppNotification({
        userId: user.id,
        title: "New sign-in",
        message: "...",
        type: "LOGIN",
        priority: "HIGH",
      });

      expect(result.sent).toBe(true);
      const notification = await prisma.notifications.findFirst({ where: { user_id: user.id } });
      expect(notification?.priority).toBe("HIGH");
    } finally {
      await cleanupUser(user.id);
    }
  }, 15000);
});

describe("backend notifyUsersWithRoles (real DB)", () => {
  test("notifies every active user with the given role, excluding the given user", async () => {
    const roleId = `zzt_notify_${Math.random().toString(36).slice(2, 8)}`;
    const [recipient, excluded] = await Promise.all([
      createTestUser("notify-recipient"),
      createTestUser("notify-excluded"),
      prisma.roles.create({ data: { id: roleId, name: uniqueMarker("notify-role") } }),
    ]);

    await Promise.all([
      prisma.user_roles.create({ data: { user_id: recipient.id, role_id: roleId } }),
      prisma.user_roles.create({ data: { user_id: excluded.id, role_id: roleId } }),
    ]);

    try {
      await notifyUsersWithRoles(
        [roleId],
        { title: "Broadcast", message: "Hello team", type: "INFO" },
        excluded.id,
      );

      expect(await prisma.notifications.count({ where: { user_id: recipient.id } })).toBe(1);
      expect(await prisma.notifications.count({ where: { user_id: excluded.id } })).toBe(0);
    } finally {
      await prisma.user_roles.deleteMany({ where: { role_id: roleId } });
      await prisma.roles.delete({ where: { id: roleId } });
      await cleanupUser(recipient.id);
      await cleanupUser(excluded.id);
    }
  }, 20000);
});
