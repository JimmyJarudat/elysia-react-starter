import { createPortal } from "react-dom";
import { useState } from "react";
import { AlertTriangle, ArrowRightLeft, RefreshCw, X } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { toast } from "react-toastify";

export interface ModalImpersonateProps {
  userId: number;
  username: string;
  avatarUrl?: string | null;
  onClose: () => void;
}

const ModalImpersonate = ({ userId, username, avatarUrl, onClose }: ModalImpersonateProps) => {
  const { post } = useApi();
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await post(`/auth/impersonate/${userId}`, {});
      toast.success(`สลับบัญชีเป็น "${username}" แล้ว`);
      window.location.href = "/dashboard";
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "ไม่สามารถสลับบัญชีได้");
      setLoading(false);
    }
  };

  const initials = username.charAt(0).toUpperCase();

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => !loading && e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-sm rounded-xl border border-theme bg-light-background-card shadow-xl dark:bg-dark-background-card">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-theme px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-light-primary/10 text-light-primary dark:bg-dark-primary/10 dark:text-dark-primary">
              <ArrowRightLeft className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-light-text dark:text-dark-text">Impersonate User</h2>
              <p className="text-xs text-light-text-muted dark:text-dark-text-muted">สลับบัญชีชั่วคราว</p>
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={loading}
            className="grid h-8 w-8 place-items-center rounded-md text-light-text-muted transition-colors hover:bg-light-primary/10 hover:text-light-primary disabled:opacity-50 dark:text-dark-text-muted dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 p-5">
          {/* Warning */}
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-900/20">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="text-xs text-amber-700 dark:text-amber-300">
              คุณจะเข้าสู่ระบบในนามของผู้ใช้นี้ และสามารถเข้าถึงข้อมูลทั้งหมดของบัญชีนี้
            </p>
          </div>

          {/* User card */}
          <div className="flex items-center gap-4 rounded-lg border border-theme bg-light-background px-4 py-3 dark:bg-dark-background">
            {avatarUrl ? (
              <img src={avatarUrl} alt={username}
                className="h-12 w-12 rounded-full object-cover ring-2 ring-light-primary/20 dark:ring-dark-primary/20" />
            ) : (
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-light-primary text-lg font-bold text-white dark:bg-dark-primary dark:text-dark-background">
                {initials}
              </div>
            )}
            <div className="min-w-0">
              <p className="font-semibold text-light-text dark:text-dark-text">{username}</p>
              <p className="text-xs text-light-text-muted dark:text-dark-text-muted">ID: {userId}</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 border-t border-theme px-5 py-4">
          <button type="button" onClick={onClose} disabled={loading}
            className="flex-1 rounded-md border border-theme px-4 py-2 text-sm font-semibold text-light-text transition-colors hover:bg-light-primary/10 disabled:opacity-50 dark:text-dark-text dark:hover:bg-dark-primary/10">
            ยกเลิก
          </button>
          <button type="button" onClick={() => void handleConfirm()} disabled={loading}
            className="flex flex-1 items-center justify-center gap-2 rounded-md bg-light-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-light-primary-hover disabled:opacity-60 dark:bg-dark-primary dark:text-dark-background dark:hover:bg-dark-primary-hover">
            {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />}
            ยืนยันการสลับ
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default ModalImpersonate;
