import React, { useState, useEffect } from 'react'
import { FiShield, FiX, FiCheck, FiPlus, FiTrash2 } from 'react-icons/fi'
import { useApi } from '@/hooks/useApi'
import { toast } from 'react-toastify'

interface AvailableRole {
  id: string
  name: string
  priority?: number
  description?: string
}

interface UserRole {
  role_id: string
  role_name: string
  role_description: string | null
  priority: number
  assigned_at: string
  assigned_by: string | null
}

interface ManageRolesModalProps {
  isOpen: boolean
  userId: number
  username: string
  onClose: () => void
  onSuccess: () => void
  availableRoles: AvailableRole[]
}

export const ManageRolesModal: React.FC<ManageRolesModalProps> = ({
  isOpen,
  userId,
  username,
  onClose,
  onSuccess,
  availableRoles
}) => {
  const api = useApi()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [userRoles, setUserRoles] = useState<UserRole[]>([])
  const [selectedRoles, setSelectedRoles] = useState<string[]>([])
  const [showAddRole, setShowAddRole] = useState(false)

  // Debug: ดู props ที่ได้รับ
  useEffect(() => {
    console.log('Modal Props:', { isOpen, userId, username })
  }, [isOpen, userId, username])

  useEffect(() => {
    if (isOpen && userId) {
      fetchUserRoles()
    } else if (isOpen && !userId) {
      console.error('Modal opened without userId!')
    }
  }, [isOpen, userId])

  const fetchUserRoles = async () => {
    try {
      setLoading(true)
      const response = await api.get(`/api/user/roles/${userId}`)
      console.log('User roles response:', response) // Debug
      
      if (response.data?.success && response.data?.data) {
        setUserRoles(response.data.data)
        setSelectedRoles(response.data.data.map((r: UserRole) => r.role_id))
      } else {
        console.error('Invalid response format:', response)
        toast.error('ไม่สามารถโหลดข้อมูล roles ได้')
      }
    } catch (error: any) {
      console.error('Error fetching user roles:', error)
      console.error('Error details:', error.response?.data)
      const errorMessage = error.response?.data?.message || error.message || 'Failed to fetch user roles'
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleToggleRole = (roleId: string) => {
    console.log('Toggle role:', roleId, 'Current:', selectedRoles) // Debug
    
    setSelectedRoles(prev => {
      if (prev.includes(roleId)) {
        // ต้องมีอย่างน้อย 1 role
        if (prev.length <= 1) {
          toast.warning('ผู้ใช้ต้องมีอย่างน้อย 1 role')
          return prev
        }
        return prev.filter(id => id !== roleId)
      } else {
        return [...prev, roleId]
      }
    })
  }

  const handleSave = async () => {
    try {
      console.log('Saving roles:', { userId, roleIds: selectedRoles }) // Debug
      setSaving(true)
      
      const response = await api.put('/api/user/roles/update', {
        userId,
        roleIds: selectedRoles
      })
      
      console.log('Save response:', response) // Debug
      
      if (response.data?.success) {
        toast.success('อัพเดท roles สำเร็จ! 🎉')
        onSuccess()
        onClose()
      } else {
        toast.error('ไม่สามารถอัพเดท roles ได้')
      }
    } catch (error: any) {
      console.error('Error updating roles:', error)
      console.error('Error details:', error.response?.data)
      const errorMessage = error.response?.data?.message || error.message || 'Failed to update roles'
      toast.error(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  const getRoleBadgeColor = (priority?: number) => {
    if (!priority) return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/30 dark:text-gray-300 dark:border-gray-800'
    
    switch (priority) {
      case 1: return 'bg-red-600 text-white border-red-700'
      case 2: return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800'
      case 3: return 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800'
      case 4: return 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800'
      case 5: return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800'
      case 6: return 'bg-ocean-100 text-ocean-800 border-ocean-200 dark:bg-ocean-900/30 dark:text-ocean-300 dark:border-ocean-800'
      case 7: return 'bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-300 dark:border-cyan-800'
      case 8: return 'bg-slate-blue-100 text-slate-blue-800 border-slate-blue-200 dark:bg-slate-blue-900/30 dark:text-slate-blue-300 dark:border-slate-blue-800'
      case 9: return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/30 dark:text-gray-300 dark:border-gray-800'
      case 10: return 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-900/30 dark:text-slate-300 dark:border-slate-800'
      default: return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/30 dark:text-gray-300 dark:border-gray-800'
    }
  }

  if (!isOpen) return null

  const availableToAdd = availableRoles.filter(r => !selectedRoles.includes(r.id))

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-background-card rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col border border-light-border dark:border-dark-border">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-light-border dark:border-dark-border">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
              <FiShield className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-light-text dark:text-dark-text">จัดการ Roles</h3>
              <p className="text-sm text-light-text-muted dark:text-dark-text-muted">
                ผู้ใช้: <span className="font-semibold">{username}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <FiX className="w-5 h-5 text-light-text dark:text-dark-text" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-ocean-200 dark:border-ocean-800 border-t-ocean-600 dark:border-t-ocean-400 rounded-full animate-spin"></div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Current Roles */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-bold text-light-text dark:text-dark-text uppercase">
                    Roles ปัจจุบัน ({selectedRoles.length})
                  </h4>
                  <button
                    onClick={() => setShowAddRole(!showAddRole)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-purple-100 hover:bg-purple-200 dark:bg-purple-900/30 dark:hover:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded-lg text-sm font-semibold transition-colors"
                  >
                    <FiPlus className="w-4 h-4" />
                    เพิ่ม Role
                  </button>
                </div>

                <div className="space-y-2">
                  {selectedRoles.map((roleId) => {
                    // หา role จาก userRoles ก่อน ถ้าไม่มีให้หาจาก availableRoles
                    const userRole = userRoles.find(ur => ur.role_id === roleId)
                    const availableRole = availableRoles.find(r => r.id === roleId)
                    
                    if (!userRole && !availableRole) return null
                    
                    const roleName = userRole?.role_name || availableRole?.name || roleId
                    const roleDescription = userRole?.role_description || availableRole?.description || null
                    const priority = userRole?.priority || availableRole?.priority || 0
                    const isNew = !userRole // role ที่เพิ่มใหม่
                    
                    return (
                      <div
                        key={roleId}
                        className={`flex items-center justify-between p-4 rounded-xl border ${
                          isNew 
                            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' 
                            : 'bg-light-background-soft dark:bg-dark-background-soft border-light-border dark:border-dark-border'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`px-3 py-1.5 text-sm font-bold rounded-lg border ${getRoleBadgeColor(priority)}`}>
                            {roleName}
                          </span>
                          {isNew && (
                            <span className="px-2 py-1 bg-green-500 text-white text-xs font-bold rounded-md">
                              ใหม่
                            </span>
                          )}
                          {roleDescription && (
                            <span className="text-sm text-light-text-muted dark:text-dark-text-muted">
                              {roleDescription}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => handleToggleRole(roleId)}
                          disabled={selectedRoles.length <= 1}
                          className="p-2 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title={selectedRoles.length <= 1 ? 'ต้องมีอย่างน้อย 1 role' : 'ลบ role'}
                        >
                          <FiTrash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Add Role Section */}
              {showAddRole && availableToAdd.length > 0 && (
                <div className="border-t border-light-border dark:border-dark-border pt-4">
                  <h4 className="text-sm font-bold text-light-text dark:text-dark-text uppercase mb-3">
                    เพิ่ม Role ใหม่
                  </h4>
                  <div className="grid grid-cols-1 gap-2">
                    {availableToAdd.map((role) => (
                      <button
                        key={role.id}
                        onClick={() => handleToggleRole(role.id)}
                        className="flex items-center justify-between p-3 bg-white dark:bg-dark-background hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-xl border border-light-border dark:border-dark-border transition-colors text-left"
                      >
                        <div className="flex flex-col">
                          <span className={`px-3 py-1 text-sm font-bold rounded-lg border ${getRoleBadgeColor(role.priority)} inline-block w-fit`}>
                            {role.name}
                          </span>
                          {role.description && (
                            <span className="text-xs text-light-text-muted dark:text-dark-text-muted mt-1">
                              {role.description}
                            </span>
                          )}
                        </div>
                        <FiPlus className="w-4 h-4 text-green-600 dark:text-green-400" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {showAddRole && availableToAdd.length === 0 && (
                <div className="text-center py-8 text-light-text-muted dark:text-dark-text-muted">
                  ผู้ใช้มี Role ครบทุกตัวแล้ว
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-light-border dark:border-dark-border">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-light-text dark:text-dark-text rounded-xl font-semibold transition-all disabled:opacity-50"
          >
            ยกเลิก
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white rounded-xl font-semibold transition-all shadow-lg shadow-purple-500/30 disabled:opacity-50 flex items-center justify-center"
          >
            {saving ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                กำลังบันทึก...
              </>
            ) : (
              <>
                <FiCheck className="w-5 h-5 mr-2" />
                บันทึกการเปลี่ยนแปลง
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}