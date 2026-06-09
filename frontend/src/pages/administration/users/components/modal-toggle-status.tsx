import { createPortal } from "react-dom";
import { Lock, LockOpen, RefreshCw } from "lucide-react";

interface ModalToggleStatusProps {
  username: string;
  isActive: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
}

const ModalToggleStatus = ({
  username,
  isActive,
  onClose,
  onConfirm,
  loading = false,
}: ModalToggleStatusProps) => {
  const deactivating = isActive;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => !loading && e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-sm rounded-xl border border-theme bg-light-background-card shadow-xl dark:bg-dark-background-card">

        {/* Header */}
        <div className="flex items-center gap-4 p-6 pb-4">
          <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-full ${
            deactivating
              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
              : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          }`}>
            {deactivating
              ? <Lock className="h-6 w-6" />
              : <LockOpen className="h-6 w-6" />}
          </div>
          <div>
            <h3 className="text-base font-semibold text-light-text dark:text-dark-text">
              {deactivating ? "ระงับบัญชี" : "เปิดใช้งานบัญชี"}
            </h3>
            <p className="mt-0.5 text-xs text-light-text-muted dark:text-dark-text-muted">
              {deactivating
                ? "ผู้ใช้จะไม่สามารถเข้าสู่ระบบได้"
                : "ผู้ใช้จะสามารถเข้าสู่ระบบได้อีกครั้ง"}
            </p>
          </div>
        </div>

        {/* Info box */}
        <div className={`mx-6 mb-5 rounded-lg border px-4 py-3 ${
          deactivating
            ? "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20"
            : "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20"
        }`}>
          <p className="text-sm text-light-text-muted dark:text-dark-text-muted">
            คุณต้องการ{deactivating ? "ระงับ" : "เปิดใช้งาน"}บัญชีของ:
          </p>
          <p className={`mt-1 text-base font-bold ${
            deactivating
              ? "text-amber-700 dark:text-amber-400"
              : "text-emerald-700 dark:text-emerald-400"
          }`}>
            {username}
          </p>
        </div>

        {/* Buttons */}
        <div className="flex gap-3 border-t border-theme px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 rounded-md border border-theme px-4 py-2 text-sm font-semibold text-light-text transition-colors hover:bg-light-primary/10 disabled:cursor-not-allowed disabled:opacity-50 dark:text-dark-text dark:hover:bg-dark-primary/10"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
              deactivating
                ? "bg-amber-500 hover:bg-amber-600"
                : "bg-emerald-600 hover:bg-emerald-700"
            }`}
          >
            {loading && <RefreshCw className="h-4 w-4 animate-spin" />}
            {deactivating ? "ระงับบัญชี" : "เปิดใช้งาน"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default ModalToggleStatus;
