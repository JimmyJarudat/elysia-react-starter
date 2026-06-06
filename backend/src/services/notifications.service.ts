import prisma from "@/config/prisma.config";

interface ListInput {
  page?: number;
  pageSize?: number;
}

export class NotificationsService {
  static async list(userId: number, input: ListInput = {}) {
    const page = Math.max(1, input.page ?? 1);
    const pageSize = Math.min(50, Math.max(1, input.pageSize ?? 20));

    const [items, total, unreadCount] = await Promise.all([
      prisma.notifications.findMany({
        where: { user_id: userId },
        orderBy: { created_at: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.notifications.count({ where: { user_id: userId } }),
      prisma.notifications.count({ where: { user_id: userId, is_read: false } }),
    ]);

    return {
      success: true,
      data: {
        items: items.map((n) => ({
          id: n.id,
          title: n.title,
          message: n.message,
          type: n.type,
          priority: n.priority,
          isRead: n.is_read,
          createdAt: n.created_at,
        })),
        pagination: {
          page,
          pageSize,
          totalItems: total,
          totalPages: Math.max(1, Math.ceil(total / pageSize)),
        },
        unreadCount,
      },
    };
  }

  static async markRead(userId: number, id: number) {
    const result = await prisma.notifications.updateMany({
      where: { id, user_id: userId },
      data: { is_read: true },
    });
    if (result.count === 0) {
      return { success: false, status: 404, message: "Notification not found" };
    }
    return { success: true };
  }

  static async markAllRead(userId: number) {
    await prisma.notifications.updateMany({
      where: { user_id: userId, is_read: false },
      data: { is_read: true },
    });
    return { success: true };
  }
}
