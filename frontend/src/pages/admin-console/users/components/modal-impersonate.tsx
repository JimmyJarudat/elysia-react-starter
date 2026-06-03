import { useState } from 'react';
import { User, ArrowRightLeft, AlertTriangle, X, Shield } from 'lucide-react';
import { useApi } from '@/hooks/useApi';

interface ImpersonateModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: number;
  username: string;
  avatarUrl: string;
}

export const ImpersonateModal = ({ isOpen, onClose, userId, username, avatarUrl }: ImpersonateModalProps) => {
  const api = useApi();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  console.log(avatarUrl)

  const handleConfirm = async () => {
    setIsLoading(true);
    setError('');

    try {
      const response = await api.post('/api/auth/admin/impersonate',
        { user_id: userId },
        { withCredentials: true }
      );

      if (response.data.success) {
        onClose();
        window.location.href = '/home';
      } else {
        setError(response.data.message || 'Impersonation failed');
      }
    } catch (err: any) {
      console.error('Impersonate error:', err);
      setError(err.response?.data?.message || err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div
        className="absolute inset-0 bg-slate-blue-900/60 dark:bg-slate-blue-950/80 backdrop-blur-md"
        onClick={onClose}
      />

      <div className="relative bg-white dark:bg-dark-background-card rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300 border border-light-border dark:border-dark-border">

        {/* Header */}
        <div className="relative px-6 pt-6 pb-5 border-b border-light-border dark:border-dark-border">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="absolute right-4 top-4 p-2 text-light-text-muted hover:text-light-text hover:bg-ocean-50 dark:text-dark-text-muted dark:hover:text-dark-text dark:hover:bg-slate-blue-800 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-start gap-4">
            <div className="relative">
              <div className="p-3.5 bg-gradient-to-br from-ocean-500 to-ocean-600 dark:from-ocean-400 dark:to-ocean-500 rounded-2xl shadow-lg shadow-ocean-500/20 dark:shadow-ocean-400/20">
                <ArrowRightLeft className="w-6 h-6 text-white" />
              </div>
              <div className="absolute -bottom-1 -right-1 p-1 bg-white dark:bg-dark-background-card rounded-full shadow-md border border-light-border dark:border-dark-border">
                <Shield className="w-3.5 h-3.5 text-ocean-600 dark:text-ocean-400" />
              </div>
            </div>

            <div className="flex-1 pt-1">
              <h2 className="text-2xl font-bold text-light-text dark:text-dark-text mb-1">Impersonate User</h2>
              <p className="text-sm text-light-text-muted dark:text-dark-text-muted">Switch account temporarily</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 pb-6 space-y-5 mt-4">
          {/* Warning Alert */}
          <div className="relative overflow-hidden p-4 bg-gradient-to-r from-warning/10 to-warning/5 dark:from-warning/20 dark:to-warning/10 border border-warning/30 dark:border-warning/40 rounded-2xl">
            <div className="absolute top-0 right-0 w-32 h-32 bg-warning/10 dark:bg-warning/5 rounded-full -mr-16 -mt-16" />
            <div className="relative flex gap-3">
              <div className="flex-shrink-0 mt-0.5">
                <div className="p-2 bg-warning/20 dark:bg-warning/30 rounded-xl">
                  <AlertTriangle className="w-5 h-5 text-warning dark:text-amber-400" />
                </div>
              </div>
              <div className="flex-1">
                <p className="font-semibold text-amber-900 dark:text-amber-200 mb-1">คำเตือนสำคัญ</p>
                <p className="text-sm text-amber-800 dark:text-amber-300 leading-relaxed">
                  คุณจะเข้าสู่ระบบในนามของผู้ใช้นี้ และสามารถเข้าถึงข้อมูลทั้งหมดของบัญชีนี้
                </p>
              </div>
            </div>
          </div>

          {/* User Card */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-light-text-muted dark:text-dark-text-muted px-1">กำลังจะสลับไปยังบัญชี:</p>
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-ocean-500 to-ocean-600 dark:from-ocean-400 dark:to-ocean-500 rounded-2xl opacity-0 group-hover:opacity-100 blur transition-opacity duration-300" />
              <div className="flex items-center gap-4">
                <div className="relative">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={username}
                      className="h-14 w-14 rounded-2xl object-cover shadow-lg ring-4 ring-ocean-100 dark:ring-ocean-900/50"
                    />
                  ) : (
                    <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-ocean-500 to-ocean-600 dark:from-ocean-400 dark:to-ocean-500 flex items-center justify-center shadow-lg ring-4 ring-ocean-100 dark:ring-ocean-900/50">
                      <span className="text-white font-bold text-xl">
                        {username.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="absolute -bottom-1 -right-1 h-5 w-5 bg-success border-2 border-white dark:border-dark-background-card rounded-full" />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-bold text-lg text-light-text dark:text-dark-text truncate">{username}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <User className="w-3.5 h-3.5 text-light-text-light dark:text-dark-text-light" />
                    <p className="text-sm text-light-text-muted dark:text-dark-text-muted">User ID: {userId}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-4 bg-error/10 dark:bg-error/20 border-l-4 border-error rounded-xl animate-in slide-in-from-top-2 duration-300">
              <p className="text-sm text-red-800 dark:text-red-200 font-medium">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 pt-2 flex gap-3 border-t border-light-border-light dark:border-dark-border-light">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 px-5 py-3.5 rounded-xl bg-light-background-soft hover:bg-slate-blue-100 dark:bg-dark-background-soft dark:hover:bg-slate-blue-700 text-light-text dark:text-dark-text font-semibold active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed border border-light-border dark:border-dark-border"
          >
            ยกเลิก
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading}
            className="flex-1 px-5 py-3.5 rounded-xl bg-gradient-to-r from-ocean-500 to-ocean-600 hover:from-ocean-600 hover:to-ocean-700 dark:from-ocean-400 dark:to-ocean-500 dark:hover:from-ocean-500 dark:hover:to-ocean-600 text-white font-semibold active:scale-95 transition-all duration-200 shadow-lg shadow-ocean-500/30 dark:shadow-ocean-400/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>กำลังดำเนินการ...</span>
              </>
            ) : (
              <>
                <ArrowRightLeft className="w-4 h-4" />
                <span>ยืนยันการสลับ</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};