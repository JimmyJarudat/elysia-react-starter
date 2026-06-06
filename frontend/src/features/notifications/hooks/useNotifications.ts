import { useState, useEffect, useCallback, useRef } from "react";
import { useApi } from "@/hooks/useApi";
import { apiConfig } from "@/config";

export interface AppNotification {
  id: number;
  title: string;
  message: string;
  type: string;
  priority: string;
  isRead: boolean;
  createdAt: string;
}

interface NotificationsData {
  items: AppNotification[];
  unreadCount: number;
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  loading: boolean;
}

export function useNotifications(initialPageSize = 20) {
  const { get, patch } = useApi();

  const [data, setData] = useState<NotificationsData>({
    items: [],
    unreadCount: 0,
    page: 1,
    pageSize: initialPageSize,
    totalItems: 0,
    totalPages: 1,
    loading: false,
  });

  const esRef = useRef<EventSource | null>(null);

  const fetchPage = useCallback(
    async (page: number, pageSize: number) => {
      setData((prev) => ({ ...prev, loading: true }));
      try {
        const res = await get<{
          success: boolean;
          data: {
            items: AppNotification[];
            pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
            unreadCount: number;
          };
        }>(`/notifications?page=${page}&pageSize=${pageSize}`);
        const { items, pagination, unreadCount } = res.data.data;
        setData({
          items,
          unreadCount,
          page: pagination.page,
          pageSize: pagination.pageSize,
          totalItems: pagination.totalItems,
          totalPages: pagination.totalPages,
          loading: false,
        });
      } catch {
        setData((prev) => ({ ...prev, loading: false }));
      }
    },
    [get],
  );

  const markRead = useCallback(
    async (id: number) => {
      setData((prev) => {
        const wasUnread = prev.items.some((n) => n.id === id && !n.isRead);
        return {
          ...prev,
          items: prev.items.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
          unreadCount: wasUnread ? Math.max(0, prev.unreadCount - 1) : prev.unreadCount,
        };
      });
      try {
        await patch(`/notifications/${id}/read`);
      } catch { /* optimistic — ignore error */ }
    },
    [patch],
  );

  const markAllRead = useCallback(async () => {
    setData((prev) => ({
      ...prev,
      items: prev.items.map((n) => ({ ...n, isRead: true })),
      unreadCount: 0,
    }));
    try {
      await patch("/notifications/read-all");
    } catch { /* optimistic — ignore error */ }
  }, [patch]);

  const changePage = useCallback(
    (page: number) => fetchPage(page, data.pageSize),
    [fetchPage, data.pageSize],
  );

  const changePageSize = useCallback(
    (pageSize: number) => fetchPage(1, pageSize),
    [fetchPage],
  );

  // Initial fetch
  useEffect(() => {
    fetchPage(1, initialPageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // SSE subscription — push new notifications in real-time
  useEffect(() => {
    const url = `${apiConfig.backendBaseUrl}/notifications/sse`;
    const es = new EventSource(url, { withCredentials: true });
    esRef.current = es;

    es.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data as string) as {
          type: string;
          notification: AppNotification;
          unreadCount: number;
        };
        if (payload.type === "new_notification") {
          setData((prev) => ({
            ...prev,
            items: [payload.notification, ...prev.items],
            unreadCount: payload.unreadCount,
            totalItems: prev.totalItems + 1,
            totalPages: Math.max(1, Math.ceil((prev.totalItems + 1) / prev.pageSize)),
          }));
        }
      } catch { /* malformed event — ignore */ }
    };

    return () => {
      es.close();
      esRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { ...data, fetchPage, markRead, markAllRead, changePage, changePageSize };
}
