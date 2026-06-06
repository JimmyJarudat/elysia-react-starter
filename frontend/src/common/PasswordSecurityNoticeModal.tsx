import { KeyRound, ShieldAlert, X } from "lucide-react";
import { Link } from "react-router-dom";

interface PasswordSecurityNoticeModalProps {
  forced: boolean;
  onClose?: () => void;
}

const PasswordSecurityNoticeModal = ({ forced, onClose }: PasswordSecurityNoticeModalProps) => {
  return (
    <div
      className="fixed inset-0 z-[10000] grid place-items-center bg-black/55 p-4"
      onMouseDown={forced ? undefined : onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="password-security-notice-title"
        className="w-full max-w-md overflow-hidden rounded-lg border border-theme bg-light-background-card shadow-2xl dark:bg-dark-background-card"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-theme p-5">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h2 id="password-security-notice-title" className="font-semibold text-light-text dark:text-dark-text">
                {forced ? "ต้องเปลี่ยนรหัสผ่านก่อนใช้งาน" : "รหัสผ่านของคุณหมดอายุแล้ว"}
              </h2>
              <p className="mt-0.5 text-xs text-light-text-muted dark:text-dark-text-muted">
                {forced
                  ? "บัญชีนี้ถูกกำหนดให้เปลี่ยนรหัสผ่านในการเข้าสู่ระบบครั้งนี้"
                  : "เปลี่ยนรหัสผ่านเพื่อรักษาความปลอดภัยของบัญชี"}
              </p>
            </div>
          </div>
          {!forced && (
            <button
              type="button"
              title="ปิด"
              onClick={onClose}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-light-text-muted transition-colors hover:bg-light-primary/10 hover:text-light-primary dark:text-dark-text-muted dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="p-5">
          <div className="rounded-md border border-theme bg-light-background p-4 text-sm text-light-text dark:bg-dark-background dark:text-dark-text">
            {forced
              ? "คุณจะยังใช้งานส่วนอื่นของระบบไม่ได้ จนกว่าจะเปลี่ยนรหัสผ่านสำเร็จ"
              : "รหัสผ่านเดิมยังใช้งานได้ แต่ควรเปลี่ยนทันทีเพื่อให้เป็นไปตามนโยบายความปลอดภัย"}
          </div>

          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {!forced && (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex justify-center rounded-md border border-theme px-4 py-2 text-sm font-semibold text-light-text transition-colors hover:bg-light-primary/10 dark:text-dark-text dark:hover:bg-dark-primary/10"
              >
                ไว้ภายหลัง
              </button>
            )}
            <Link
              to="/my-security?tab=password"
              className="inline-flex items-center justify-center gap-2 rounded-md bg-light-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-light-primary-hover dark:bg-dark-primary dark:text-dark-background dark:hover:bg-dark-primary-hover"
            >
              <KeyRound className="h-4 w-4" />
              เปลี่ยนรหัสผ่าน
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PasswordSecurityNoticeModal;
