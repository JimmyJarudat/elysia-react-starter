import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Bell,
  Check,
  CheckCheck,
  ChevronRight,
  Info,
  LogIn,
  Settings2,
  ShieldAlert,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useNotifications } from "@/features/notifications/hooks/useNotifications";
import type { AppNotification } from "@/features/notifications/hooks/useNotifications";
import { NotificationToast } from "@/features/notifications/components/NotificationToast";
import type { NotificationToastItem } from "@/features/notifications/components/NotificationToast";
import { useApi } from "@/hooks/useApi";
import { apiConfig } from "@/config";
import { formatTimeDistance } from "@/utils/dateUtils";

const backendOrigin = (() => {
  try { return new URL(apiConfig.backendBaseUrl, window.location.origin).origin; }
  catch { return window.location.origin; }
})();

const resolveBackendUrl = (path: string) => {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  return `${backendOrigin}${path.startsWith("/") ? path : `/${path}`}`;
};

type TypeConfig = { Icon: LucideIcon; bg: string; text: string; label: string };

const TYPE_CONFIG: Record<string, TypeConfig> = {
  LOGIN:    { Icon: LogIn,         bg: "bg-sky-100 dark:bg-sky-900/40",       text: "text-sky-600 dark:text-sky-400",       label: "เข้าสู่ระบบ"  },
  SECURITY: { Icon: ShieldAlert,   bg: "bg-rose-100 dark:bg-rose-900/40",     text: "text-rose-600 dark:text-rose-400",     label: "ความปลอดภัย" },
  SYSTEM:   { Icon: Settings2,     bg: "bg-violet-100 dark:bg-violet-900/40", text: "text-violet-600 dark:text-violet-400", label: "ระบบ"         },
  INFO:     { Icon: Info,          bg: "bg-slate-100 dark:bg-slate-800",      text: "text-slate-500 dark:text-slate-400",   label: "ข้อมูล"       },
  WARNING:  { Icon: AlertTriangle, bg: "bg-amber-100 dark:bg-amber-900/40",   text: "text-amber-600 dark:text-amber-400",   label: "คำเตือน"      },
};

const FALLBACK: TypeConfig = TYPE_CONFIG.INFO;

const PRIORITY_RING: Record<string, string> = {
  CRITICAL: "ring-2 ring-rose-400 dark:ring-rose-500",
  HIGH:     "ring-2 ring-orange-400 dark:ring-orange-500",
};

interface NotificationCenterProps {
  className?: string;
}

