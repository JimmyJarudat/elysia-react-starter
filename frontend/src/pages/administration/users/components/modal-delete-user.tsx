import { createPortal } from "react-dom";
import { RefreshCw, Trash2 } from "lucide-react";

interface ModalDeleteUserProps {
  username: string;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
}

const ModalDeleteUser = ({
  username,
  onClose,
  onConfirm,
  loading = false,
}: ModalDeleteUserProps) => {
  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => !loading && e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-sm rounded-xl border border-theme bg-light-background-card shadow-xl dark:bg-dark-background-card">

        {/* Header */}
        <div className="flex items-center gap-4 p-6 pb-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-red-500/10 text-red-600 dark:text-red-400">
            <Trash2 className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-light-text dark:text-dark-text">ยืนยันการลบ</h3>
            <p className="mt-0.5 text-xs text-light-text-muted dark:text-dark-text-muted">
              การดำเนินการนี้ไม่สามารถย้อนกลับได้
            </p>
          </div>
        </div>

        {/* Info box */}
        <div className="mx-6 mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-800 dark:bg-red-900/20">
          <p className="text-sm text-light-text-muted dark:text-dark-text-muted">
            คุณต้องการลบผู้ใช้งาน:
          </p>
          <p className="mt-1 text-base font-bold text-red-700 dark:text-red-400">
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
            className="flex flex-1 items-center justify-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading && <RefreshCw className="h-4 w-4 animate-spin" />}
            ลบผู้ใช้งาน
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default ModalDeleteUser;
