import React, { useState, useEffect } from 'react'
import {
    FiEdit2,
    FiX,
    FiCheck,
    FiUser,
    FiShield,
    FiLock,
    FiClock,
    FiFileText,
    FiAlertCircle,
    FiUnlock,
    FiLogOut
} from 'react-icons/fi'
import { useApi } from '@/hooks/useApi'
import { toast } from 'react-toastify'
import { Toggle } from './toggle'

interface EditUserModalProps {
    isOpen: boolean
    userId: number
    username: string
    onClose: () => void
    onSuccess: () => void
}

interface UserData {
    id: number
    username: string
    email: string
    custgroup: string | null
    is_active: boolean
    is_approved: boolean
    is_email_verified: boolean
    must_change_password: boolean
    failed_login_attempts: number
    locked_until: string | null
    login_notifications: boolean
    recovery_email: string | null
    temporary_account: boolean
    account_expiry: string | null
    remarks: string | null
    metadata: string | null
    approved_by_username: string | null
    created_at: string
    last_login: string | null
}

export const EditUserModal: React.FC<EditUserModalProps> = ({
    isOpen,
    userId,
    username,
    onClose,
    onSuccess
}) => {
    const api = useApi()
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [activeTab, setActiveTab] = useState<'general' | 'security' | 'temporary' | 'notes'>('general')
    const [userData, setUserData] = useState<UserData | null>(null)

    // Form states
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        custgroup: '',
        is_active: true,
        is_approved: false,
        is_email_verified: false,
        must_change_password: false,
        login_notifications: false,
        recovery_email: '',
        temporary_account: false,
        account_expiry: '',
        remarks: '',
        metadata: ''
    })

    // Reset password modal
    const [showResetPassword, setShowResetPassword] = useState(false)
    const [newPassword, setNewPassword] = useState('')
    const [mustChangePassword, setMustChangePassword] = useState(true)

    const CUSTGROUP_OPTIONS = [
        'AIS', 'AYCAL(BKK)', 'AYCAL(BRANCH)', 'AYCAL(DEALER)',
        'AYCAP', 'AYHP_BKK', 'CCC', 'GCF', 'GE Collection',
        'GE SFCC', 'GE TCS', 'GE(Collection)', 'GE(SFCC)',
        'GECAL', 'GEDealer', 'GEDealer-MC', 'KCC FILE',
        'PRO-FILE', 'RATCHTHANI', 'Rutnin', 'TSS FILE'
    ]

    useEffect(() => {
        if (isOpen && userId) {
            fetchUserData()
        }
    }, [isOpen, userId])

    const fetchUserData = async () => {
        try {
            setLoading(true)
            const response = await api.get(`/api/user/edit/${userId}`)

            console.log('🔍 Full API Response:', response)
            console.log('🔍 Response Data:', response.data)

            if (response.data?.success && response.data?.data) {
                const data = response.data.data
                console.log('✅ User Data:', data)

                // ✅ ย้ายมาไว้หลัง data พร้อมแล้ว
                const rawGroup = data.custgroup?.trim() || ''
                const matchedGroup = CUSTGROUP_OPTIONS.find(
                    opt => opt.toLowerCase() === rawGroup.toLowerCase()
                ) || rawGroup

                setUserData(data)
                setFormData({
                    username: data.username || '',
                    email: data.email || '',
                    custgroup: matchedGroup, // ✅ ใช้ matchedGroup แทน
                    is_active: data.is_active ?? true,
                    is_approved: data.is_approved ?? false,
                    is_email_verified: data.is_email_verified ?? false,
                    must_change_password: data.must_change_password ?? false,
                    login_notifications: data.login_notifications ?? false,
                    recovery_email: data.recovery_email || '',
                    temporary_account: data.temporary_account ?? false,
                    account_expiry: data.account_expiry ? new Date(data.account_expiry).toISOString().split('T')[0] : '',
                    remarks: data.remarks || '',
                    metadata: data.metadata || ''
                })

                console.log('✅ Form Data Set', { rawGroup, matchedGroup })
            } else {
                console.error('❌ Invalid response format:', response)
                toast.error('รูปแบบข้อมูลไม่ถูกต้อง')
            }
        } catch (error: any) {
            console.error('❌ Error fetching user data:', error)
            console.error('❌ Error response:', error.response)
            toast.error('ไม่สามารถโหลดข้อมูลผู้ใช้ได้: ' + (error.response?.data?.message || error.message))
        } finally {
            setLoading(false)
        }
    }

    const handleSaveGeneral = async () => {
        try {
            setSaving(true)

            // ✅ เตรียมข้อมูลพื้นฐาน
            const basicInfoData = {
                userId: Number(userId),
                username: formData.username,
                email: formData.email,
                custgroup: formData.custgroup && formData.custgroup.trim() !== '' ? formData.custgroup : null
            }

            console.log('Sending basic info:', basicInfoData)

            await api.put('/api/user/edit/basic-info', basicInfoData)

            console.log('✅ Basic info saved')

            // ✅ เตรียมข้อมูลสถานะ
            const statusData = {
                userId: Number(userId),
                is_active: formData.is_active,
                is_approved: formData.is_approved,
                is_email_verified: formData.is_email_verified,
                must_change_password: formData.must_change_password
            }

            console.log('Sending status:', statusData)

            await api.put('/api/user/edit/status', statusData)

            console.log('✅ Status saved')

            toast.success('บันทึกข้อมูลสำเร็จ! 🎉')
            onSuccess()
            onClose()
        } catch (error: any) {
            console.error('Error saving general info:', error)
            console.error('Error response:', error.response?.data)
            const errorMessage = error.response?.data?.message || error.message || 'ไม่สามารถบันทึกข้อมูลได้'
            toast.error(errorMessage)
        } finally {
            setSaving(false)
        }
    }

    const handleSaveSecurity = async () => {
        try {
            setSaving(true)

            // ✅ เตรียมข้อมูล - แปลง empty string เป็น null
            const securityData = {
                userId: Number(userId),
                login_notifications: formData.login_notifications,
                recovery_email: formData.recovery_email && formData.recovery_email.trim() !== '' ? formData.recovery_email : null
            }

            console.log('Sending security data:', securityData)

            await api.put('/api/user/edit/security', securityData)

            toast.success('บันทึกการตั้งค่าความปลอดภัยสำเร็จ! 🎉')
            onSuccess()
        } catch (error: any) {
            console.error('Error saving security settings:', error)
            console.error('Error response:', error.response?.data)
            const errorMessage = error.response?.data?.message || error.message || 'ไม่สามารถบันทึกข้อมูลได้'
            toast.error(errorMessage)
        } finally {
            setSaving(false)
        }
    }

    const handleSaveTemporary = async () => {
        try {
            setSaving(true)

            // ✅ Logic ที่ชัดเจนกว่า
            let account_expiry: string | null = null

            if (formData.temporary_account) {
                // ถ้าเป็นบัญชีชั่วคราว แต่ไม่มีวันหมดอายุ
                if (!formData.account_expiry || formData.account_expiry.trim() === '') {
                    toast.error('กรุณาระบุวันหมดอายุสำหรับบัญชีชั่วคราว')
                    setSaving(false)
                    return
                }
                account_expiry = formData.account_expiry
            }
            // ถ้าไม่ใช่บัญชีชั่วคราว account_expiry จะเป็น null

            const temporaryData = {
                userId: Number(userId),
                temporary_account: formData.temporary_account,
                account_expiry: account_expiry
            }

            console.log('Sending temporary data:', temporaryData)

            await api.put('/api/user/edit/temporary', temporaryData)

            toast.success('บันทึกการตั้งค่าบัญชีชั่วคราวสำเร็จ! 🎉')
            onSuccess()
            fetchUserData() // ✅ รีเฟรชข้อมูล
        } catch (error: any) {
            console.error('Error saving temporary settings:', error)
            console.error('Error response:', error.response?.data)
            const errorMessage = error.response?.data?.message || error.message || 'ไม่สามารถบันทึกข้อมูลได้'
            toast.error(errorMessage)
        } finally {
            setSaving(false)
        }
    }

    const handleSaveNotes = async () => {
        try {
            setSaving(true)

            // ✅ เตรียมข้อมูล
            const notesData = {
                userId: Number(userId),
                remarks: formData.remarks && formData.remarks.trim() !== '' ? formData.remarks : null,
                metadata: formData.metadata && formData.metadata.trim() !== '' ? formData.metadata : null
            }

            console.log('📤 Sending notes data:', notesData)
            console.log('📤 Type check:', {
                userId: typeof notesData.userId,
                remarks: typeof notesData.remarks,
                metadata: typeof notesData.metadata,
                remarksValue: notesData.remarks,
                metadataValue: notesData.metadata
            })

            const response = await api.put('/api/user/edit/notes', notesData)

            console.log('✅ Response:', response)

            toast.success('บันทึกหมายเหตุสำเร็จ! 🎉')
            onSuccess()
        } catch (error: any) {
            console.error('❌ Error saving notes:', error)
            console.error('❌ Error response:', error.response?.data)
            console.error('❌ Error full:', {
                status: error.response?.status,
                data: error.response?.data,
                headers: error.response?.headers
            })
            const errorMessage = error.response?.data?.message || error.message || 'ไม่สามารถบันทึกข้อมูลได้'
            toast.error(errorMessage)
        } finally {
            setSaving(false)
        }
    }

    const handleUnlockAccount = async () => {
        if (!confirm('คุณต้องการปลดล็อคบัญชีนี้หรือไม่?')) return

        try {
            setSaving(true)
            await api.post('/api/user/edit/unlock', { userId })
            toast.success('ปลดล็อคบัญชีสำเร็จ! 🔓')
            fetchUserData()
        } catch (error: any) {
            console.error('Error unlocking account:', error)
            toast.error(error.response?.data?.message || 'ไม่สามารถปลดล็อคบัญชีได้')
        } finally {
            setSaving(false)
        }
    }

    const handleForceLogout = async () => {
        if (!confirm('คุณต้องการบังคับออกจากระบบทุก session หรือไม่?')) return

        try {
            setSaving(true)
            const response = await api.post('/api/user/edit/force-logout', { userId })
            toast.success(response.data?.message || 'บังคับออกจากระบบสำเร็จ! 👋')
            fetchUserData()
        } catch (error: any) {
            console.error('Error forcing logout:', error)
            toast.error(error.response?.data?.message || 'ไม่สามารถบังคับออกจากระบบได้')
        } finally {
            setSaving(false)
        }
    }

    const handleResetPassword = async () => {
        if (!newPassword || newPassword.length < 8) {
            toast.error('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร')
            return
        }

        try {
            setSaving(true)
            await api.post('/api/user/edit/reset-password', {
                userId,
                newPassword,
                mustChangePassword
            })

            toast.success('รีเซ็ตรหัสผ่านสำเร็จ! 🔐')
            setShowResetPassword(false)
            setNewPassword('')
            fetchUserData()
        } catch (error: any) {
            console.error('Error resetting password:', error)
            toast.error(error.response?.data?.message || 'ไม่สามารถรีเซ็ตรหัสผ่านได้')
        } finally {
            setSaving(false)
        }
    }

    const handleSave = () => {
        switch (activeTab) {
            case 'general':
                handleSaveGeneral()
                break
            case 'security':
                handleSaveSecurity()
                break
            case 'temporary':
                handleSaveTemporary()
                break
            case 'notes':
                handleSaveNotes()
                break
        }
    }

    if (!isOpen) return null

    const isLocked = userData?.locked_until && new Date(userData.locked_until) > new Date()

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-dark-background-card rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col border border-light-border dark:border-dark-border">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-light-border dark:border-dark-border">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                            <FiEdit2 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-light-text dark:text-dark-text">แก้ไขข้อมูลผู้ใช้</h3>
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

                {/* Tabs */}
                <div className="flex border-b border-light-border dark:border-dark-border px-6">
                    {[
                        { id: 'general', icon: FiUser, label: 'ข้อมูลทั่วไป' },
                        { id: 'security', icon: FiShield, label: 'ความปลอดภัย' },
                        { id: 'temporary', icon: FiClock, label: 'บัญชีชั่วคราว' },
                        { id: 'notes', icon: FiFileText, label: 'หมายเหตุ' }
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`px-4 py-3 font-semibold transition-all relative ${activeTab === tab.id
                                ? 'text-blue-600 dark:text-blue-400'
                                : 'text-light-text-muted dark:text-dark-text-muted hover:text-light-text dark:hover:text-dark-text'
                                }`}
                        >
                            <div className="flex items-center gap-2">
                                <tab.icon className="w-4 h-4" />
                                {tab.label}
                            </div>
                            {activeTab === tab.id && (
                                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400"></div>
                            )}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="w-8 h-8 border-4 border-blue-200 dark:border-blue-800 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin"></div>
                        </div>
                    ) : (
                        <>
                            {/* Tab: General */}
                            {activeTab === 'general' && (
                                <div className="space-y-6">
                                    {isLocked && (
                                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-start gap-3">
                                            <FiAlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                                            <div className="flex-1">
                                                <p className="text-sm font-semibold text-red-800 dark:text-red-300">บัญชีถูกล็อค</p>
                                                <p className="text-sm text-red-700 dark:text-red-400 mt-1">
                                                    ความพยายามเข้าสู่ระบบล้มเหลว: {userData.failed_login_attempts} ครั้ง
                                                </p>
                                            </div>
                                            <button
                                                onClick={handleUnlockAccount}
                                                disabled={saving}
                                                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                                            >
                                                <FiUnlock className="w-4 h-4" />
                                                ปลดล็อค
                                            </button>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-sm font-semibold text-light-text dark:text-dark-text mb-2">
                                                Username
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.username}
                                                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                                className="w-full px-4 py-3 bg-light-background-soft dark:bg-dark-background-soft border border-light-border dark:border-dark-border rounded-xl text-light-text dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-semibold text-light-text dark:text-dark-text mb-2">
                                                Email
                                            </label>
                                            <input
                                                type="email"
                                                value={formData.email}
                                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                                className="w-full px-4 py-3 bg-light-background-soft dark:bg-dark-background-soft border border-light-border dark:border-dark-border rounded-xl text-light-text dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>

                                        <div className="relative">
                                            <label className="block text-sm font-semibold text-light-text dark:text-dark-text mb-2">
                                                Customer Group
                                            </label>

                                            <select
                                                value={formData.custgroup || ''}
                                                onChange={(e) => setFormData({ ...formData, custgroup: e.target.value })}
                                                className="w-full px-4 py-3 bg-light-background-soft dark:bg-dark-background-soft border border-light-border dark:border-dark-border rounded-xl text-light-text dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
                                            >
                                                <option value="">-- เลือก Customer Group --</option>
                                                {[
                                                    'AIS', 'AYCAL(BKK)', 'AYCAL(BRANCH)', 'AYCAL(DEALER)',
                                                    'AYCAP', 'AYHP_BKK', 'CCC', 'GCF', 'GE Collection',
                                                    'GE SFCC', 'GE TCS', 'GE(Collection)', 'GE(SFCC)',
                                                    'GECAL', 'GEDealer', 'GEDealer-MC', 'KCC FILE',
                                                    'PRO-FILE', 'RATCHTHANI', 'Rutnin', 'TSS FILE'
                                                ].map((opt) => (
                                                    <option key={opt} value={opt}>{opt}</option>
                                                ))}
                                            </select>

                                            {/* ลูกศร custom */}
                                            <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                                                ▼
                                            </div>
                                        </div>


                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                                        {[
                                            { key: 'is_active', label: 'เปิดใช้งาน (Active)', description: 'อนุญาตให้ผู้ใช้เข้าสู่ระบบได้' },
                                            { key: 'is_approved', label: 'อนุมัติแล้ว (Approved)', description: 'ผู้ดูแลระบบอนุมัติบัญชีแล้ว' },
                                            { key: 'is_email_verified', label: 'ยืนยันอีเมลแล้ว', description: 'ผู้ใช้ได้ยืนยันอีเมลแล้ว' },
                                            { key: 'must_change_password', label: 'บังคับเปลี่ยนรหัสผ่าน', description: 'ต้องเปลี่ยนรหัสผ่านครั้งถัดไป' }
                                        ].map((field) => (
                                            <div key={field.key} className="flex items-center justify-between p-4 bg-light-background-soft dark:bg-dark-background-soft rounded-xl border border-light-border dark:border-dark-border hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                                <div className="flex-1">
                                                    <span className="text-sm font-semibold text-light-text dark:text-dark-text block">
                                                        {field.label}
                                                    </span>
                                                    <span className="text-xs text-light-text-muted dark:text-dark-text-muted">
                                                        {field.description}
                                                    </span>
                                                </div>
                                                <Toggle
                                                    checked={formData[field.key as keyof typeof formData] as boolean}
                                                    onChange={(checked) => setFormData({ ...formData, [field.key]: checked })}
                                                />
                                            </div>
                                        ))}
                                    </div>

                                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 space-y-2 mt-6">
                                        <p className="text-sm text-light-text-muted dark:text-dark-text-muted">
                                            <span className="font-semibold">สร้างเมื่อ:</span> {userData?.created_at ? new Date(userData.created_at).toLocaleString('th-TH') : '-'}
                                        </p>
                                        <p className="text-sm text-light-text-muted dark:text-dark-text-muted">
                                            <span className="font-semibold">เข้าสู่ระบบล่าสุด:</span> {userData?.last_login ? new Date(userData.last_login).toLocaleString('th-TH') : 'ไม่เคย'}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Tab: Security */}
                            {activeTab === 'security' && (
                                <div className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <button
                                            onClick={() => setShowResetPassword(true)}
                                            className="flex items-center gap-3 p-4 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-xl font-semibold transition-all shadow-lg"
                                        >
                                            <FiLock className="w-5 h-5" />
                                            รีเซ็ตรหัสผ่าน
                                        </button>

                                        <button
                                            onClick={handleForceLogout}
                                            disabled={saving}
                                            className="flex items-center gap-3 p-4 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl font-semibold transition-all shadow-lg disabled:opacity-50"
                                        >
                                            <FiLogOut className="w-5 h-5" />
                                            บังคับออกจากระบบ
                                        </button>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between p-4 bg-light-background-soft dark:bg-dark-background-soft rounded-xl border border-light-border dark:border-dark-border hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                            <div className="flex-1">
                                                <span className="text-sm font-semibold text-light-text dark:text-dark-text block">
                                                    แจ้งเตือนการเข้าสู่ระบบ
                                                </span>
                                                <span className="text-xs text-light-text-muted dark:text-dark-text-muted">
                                                    ส่งการแจ้งเตือนเมื่อมีการเข้าสู่ระบบ
                                                </span>
                                            </div>
                                            <Toggle
                                                checked={formData.login_notifications}
                                                onChange={(checked) => setFormData({ ...formData, login_notifications: checked })}
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-semibold text-light-text dark:text-dark-text mb-2">
                                                อีเมลสำรอง (Recovery Email)
                                            </label>
                                            <input
                                                type="email"
                                                value={formData.recovery_email}
                                                onChange={(e) => setFormData({ ...formData, recovery_email: e.target.value })}
                                                className="w-full px-4 py-3 bg-light-background-soft dark:bg-dark-background-soft border border-light-border dark:border-dark-border rounded-xl text-light-text dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                placeholder="recovery@example.com"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Tab: Temporary */}
                            {activeTab === 'temporary' && (
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between p-4 bg-light-background-soft dark:bg-dark-background-soft rounded-xl border border-light-border dark:border-dark-border hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                        <div className="flex-1">
                                            <span className="text-sm font-semibold text-light-text dark:text-dark-text block">
                                                บัญชีชั่วคราว
                                            </span>
                                            <span className="text-xs text-light-text-muted dark:text-dark-text-muted">
                                                บัญชีจะหมดอายุตามวันที่กำหนด
                                            </span>
                                        </div>
                                        <Toggle
                                            checked={formData.temporary_account}
                                            onChange={(checked) => setFormData({ ...formData, temporary_account: checked, account_expiry: checked ? formData.account_expiry : '' })}
                                        />
                                    </div>

                                    {formData.temporary_account && (
                                        <div>
                                            <label className="block text-sm font-semibold text-light-text dark:text-dark-text mb-2">
                                                วันหมดอายุ <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="date"
                                                value={formData.account_expiry}
                                                onChange={(e) => setFormData({ ...formData, account_expiry: e.target.value })}
                                                min={new Date().toISOString().split('T')[0]}
                                                className="w-full px-4 py-3 bg-light-background-soft dark:bg-dark-background-soft border border-light-border dark:border-dark-border rounded-xl text-light-text dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                required // ✅ เพิ่ม required
                                            />
                                            <p className="text-xs text-light-text-muted dark:text-dark-text-muted mt-2">
                                                บัญชีจะถูกปิดการใช้งานอัตโนมัติเมื่อถึงวันที่กำหนด
                                            </p>
                                        </div>
                                    )}

                                    {!formData.temporary_account && (
                                        <div className="text-center py-8 text-light-text-muted dark:text-dark-text-muted">
                                            <FiClock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                            <p>บัญชีนี้ไม่ใช่บัญชีชั่วคราว</p>
                                            <p className="text-sm mt-1">เปิดใช้งานเพื่อตั้งค่าวันหมดอายุ</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Tab: Notes */}
                            {activeTab === 'notes' && (
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-sm font-semibold text-light-text dark:text-dark-text mb-2">
                                            หมายเหตุ (Remarks)
                                        </label>
                                        <textarea
                                            value={formData.remarks}
                                            onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                                            rows={4}
                                            className="w-full px-4 py-3 bg-light-background-soft dark:bg-dark-background-soft border border-light-border dark:border-dark-border rounded-xl text-light-text dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                            placeholder="บันทึกหมายเหตุเกี่ยวกับผู้ใช้นี้..."
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-light-text dark:text-dark-text mb-2">
                                            Metadata (JSON)
                                        </label>
                                        <textarea
                                            value={formData.metadata}
                                            onChange={(e) => setFormData({ ...formData, metadata: e.target.value })}
                                            rows={6}
                                            className="w-full px-4 py-3 bg-light-background-soft dark:bg-dark-background-soft border border-light-border dark:border-dark-border rounded-xl text-light-text dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm resize-none"
                                            placeholder='{"key": "value"}'
                                        />
                                        <p className="text-xs text-light-text-muted dark:text-dark-text-muted mt-2">
                                            ข้อมูลเพิ่มเติมในรูปแบบ JSON
                                        </p>
                                    </div>
                                </div>
                            )}
                        </>
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
                        className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl font-semibold transition-all shadow-lg shadow-blue-500/30 disabled:opacity-50 flex items-center justify-center"
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

            {/* Reset Password Modal */}
            {showResetPassword && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
                    <div className="bg-white dark:bg-dark-background-card rounded-2xl shadow-2xl max-w-md w-full p-6 border border-light-border dark:border-dark-border">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-xl">
                                <FiLock className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-light-text dark:text-dark-text">รีเซ็ตรหัสผ่าน</h3>
                                <p className="text-sm text-light-text-muted dark:text-dark-text-muted">
                                    ตั้งรหัสผ่านใหม่สำหรับ: {username}
                                </p>
                            </div>
                        </div>

                        <div className="space-y-4 mb-6">
                            <div>
                                <label className="block text-sm font-semibold text-light-text dark:text-dark-text mb-2">
                                    รหัสผ่านใหม่
                                </label>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="w-full px-4 py-3 bg-light-background-soft dark:bg-dark-background-soft border border-light-border dark:border-dark-border rounded-xl text-light-text dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-orange-500"
                                    placeholder="รหัสผ่านอย่างน้อย 8 ตัวอักษร"
                                    minLength={8}
                                />
                            </div>

                            <div className="flex items-center justify-between p-3 bg-light-background-soft dark:bg-dark-background-soft rounded-xl border border-light-border dark:border-dark-border">
                                <span className="text-sm font-semibold text-light-text dark:text-dark-text">
                                    บังคับเปลี่ยนรหัสผ่านครั้งถัดไป
                                </span>
                                <Toggle
                                    checked={mustChangePassword}
                                    onChange={setMustChangePassword}
                                />
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setShowResetPassword(false)
                                    setNewPassword('')
                                }}
                                disabled={saving}
                                className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-light-text dark:text-dark-text rounded-xl font-semibold transition-all disabled:opacity-50"
                            >
                                ยกเลิก
                            </button>
                            <button
                                onClick={handleResetPassword}
                                disabled={saving || !newPassword || newPassword.length < 8}
                                className="flex-1 px-4 py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-xl font-semibold transition-all shadow-lg disabled:opacity-50"
                            >
                                {saving ? 'กำลังรีเซ็ต...' : 'รีเซ็ตรหัสผ่าน'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}