const NotificationCenter = ({ className = "" }: NotificationCenterProps) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { get } = useApi();

  const [soundEnabled, setSoundEnabled] = useState(false);
  const [soundUrl, setSoundUrl] = useState<string | undefined>(undefined);
  const [toasts, setToasts] = useState<NotificationToastItem[]>([]);

  const handleNewNotification = useCallback((n: AppNotification) => {
    const id = `${n.id}-${Date.now()}`;
    setToasts((prev) => [...prev, { id, notification: n }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [notifRes, soundRes] = await Promise.all([
          get<{ success: boolean; data: { soundNotifications: boolean } }>("/account-security/notifications"),
          get<{ success: boolean; data: { soundUrl: string } }>("/system-setting/notification-sound"),
        ]);
        if (!active) return;
        if (notifRes.data.success) setSoundEnabled(notifRes.data.data.soundNotifications);
        if (soundRes.data.success) {
          const raw = soundRes.data.data.soundUrl;
          setSoundUrl(raw ? resolveBackendUrl(raw) : undefined);
        }
      } catch { /* non-critical */ }
    };

    void load();

    const onChanged = () => { void load(); };
    window.addEventListener("notification-sound-settings-changed", onChanged);

    return () => {
      active = false;
      window.removeEventListener("notification-sound-settings-changed", onChanged);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { items, unreadCount, loading, markRead, markAllRead } = useNotifications({
    pageSize: 10,
    soundEnabled,
    soundUrl,
    onNewNotification: handleNewNotification,
  });

  useEffect(() => {
    if (!open) return;
    const handler = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [open]);

  const hasUnread = unreadCount > 0;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <NotificationToast toasts={toasts} onDismiss={dismissToast} />
      {/* Bell trigger */}
      <button
        type="button"
        aria-label="การแจ้งเตือน"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`relative grid h-10 w-10 place-items-center rounded-md border-0 text-inherit transition-colors hover:bg-white/10 ${open ? "bg-white/10" : "bg-transparent"}`}
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
        <div className="absolute right-0 top-[calc(100%+0.75rem)] z-50 flex w-[23rem] flex-col overflow-hidden rounded-xl border border-theme bg-light-background-card shadow-[0_8px_30px_rgba(0,0,0,0.12)] dark:bg-dark-background-card dark:shadow-[0_8px_30px_rgba(0,0,0,0.4)]">

          {/* Caret arrow */}
          <div className="absolute -top-[9px] right-[14px] h-4 w-4 rotate-45 border-l border-t border-theme bg-light-background-card dark:bg-dark-background-card" />

          {/* Header */}
          <div className="border-b border-theme bg-gradient-to-br from-light-primary/5 to-transparent px-4 pb-3 pt-4 dark:from-dark-primary/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-light-primary/15 dark:bg-dark-primary/20">
                  <Bell size={15} className="text-light-primary dark:text-dark-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold leading-none text-light-text dark:text-dark-text">
                    การแจ้งเตือน
                  </p>
                  <p className="mt-0.5 text-[11px] text-light-text-muted dark:text-dark-text-muted">
                    {hasUnread ? (
                      <>ยังไม่อ่าน <span className="font-semibold text-red-500">{unreadCount}</span> รายการ</>
                    ) : (
                      "อ่านทั้งหมดแล้ว"
                    )}
                  </p>
                </div>
              </div>

              {hasUnread && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-light-text-muted transition-colors hover:bg-light-primary/10 hover:text-light-primary dark:text-dark-text-muted dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary"
                >
                  <CheckCheck size={13} />
                  อ่านทั้งหมด
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="max-h-[24rem] flex-1 overflow-y-auto">
            {loading && items.length === 0 ? (
              /* Skeleton */
              <div className="py-1">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex gap-3 px-4 py-3.5">
                    <div className="h-9 w-9 flex-shrink-0 animate-pulse rounded-full bg-light-background dark:bg-dark-background" />
                    <div className="min-w-0 flex-1 space-y-2 pt-1">
                      <div className="h-3 w-2/3 animate-pulse rounded-full bg-light-background dark:bg-dark-background" />
                      <div className="h-2.5 w-full animate-pulse rounded-full bg-light-background dark:bg-dark-background" />
                      <div className="h-2 w-1/4 animate-pulse rounded-full bg-light-background dark:bg-dark-background" />
                    </div>
                  </div>
                ))}
              </div>
            ) : items.length === 0 ? (
              /* Empty state */
              <div className="flex flex-col items-center justify-center gap-3 py-14">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-light-primary/8 dark:bg-dark-primary/10">
                  <Bell size={26} className="text-light-primary/40 dark:text-dark-primary/40" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-light-text/70 dark:text-dark-text/70">
                    ไม่มีการแจ้งเตือน
                  </p>
                  <p className="mt-0.5 text-xs text-light-text-muted dark:text-dark-text-muted">
                    เมื่อมีเหตุการณ์สำคัญจะแจ้งเตือนที่นี่
                  </p>
                </div>
              </div>
            ) : (
              /* Notification items */
              items.map((n) => {
                const cfg = TYPE_CONFIG[n.type] ?? FALLBACK;
                const { Icon } = cfg;
                const priorityRing = PRIORITY_RING[n.priority] ?? "";

                return (
                  <div
                    key={n.id}
                    className={`group relative flex gap-3 border-b border-theme/60 px-4 py-3.5 transition-colors last:border-0 hover:bg-light-background dark:hover:bg-dark-background ${
                      !n.isRead
                        ? "border-l-4 border-l-red-500 bg-red-50/80 dark:border-l-red-400 dark:bg-red-950/20"
                        : "border-l-2 border-l-transparent"
                    }`}
                  >
                    {/* Type icon */}
                    <div
                      className={`mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${cfg.bg} ${priorityRing}`}
                    >
                      <Icon size={16} className={cfg.text} />
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1 pr-6">
                      <div className="flex min-w-0 items-start gap-2">
                        {!n.isRead && (
                          <span
                            aria-label="ยังไม่อ่าน"
                            className="mt-1.5 h-2.5 w-2.5 flex-shrink-0 rounded-full bg-red-500 ring-2 ring-red-100 dark:bg-red-400 dark:ring-red-900/60"
                          />
                        )}
                        <p
                          className={`min-w-0 text-sm leading-snug ${
                            !n.isRead
                              ? "font-semibold text-light-text dark:text-dark-text"
                              : "font-medium text-light-text/85 dark:text-dark-text/85"
                          }`}
                        >
                          {n.title}
                        </p>
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-light-text-muted dark:text-dark-text-muted">
                        {n.message}
                      </p>
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <span className="text-[11px] text-light-text-muted/60 dark:text-dark-text-muted/60">
                          {formatTimeDistance(n.createdAt, new Date(), { addSuffix: true })}
                        </span>
                        <span className="text-[10px] text-light-text-muted/30 dark:text-dark-text-muted/30">·</span>
                        <span className={`text-[11px] font-medium ${cfg.text}`}>{cfg.label}</span>
                      </div>
                    </div>

                    {/* Mark read button */}
                    {!n.isRead && (
                      <button
                        type="button"
                        title="ทำเครื่องหมายว่าอ่านแล้ว"
                        onClick={() => markRead(n.id)}
                        className="absolute right-3 top-3.5 flex h-6 w-6 items-center justify-center rounded-full text-light-text-muted/50 opacity-0 transition-all hover:bg-light-primary/15 hover:text-light-primary group-hover:opacity-100 dark:text-dark-text-muted/50 dark:hover:bg-dark-primary/15 dark:hover:text-dark-primary"
                      >
                        <Check size={12} />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-theme">
            <Link
              to="/notifications"
              onClick={() => setOpen(false)}
              className="flex items-center justify-center gap-1.5 px-4 py-3 text-sm font-medium text-light-primary transition-colors hover:bg-light-primary/5 dark:text-dark-primary dark:hover:bg-dark-primary/5"
            >
              ดูการแจ้งเตือนทั้งหมด
              <ChevronRight size={14} />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;
