import { useEffect, useState } from "react";
import { AlertTriangle, LogIn } from "lucide-react";

const LOGIN_PATH = "/login";
const SESSION_EXPIRED_EVENT = "session:expired";

type SessionExpiredEvent = CustomEvent<{ message?: string }>;

const SessionExpiredModal = () => {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const handleSessionExpired = (event: Event) => {
      const detail = (event as SessionExpiredEvent).detail;
      setMessage(detail?.message || "Session expired, please log in again");
    };

    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
  }, []);

  if (!message) {
    return null;
  }

  const handleConfirm = () => {
    window.dispatchEvent(new Event("session:changed"));
    window.location.replace(LOGIN_PATH);
  };

  return (
    <div className="fixed inset-0 z-[10000] grid place-items-center bg-black/50 p-4">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="session-expired-title"
        aria-describedby="session-expired-description"
        className="w-full max-w-md overflow-hidden rounded-lg border border-theme bg-light-background-card shadow-xl dark:bg-dark-background-card"
      >
        <div className="flex items-start gap-3 border-b border-theme px-5 py-4">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 id="session-expired-title" className="text-base font-semibold text-light-text dark:text-dark-text">
              Session หมดอายุ
            </h2>
            <p id="session-expired-description" className="mt-1 text-sm text-light-text-muted dark:text-dark-text-muted">
              {message}
            </p>
          </div>
        </div>

        <div className="px-5 py-4">
          <p className="text-sm text-light-text-muted dark:text-dark-text-muted">
            กรุณาเข้าสู่ระบบใหม่เพื่อใช้งานต่อ
          </p>
        </div>

        <div className="flex justify-end border-t border-theme px-5 py-4">
          <button
            type="button"
            onClick={handleConfirm}
            className="inline-flex items-center gap-2 rounded-md bg-light-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-light-primary-hover dark:bg-dark-primary dark:text-dark-background dark:hover:bg-dark-primary-hover"
            autoFocus
          >
            <LogIn className="h-4 w-4" />
            ตกลง
          </button>
        </div>
      </div>
    </div>
  );
};

export default SessionExpiredModal;
