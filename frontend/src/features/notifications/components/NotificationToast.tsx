import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  Info,
  LogIn,
  Settings2,
  ShieldAlert,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { AppNotification } from "@/features/notifications/hooks/useNotifications";
import { formatTimeDistance } from "@/utils/dateUtils";

export interface NotificationToastItem {
  id: string;
  notification: AppNotification;
}

interface NotificationToastProps {
  toasts: NotificationToastItem[];
  onDismiss: (id: string) => void;
}

type TypeConfig = { Icon: LucideIcon; bg: string; text: string; label: string };

const TYPE_CONFIG: Record<string, TypeConfig> = {
  LOGIN:    { Icon: LogIn,         bg: "bg-sky-100 dark:bg-sky-900/40",       text: "text-sky-600 dark:text-sky-400",       label: "เข้าสู่ระบบ"  },
  SECURITY: { Icon: ShieldAlert,   bg: "bg-rose-100 dark:bg-rose-900/40",     text: "text-rose-600 dark:text-rose-400",     label: "ความปลอดภัย" },
  SYSTEM:   { Icon: Settings2,     bg: "bg-violet-100 dark:bg-violet-900/40", text: "text-violet-600 dark:text-violet-400", label: "ระบบ"         },
  INFO:     { Icon: Info,          bg: "bg-slate-100 dark:bg-slate-800",      text: "text-slate-500 dark:text-slate-400",   label: "ข้อมูล"       },
  WARNING:  { Icon: AlertTriangle, bg: "bg-amber-100 dark:bg-amber-900/40",   text: "text-amber-600 dark:text-amber-400",   label: "คำเตือน"      },
};

const FALLBACK: TypeConfig = TYPE_CONFIG.INFO;
const DURATION = 5000;

const ToastCard = ({
  item,
  onDismiss,
}: {
  item: NotificationToastItem;
  onDismiss: (id: string) => void;
}) => {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const dismiss = () => {
    setExiting(true);
    clearTimeout(timerRef.current);
    setTimeout(() => onDismiss(item.id), 280);
  };

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    timerRef.current = setTimeout(dismiss, DURATION);
    return () => clearTimeout(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cfg = TYPE_CONFIG[item.notification.type] ?? FALLBACK;
  const { Icon } = cfg;
  const n = item.notification;

  return (
    <div
      className={`pointer-events-auto relative w-80 overflow-hidden rounded-xl border border-theme bg-light-background-card shadow-[0_8px_30px_rgba(0,0,0,0.15)] transition-all duration-300 dark:bg-dark-background-card dark:shadow-[0_8px_30px_rgba(0,0,0,0.4)] ${
        visible && !exiting
          ? "translate-x-0 opacity-100"
          : "translate-x-10 opacity-0"
      }`}
    >
      {/* Body */}
      <div className="flex gap-3 p-3.5 pr-10">
        <div
          className={`mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${cfg.bg}`}
        >
          <Icon size={16} className={cfg.text} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug text-light-text dark:text-dark-text">
            {n.title}
          </p>
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
      </div>

      {/* Close */}
      <button
        type="button"
        onClick={dismiss}
        aria-label="ปิด"
        className="absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-full text-light-text-muted/50 transition-colors hover:bg-light-background hover:text-light-text dark:text-dark-text-muted/50 dark:hover:bg-dark-background dark:hover:text-dark-text"
      >
        <X size={12} />
      </button>

      {/* Progress bar */}
      <div className="h-0.5 w-full bg-light-background dark:bg-dark-background">
        <div
          className="h-full origin-left bg-light-primary dark:bg-dark-primary"
          style={{
            animation: `toast-progress ${DURATION}ms linear forwards`,
          }}
        />
      </div>
    </div>
  );
};

export const NotificationToast = ({ toasts, onDismiss }: NotificationToastProps) => {
  if (toasts.length === 0) return null;

  return createPortal(
    <div className="pointer-events-none fixed bottom-4 right-4 z-[9999] flex flex-col gap-2">
      {toasts.map((item) => (
        <ToastCard key={item.id} item={item} onDismiss={onDismiss} />
      ))}
    </div>,
    document.body,
  );
};
