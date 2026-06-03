import React from 'react'
import { FiLock, FiUnlock } from 'react-icons/fi'

interface ToggleStatusModalProps {
  isOpen: boolean
  username: string
  currentStatus: boolean
  onClose: () => void
  onConfirm: () => void
  loading?: boolean
}

export const ToggleStatusModal: React.FC<ToggleStatusModalProps> = ({
  isOpen,
  username,
  currentStatus,
  onClose,
  onConfirm,
  loading = false
}) => {
  if (!isOpen) return null

  const isDeactivating = currentStatus

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-background-card rounded-2xl shadow-2xl max-w-md w-full p-6 border border-light-border dark:border-dark-border">
        <div className="flex items-center gap-4 mb-4">
          <div className={`p-3 rounded-full ${isDeactivating 
            ? 'bg-orange-100 dark:bg-orange-900/30' 
            : 'bg-green-100 dark:bg-green-900/30'}`}>
            {isDeactivating 
              ? <FiLock className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              : <FiUnlock className="w-6 h-6 text-green-600 dark:text-green-400" />
            }
          </div>
          <div>
            <h3 className="text-xl font-bold text-light-text dark:text-dark-text">
              {isDeactivating ? 'ปิดการใช้งาน' : 'เปิดการใช้งาน'}
            </h3>
            <p className="text-sm text-light-text-muted dark:text-dark-text-muted">
              {isDeactivating ? 'ผู้ใช้จะไม่สามารถเข้าสู่ระบบได้' : 'ผู้ใช้จะสามารถเข้าสู่ระบบได้'}
            </p>
          </div>
        </div>
        
        <div className={`mb-6 p-4 rounded-xl border ${isDeactivating
          ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
          : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
        }`}>
          <p className="text-sm text-light-text dark:text-dark-text mb-2">
            คุณต้องการ{isDeactivating ? 'ปิดการใช้งาน' : 'เปิดการใช้งาน'}ของผู้ใช้:
          </p>
          <p className={`text-base font-bold ${isDeactivating
            ? 'text-orange-700 dark:text-orange-400'
            : 'text-green-700 dark:text-green-400'
          }`}>
            {username}
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-light-text dark:text-dark-text rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ยกเลิก
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 px-4 py-3 text-white rounded-xl font-semibold transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center ${isDeactivating
              ? 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 shadow-orange-500/30'
              : 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 shadow-green-500/30'
            }`}
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                กำลังดำเนินการ...
              </>
            ) : (
              isDeactivating ? 'ปิดการใช้งาน' : 'เปิดการใช้งาน'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}