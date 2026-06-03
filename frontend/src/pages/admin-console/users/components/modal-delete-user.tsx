import React from 'react'
import { FiTrash2 } from 'react-icons/fi'

interface DeleteUserModalProps {
  isOpen: boolean
  username: string
  onClose: () => void
  onConfirm: () => void
  loading?: boolean
}

export const DeleteUserModal: React.FC<DeleteUserModalProps> = ({
  isOpen,
  username,
  onClose,
  onConfirm,
  loading = false
}) => {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-background-card rounded-2xl shadow-2xl max-w-md w-full p-6 border border-light-border dark:border-dark-border">
        <div className="flex items-center gap-4 mb-4">
          <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full">
            <FiTrash2 className="w-6 h-6 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-light-text dark:text-dark-text">ยืนยันการลบ</h3>
            <p className="text-sm text-light-text-muted dark:text-dark-text-muted">การดำเนินการนี้ไม่สามารถย้อนกลับได้</p>
          </div>
        </div>
        
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
          <p className="text-sm text-light-text dark:text-dark-text mb-2">
            คุณต้องการลบผู้ใช้งาน:
          </p>
          <p className="text-base font-bold text-red-700 dark:text-red-400">
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
            className="flex-1 px-4 py-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl font-semibold transition-all shadow-lg shadow-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                กำลังลบ...
              </>
            ) : (
              'ลบผู้ใช้งาน'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}