import { Link } from "react-router-dom";
import { MailWarning, ShieldCheck, X } from "lucide-react";

interface EmailVerificationReminderModalProps {
  email: string;
  onClose: () => void;
}

const EmailVerificationReminderModal = ({ email, onClose }: EmailVerificationReminderModalProps) => {
  return (
    <div className="fixed inset-0 z-[10000] grid place-items-center bg-black/50 p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="email-verification-reminder-title"
        className="w-full max-w-md overflow-hidden rounded-lg border border-theme bg-light-background-card shadow-2xl dark:bg-dark-background-card"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-theme p-5">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <MailWarning className="h-5 w-5" />
            </div>
            <div>
              <h2 id="email-verification-reminder-title" className="font-semibold text-light-text dark:text-dark-text">
                กรุณายืนยันอีเมลของคุณ
              </h2>
              <p className="mt-0.5 text-xs text-light-text-muted dark:text-dark-text-muted">
                เพื่อให้บัญชีพร้อมสำหรับการแจ้งเตือนและการกู้คืน
              </p>
            </div>
          </div>
          <button
            type="button"
            title="ปิด"
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-light-text-muted transition-colors hover:bg-light-primary/10 hover:text-light-primary dark:text-dark-text-muted dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5">
          <div className="rounded-md border border-theme bg-light-background p-4 dark:bg-dark-background">
            <p className="text-xs font-semibold text-light-text-muted dark:text-dark-text-muted">อีเมลหลักของบัญชี</p>
            <p className="mt-1 truncate text-sm font-semibold text-light-text dark:text-dark-text">{email}</p>
          </div>

          <div className="mt-4 flex items-start gap-2 text-xs text-light-text-muted dark:text-dark-text-muted">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-light-primary dark:text-dark-primary" />
            <p>ระบบจะส่งรหัสยืนยัน 6 หลักไปยังอีเมลนี้ รหัสมีอายุ 10 นาที</p>
          </div>

          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex justify-center rounded-md border border-theme px-4 py-2 text-sm font-semibold text-light-text transition-colors hover:bg-light-primary/10 dark:text-dark-text dark:hover:bg-dark-primary/10"
            >
              ไว้ภายหลัง
            </button>
            <Link
              to="/my-security?tab=recovery&modal=email-verification&emailAction=PRIMARY_VERIFY"
              onClick={onClose}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-light-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-light-primary-hover dark:bg-dark-primary dark:text-dark-background dark:hover:bg-dark-primary-hover"
            >
              <MailWarning className="h-4 w-4" />
              ไปยืนยันอีเมล
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailVerificationReminderModal;
