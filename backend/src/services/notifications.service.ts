import prisma from "@/config/prisma.config";

type SortOrder = "newest" | "oldest";
type StatusFilter = "all" | "read" | "unread";

interface ListInput {
  page?: number;
  pageSize?: number;
  search?: string;
  type?: string;
  status?: StatusFilter;
  sort?: SortOrder;
}

export class NotificationsService {
  static async list(userId: number, input: ListInput = {}) {
    const page = Math.max(1, input.page ?? 1);
    const pageSize = Math.min(50, Math.max(1, input.pageSize ?? 20));
    const search = input.search?.trim();

    const filteredWhere = {
      user_id: userId,
      ...(search && {
        OR: [
          { title: { contains: search } },
          { message: { contains: search } },
        ],
      }),
      ...(input.type && { type: input.type }),
      ...(input.status === "read" && { is_read: true }),
      ...(input.status === "unread" && { is_read: false }),
    };

    const orderBy =
      input.sort === "oldest"
        ? { created_at: "asc" as const }
        : { created_at: "desc" as const };

    const [items, filteredTotal, globalTotal, globalUnread] = await Promise.all([
      prisma.notifications.findMany({
        where: filteredWhere,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.notifications.count({ where: filteredWhere }),
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
          totalItems: filteredTotal,
          totalPages: Math.max(1, Math.ceil(filteredTotal / pageSize)),
        },
        stats: {
          total: globalTotal,
          unread: globalUnread,
          read: globalTotal - globalUnread,
        },
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
