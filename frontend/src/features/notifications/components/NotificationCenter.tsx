import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, Check, CheckCheck, X } from "lucide-react";
import { useNotifications } from "@/features/notifications/hooks/useNotifications";
import { formatTimeDistance } from "@/utils/dateUtils";

const TYPE_COLORS: Record<string, string> = {
  LOGIN: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  SECURITY: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  SYSTEM: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  INFO: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  WARNING: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
};

const TYPE_LABELS: Record<string, string> = {
  LOGIN: "เข้าสู่ระบบ",
  SECURITY: "ความปลอดภัย",
  SYSTEM: "ระบบ",
  INFO: "ข้อมูล",
  WARNING: "คำเตือน",
};

interface NotificationCenterProps {
  className?: string;
}

const NotificationCenter = ({ className = "" }: NotificationCenterProps) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { items, unreadCount, loading, markRead, markAllRead } = useNotifications(10);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  const hasUnread = unreadCount > 0;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Bell button */}
      <button
        type="button"
        aria-label="การแจ้งเตือน"
        onClick={() => setOpen((v) => !v)}
        className="relative grid h-10 w-10 place-items-center rounded-md border-0 bg-transparent text-inherit transition-colors hover:bg-white/10"
      >
        <Bell size={20} />
        {hasUnread && (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-light-primary dark:ring-dark-background-soft">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Popup */}
      {open && (
        <div className="absolute right-0 top-[calc(100%+0.625rem)] z-50 w-[22rem] max-h-[32rem] flex flex-col overflow-hidden rounded-xl border border-theme bg-light-background-card shadow-lg dark:bg-dark-background-card">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-theme px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-light-text dark:text-dark-text">การแจ้งเตือน</span>
              {hasUnread && (
                <span className="rounded-full bg-yellow-400 px-2 py-0.5 text-xs font-bold text-white dark:bg-yellow-500">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {hasUnread && (
                <button
                  type="button"
                  title="อ่านทั้งหมด"
                  onClick={markAllRead}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-light-text-muted transition-colors hover:bg-light-primary/10 hover:text-light-primary dark:text-dark-text-muted dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary"
                >
                  <CheckCheck size={14} />
                  อ่านทั้งหมด
                </button>
              )}
              <button
                type="button"
                aria-label="ปิด"
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-light-text-muted transition-colors hover:bg-light-primary/10 hover:text-light-primary dark:text-dark-text-muted dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {loading && items.length === 0 ? (
              <div className="flex items-center justify-center py-10 text-sm text-light-text-muted dark:text-dark-text-muted">
                กำลังโหลด…
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-10 text-sm text-light-text-muted dark:text-dark-text-muted">
                <Bell size={28} className="opacity-30" />
                ยังไม่มีการแจ้งเตือน
              </div>
            ) : (
              items.map((n) => (
                <div
                  key={n.id}
                  className={`group flex gap-3 border-b border-theme px-4 py-3 transition-colors hover:bg-light-background dark:hover:bg-dark-background ${
                    !n.isRead ? "bg-blue-50/50 dark:bg-blue-950/20" : ""
                  }`}
                >
                  {/* Unread dot */}
                  <div className="mt-1 flex-shrink-0">
                    <span
                      className={`block h-2 w-2 rounded-full ${
                        !n.isRead ? "bg-blue-500" : "bg-transparent"
                      }`}
                    />
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium leading-snug text-light-text dark:text-dark-text line-clamp-1">
                        {n.title}
                      </p>
                      <span
                        className={`flex-shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-none ${
                          TYPE_COLORS[n.type] ?? TYPE_COLORS.INFO
                        }`}
                      >
                        {TYPE_LABELS[n.type] ?? n.type}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-light-text-muted dark:text-dark-text-muted line-clamp-2">
                      {n.message}
                    </p>
                    <p className="mt-1 text-[11px] text-light-text-muted/70 dark:text-dark-text-muted/70">
                      {formatTimeDistance(n.createdAt, new Date(), { addSuffix: true })}
                    </p>
                  </div>

                  {/* Mark read button */}
                  {!n.isRead && (
                    <button
                      type="button"
                      title="ทำเครื่องหมายว่าอ่านแล้ว"
                      onClick={() => markRead(n.id)}
                      className="mt-1 flex-shrink-0 rounded-md p-1 text-light-text-muted opacity-0 transition-all hover:bg-light-primary/10 hover:text-light-primary group-hover:opacity-100 dark:text-dark-text-muted dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary"
                    >
                      <Check size={13} />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-theme px-4 py-2.5">
            <Link
              to="/notifications"
              onClick={() => setOpen(false)}
              className="block text-center text-sm font-medium text-light-primary transition-colors hover:text-light-primary/80 dark:text-dark-primary dark:hover:text-dark-primary/80"
            >
              ดูการแจ้งเตือนทั้งหมด →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;
