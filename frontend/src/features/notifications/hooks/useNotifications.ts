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

export interface NotificationStats {
  total: number;
  unread: number;
  read: number;
}

interface NotificationsState {
  items: AppNotification[];
  stats: NotificationStats;
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  loading: boolean;
}

export interface UseNotificationsOptions {
  pageSize?: number;
  search?: string;
  type?: string;
  status?: "all" | "read" | "unread";
  sort?: "newest" | "oldest";
  /** When SSE fires a new notification, prepend it to the items list (default: true).
   *  Set false in filtered views so SSE only updates the unread badge count. */
  prependOnSSE?: boolean;
  /** Play a sound when a new notification arrives via SSE. */
  soundEnabled?: boolean;
  /** URL of the audio file to play. Falls back to /sound/notification.mp3. */
  soundUrl?: string;
  /** Called when a new notification arrives via SSE. */
  onNewNotification?: (notification: AppNotification) => void;
}

export function useNotifications(options: UseNotificationsOptions | number = {}) {
  const opts: UseNotificationsOptions =
    typeof options === "number" ? { pageSize: options } : options;

  const {
    pageSize: initialPageSize = 20,
    search,
    type,
    status,
    sort,
    prependOnSSE = true,
    soundEnabled = false,
    soundUrl,
    onNewNotification,
  } = opts;

  const { get, patch } = useApi();

  const [data, setData] = useState<NotificationsState>({
    items: [],
    stats: { total: 0, unread: 0, read: 0 },
    page: 1,
    pageSize: initialPageSize,
    totalItems: 0,
    totalPages: 1,
    loading: false,
  });

  const esRef = useRef<EventSource | null>(null);
  const soundEnabledRef = useRef(soundEnabled);
  const soundUrlRef = useRef(soundUrl);
  const onNewNotificationRef = useRef(onNewNotification);

  useEffect(() => { soundEnabledRef.current = soundEnabled; }, [soundEnabled]);
  useEffect(() => { soundUrlRef.current = soundUrl; }, [soundUrl]);
  useEffect(() => { onNewNotificationRef.current = onNewNotification; }, [onNewNotification]);

  const buildUrl = useCallback(
    (page: number, pageSize: number) => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (search?.trim()) params.set("search", search.trim());
      if (type) params.set("type", type);
      if (status && status !== "all") params.set("status", status);
      if (sort) params.set("sort", sort);
      return `/notifications?${params.toString()}`;
    },
    [search, type, status, sort],
  );

  const fetchPage = useCallback(
    async (page: number, pageSize: number) => {
      setData((prev) => ({ ...prev, loading: true }));
      try {
        const res = await get<{
          success: boolean;
          data: {
            items: AppNotification[];
            pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
            stats: NotificationStats;
          };
        }>(buildUrl(page, pageSize));
        const { items, pagination, stats } = res.data.data;
        setData({
          items,
          stats,
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
    [get, buildUrl],
  );

  const markRead = useCallback(
    async (id: number) => {
      setData((prev) => {
        const wasUnread = prev.items.some((n) => n.id === id && !n.isRead);
        const delta = wasUnread ? 1 : 0;
        return {
          ...prev,
          items: prev.items.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
          stats: {
            ...prev.stats,
            unread: Math.max(0, prev.stats.unread - delta),
            read: prev.stats.read + delta,
          },
        };
      });
      try {
        await patch(`/notifications/${id}/read`);
      } catch { /* optimistic — ignore */ }
    },
    [patch],
  );

  const markAllRead = useCallback(async () => {
    setData((prev) => ({
      ...prev,
      items: prev.items.map((n) => ({ ...n, isRead: true })),
      stats: { ...prev.stats, unread: 0, read: prev.stats.total },
    }));
    try {
      await patch("/notifications/read-all");
    } catch { /* optimistic — ignore */ }
  }, [patch]);

  const changePage = useCallback(
    (page: number) => fetchPage(page, data.pageSize),
    [fetchPage, data.pageSize],
  );

  const changePageSize = useCallback(
    (pageSize: number) => fetchPage(1, pageSize),
    [fetchPage],
  );

  const refresh = useCallback(
    () => fetchPage(data.page, data.pageSize),
    [fetchPage, data.page, data.pageSize],
  );

  // Initial fetch
  useEffect(() => {
    fetchPage(1, initialPageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fetch when filters change (reset to page 1)
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    fetchPage(1, data.pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, type, status, sort]);

  // SSE subscription
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
          if (soundEnabledRef.current) {
            const audio = new Audio(soundUrlRef.current || "/sound/notification.mp3");
            audio.play().catch(() => { /* autoplay blocked by browser */ });
          }
          onNewNotificationRef.current?.(payload.notification);

          setData((prev) => {
            const newStats = {
              ...prev.stats,
              total: prev.stats.total + 1,
              unread: payload.unreadCount,
            };

            if (!prependOnSSE) {
              return { ...prev, stats: newStats };
            }

            return {
              ...prev,
              items: [payload.notification, ...prev.items],
              stats: newStats,
              totalItems: prev.totalItems + 1,
              totalPages: Math.max(1, Math.ceil((prev.totalItems + 1) / prev.pageSize)),
            };
          });
        }
      } catch { /* malformed event */ }
    };

    return () => {
      es.close();
      esRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prependOnSSE]);

  return {
    ...data,
    unreadCount: data.stats.unread,
    fetchPage,
    markRead,
    markAllRead,
    changePage,
    changePageSize,
    refresh,
  };
}
