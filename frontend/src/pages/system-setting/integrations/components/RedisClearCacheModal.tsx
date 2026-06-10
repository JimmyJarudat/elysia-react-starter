import { Trash2 } from "lucide-react";

type RedisClearCacheModalProps = {
  prefix: string;
  onCancel: () => void;
  onConfirm: () => void;
};

const RedisClearCacheModal = ({ prefix, onCancel, onConfirm }: RedisClearCacheModalProps) => (
  <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
    <div className="w-full max-w-sm rounded-xl border border-theme bg-light-background-card shadow-xl dark:bg-dark-background-card">
      <div className="flex items-center gap-4 p-6 pb-4">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-red-500/10 text-red-600 dark:text-red-400">
          <Trash2 className="h-6 w-6" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-light-text dark:text-dark-text">Force Clear Cache</h3>
          <p className="mt-0.5 text-xs text-light-text-muted dark:text-dark-text-muted">
            ลบเฉพาะ key ที่มี prefix <code className="rounded bg-light-primary/10 px-1 text-light-primary dark:bg-dark-primary/10 dark:text-dark-primary">{prefix}</code>
          </p>
        </div>
      </div>
      <div className="mx-6 mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-800 dark:bg-red-900/20">
        <p className="text-sm text-red-700 dark:text-red-300">
          จะลบ cache ทั้งหมดของแอปนี้ทันที แอปจะ rebuild cache ใหม่เอง แต่อาจช้าลงชั่วคราว
        </p>
      </div>
      <div className="flex gap-3 border-t border-theme px-6 py-4">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-md border border-theme px-4 py-2 text-sm font-semibold text-light-text hover:bg-light-primary/10 dark:text-dark-text dark:hover:bg-dark-primary/10"
        >
          ยกเลิก
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="flex flex-1 items-center justify-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
        >
          <Trash2 className="h-4 w-4" />
          ยืนยัน ลบ cache
        </button>
      </div>
    </div>
  </div>
);

export default RedisClearCacheModal;
