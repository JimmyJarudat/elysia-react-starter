import React, { useState, useEffect, useRef } from 'react'
import { FiX, FiUser, FiMail, FiLock, FiShield, FiEye, FiEyeOff, FiAlertCircle, FiUsers } from 'react-icons/fi'
import { useApi } from '@/hooks/useApi'
import { toast } from 'react-toastify'

const CUSTGROUP_OPTIONS = [
    'AIS', 'AYCAL(BKK)', 'AYCAL(BRANCH)', 'AYCAL(DEALER)',
    'AYCAP', 'AYHP_BKK', 'CCC', 'GCF', 'GE Collection',
    'GE SFCC', 'GE TCS', 'GE(Collection)', 'GE(SFCC)',
    'GECAL', 'GEDealer', 'GEDealer-MC', 'KCC FILE',
    'PRO-FILE', 'RATCHTHANI', 'Rutnin', 'TSS FILE'
]

interface CreateUserModalProps {
    isOpen: boolean
    onClose: () => void
    onSuccess?: () => void
    availableRoles: Array<{ id: string; name: string }>
}

export const CreateUserModal: React.FC<CreateUserModalProps> = ({ isOpen, onClose, onSuccess, availableRoles }) => {
    const api = useApi()
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        confirmPassword: '',
        role_id: '',
        custgroup: ''
    })

    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [errors, setErrors] = useState<Record<string, string>>({})
    const [loading, setLoading] = useState(false)
    const [successMessage, setSuccessMessage] = useState('')

    useEffect(() => {
        if (!isOpen) {
            setFormData({
                username: '',
                email: '',
                password: '',
                confirmPassword: '',
                role_id: '',
                custgroup: ''
            })
            setErrors({})
            setSuccessMessage('')
        }
    }, [isOpen])

    const validateForm = () => {
        const newErrors: Record<string, string> = {}

        if (!formData.username) {
            newErrors.username = 'Username is required'
        } else if (formData.username.length < 4 || formData.username.length > 50) {
            newErrors.username = 'Username must be between 4-50 characters'
        }

        if (!formData.email) {
            newErrors.email = 'Email is required'
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            newErrors.email = 'Invalid email format'
        }

        if (!formData.password) {
            newErrors.password = 'Password is required'
        } else if (formData.password.length < 8) {
            newErrors.password = 'Password must be at least 8 characters'
        } else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}/.test(formData.password)) {
            newErrors.password = 'Password must contain lowercase, uppercase, number and special character'
        }

        if (!formData.confirmPassword) {
            newErrors.confirmPassword = 'Please confirm password'
        } else if (formData.password !== formData.confirmPassword) {
            newErrors.confirmPassword = 'Passwords do not match'
        }

        // ✅ บังคับเลือก
        if (!formData.custgroup) {
            newErrors.custgroup = 'กรุณาเลือก Customer Group'
        }

        if (!formData.role_id) {
            newErrors.role_id = 'กรุณาเลือก Role'
        }

        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    const modalRef = useRef<HTMLDivElement>(null)

    const handleSubmit = async () => {
        if (!validateForm()) return

        setLoading(true)
        setErrors({})
        setSuccessMessage('')

        try {
            const response = await api.post('/api/auth/register', { ...formData })

            if (response.data.success) {
                setSuccessMessage(response.data.message || 'User created successfully!')
                toast.success(`สร้างผู้ใช้สำเร็จ — ${formData.username} ถูกเพิ่มเข้าระบบแล้ว`)
                setTimeout(() => { onSuccess?.(); onClose() }, 1500)
            } else {
                setErrors({ general: response.data.message || 'Failed to create user' })
                toast.error(`สร้างผู้ใช้ไม่สำเร็จ: ${response.data.message}`)
                modalRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
            }

        } catch (error: any) {
            const errorData = error.response?.data

            if (errorData) {
                if (Array.isArray(errorData.message)) {
                    const msg = errorData.message.join(', ')
                    setErrors({ general: msg })
                    toast.error(`ข้อมูลไม่ถูกต้อง: ${msg}`)
                } else if (errorData.errors && typeof errorData.errors === 'object') {
                    setErrors(errorData.errors)
                    toast.error('ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบข้อมูลที่กรอก')
                } else {
                    const msg = errorData.message || 'Failed to create user'
                    setErrors({ general: msg })
                    toast.error(`เกิดข้อผิดพลาด: ${msg}`)
                }
            } else {
                setErrors({ general: 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้' })
                toast.error('เชื่อมต่อไม่ได้ กรุณาตรวจสอบการเชื่อมต่อเครือข่าย')
            }

            modalRef.current?.scrollTo({ top: 0, behavior: 'smooth' })

        } finally {
            setLoading(false)
        }
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target
        setFormData(prev => ({ ...prev, [name]: value }))
        if (errors[name]) {
            setErrors(prev => {
                const newErrors = { ...prev }
                delete newErrors[name]
                return newErrors
            })
        }
    }

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !loading) {
            e.preventDefault()
            handleSubmit()
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div
                ref={modalRef}
                className="relative w-full max-w-2xl bg-white dark:bg-dark-background-card rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="sticky top-0 bg-gradient-to-r from-ocean-500 to-ocean-600 dark:from-ocean-400 dark:to-ocean-500 px-6 py-5 rounded-t-2xl">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-white/20 rounded-xl">
                                <FiUser className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-white">Create New User</h2>
                                <p className="text-ocean-100 text-sm">Add a new user to the system</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors" disabled={loading}>
                            <FiX className="w-6 h-6 text-white" />
                        </button>
                    </div>
                </div>

                <div className="p-6">
                    {successMessage && (
                        <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-xl flex items-center gap-3">
                            <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                                <FiAlertCircle className="w-5 h-5 text-white" />
                            </div>
                            <p className="text-sm font-semibold text-green-800 dark:text-green-300">{successMessage}</p>
                        </div>
                    )}

                    {errors.general && (
                        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-3">
                            <FiAlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
                            <p className="text-sm text-red-800 dark:text-red-300">{errors.general}</p>
                        </div>
                    )}

                    <div className="space-y-5">
                        {/* Username */}
                        <div>
                            <label className="block text-sm font-semibold text-light-text dark:text-dark-text mb-2">
                                Username <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <FiUser className="absolute left-4 top-1/2 -translate-y-1/2 text-light-text-light dark:text-dark-text-light w-5 h-5" />
                                <input
                                    type="text" name="username" value={formData.username}
                                    onChange={handleChange} onKeyPress={handleKeyPress}
                                    placeholder="Enter username (4-50 characters)"
                                    className={`w-full pl-12 pr-4 py-3 bg-light-background-soft dark:bg-dark-background-soft border rounded-xl text-light-text dark:text-dark-text placeholder-light-text-light dark:placeholder-dark-text-light focus:outline-none focus:ring-2 transition-all ${errors.username ? 'border-red-500 focus:ring-red-500' : 'border-light-border dark:border-dark-border focus:ring-ocean-500'}`}
                                    disabled={loading}
                                />
                            </div>
                            {errors.username && <p className="mt-1.5 text-sm text-red-600 dark:text-red-400 flex items-center gap-1"><FiAlertCircle className="w-4 h-4" />{errors.username}</p>}
                        </div>

                        {/* Email */}
                        <div>
                            <label className="block text-sm font-semibold text-light-text dark:text-dark-text mb-2">
                                Email <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <FiMail className="absolute left-4 top-1/2 -translate-y-1/2 text-light-text-light dark:text-dark-text-light w-5 h-5" />
                                <input
                                    type="email" name="email" value={formData.email}
                                    onChange={handleChange} onKeyPress={handleKeyPress}
                                    placeholder="Enter email address"
                                    className={`w-full pl-12 pr-4 py-3 bg-light-background-soft dark:bg-dark-background-soft border rounded-xl text-light-text dark:text-dark-text placeholder-light-text-light dark:placeholder-dark-text-light focus:outline-none focus:ring-2 transition-all ${errors.email ? 'border-red-500 focus:ring-red-500' : 'border-light-border dark:border-dark-border focus:ring-ocean-500'}`}
                                    disabled={loading}
                                />
                            </div>
                            {errors.email && <p className="mt-1.5 text-sm text-red-600 dark:text-red-400 flex items-center gap-1"><FiAlertCircle className="w-4 h-4" />{errors.email}</p>}
                        </div>

                        {/* Password */}
                        <div>
                            <label className="block text-sm font-semibold text-light-text dark:text-dark-text mb-2">
                                Password <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <FiLock className="absolute left-4 top-1/2 -translate-y-1/2 text-light-text-light dark:text-dark-text-light w-5 h-5" />
                                <input
                                    type={showPassword ? 'text' : 'password'} name="password" value={formData.password}
                                    onChange={handleChange} onKeyPress={handleKeyPress} placeholder="Enter password"
                                    className={`w-full pl-12 pr-12 py-3 bg-light-background-soft dark:bg-dark-background-soft border rounded-xl text-light-text dark:text-dark-text placeholder-light-text-light dark:placeholder-dark-text-light focus:outline-none focus:ring-2 transition-all ${errors.password ? 'border-red-500 focus:ring-red-500' : 'border-light-border dark:border-dark-border focus:ring-ocean-500'}`}
                                    disabled={loading}
                                />
                                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-light-text-light dark:text-dark-text-light hover:text-light-text dark:hover:text-dark-text transition-colors">
                                    {showPassword ? <FiEyeOff className="w-5 h-5" /> : <FiEye className="w-5 h-5" />}
                                </button>
                            </div>
                            {errors.password && <p className="mt-1.5 text-sm text-red-600 dark:text-red-400 flex items-center gap-1"><FiAlertCircle className="w-4 h-4" />{errors.password}</p>}
                            <p className="mt-1.5 text-xs text-light-text-muted dark:text-dark-text-muted">Must contain 8+ characters with uppercase, lowercase, number and special character</p>
                        </div>

                        {/* Confirm Password */}
                        <div>
                            <label className="block text-sm font-semibold text-light-text dark:text-dark-text mb-2">
                                Confirm Password <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <FiLock className="absolute left-4 top-1/2 -translate-y-1/2 text-light-text-light dark:text-dark-text-light w-5 h-5" />
                                <input
                                    type={showConfirmPassword ? 'text' : 'password'} name="confirmPassword" value={formData.confirmPassword}
                                    onChange={handleChange} onKeyPress={handleKeyPress} placeholder="Re-enter password"
                                    className={`w-full pl-12 pr-12 py-3 bg-light-background-soft dark:bg-dark-background-soft border rounded-xl text-light-text dark:text-dark-text placeholder-light-text-light dark:placeholder-dark-text-light focus:outline-none focus:ring-2 transition-all ${errors.confirmPassword ? 'border-red-500 focus:ring-red-500' : 'border-light-border dark:border-dark-border focus:ring-ocean-500'}`}
                                    disabled={loading}
                                />
                                <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-light-text-light dark:text-dark-text-light hover:text-light-text dark:hover:text-dark-text transition-colors">
                                    {showConfirmPassword ? <FiEyeOff className="w-5 h-5" /> : <FiEye className="w-5 h-5" />}
                                </button>
                            </div>
                            {errors.confirmPassword && <p className="mt-1.5 text-sm text-red-600 dark:text-red-400 flex items-center gap-1"><FiAlertCircle className="w-4 h-4" />{errors.confirmPassword}</p>}
                        </div>

                        {/* Customer Group + Role (2 คอลัมน์) */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            {/* Customer Group */}
                            <div>
                                <label className="block text-sm font-semibold text-light-text dark:text-dark-text mb-2">
                                    Customer Group <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <FiUsers className="absolute left-4 top-1/2 -translate-y-1/2 text-light-text-light dark:text-dark-text-light w-5 h-5 pointer-events-none" />
                                    <select
                                        name="custgroup" value={formData.custgroup} onChange={handleChange}
                                        className={`w-full pl-12 pr-4 py-3 bg-light-background-soft dark:bg-dark-background-soft border rounded-xl text-light-text dark:text-dark-text focus:outline-none focus:ring-2 transition-all appearance-none cursor-pointer ${errors.custgroup ? 'border-red-500 focus:ring-red-500' : 'border-light-border dark:border-dark-border focus:ring-ocean-500'}`}
                                        disabled={loading}
                                    >
                                        <option value="">-- เลือก Customer Group --</option>
                                        {CUSTGROUP_OPTIONS.map(opt => (
                                            <option key={opt} value={opt}>{opt}</option>
                                        ))}
                                    </select>
                                </div>
                                {errors.custgroup && <p className="mt-1.5 text-sm text-red-600 dark:text-red-400 flex items-center gap-1"><FiAlertCircle className="w-4 h-4" />{errors.custgroup}</p>}
                            </div>

                            {/* Role */}
                            <div>
                                <label className="block text-sm font-semibold text-light-text dark:text-dark-text mb-2">
                                    Role <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <FiShield className="absolute left-4 top-1/2 -translate-y-1/2 text-light-text-light dark:text-dark-text-light w-5 h-5 pointer-events-none" />
                                    <select
                                        name="role_id" value={formData.role_id} onChange={handleChange}
                                        className={`w-full pl-12 pr-4 py-3 bg-light-background-soft dark:bg-dark-background-soft border rounded-xl text-light-text dark:text-dark-text focus:outline-none focus:ring-2 transition-all appearance-none cursor-pointer ${errors.role_id ? 'border-red-500 focus:ring-red-500' : 'border-light-border dark:border-dark-border focus:ring-ocean-500'}`}
                                        disabled={loading}
                                    >
                                        <option value="">-- เลือก Role --</option>
                                        {availableRoles.map(role => (
                                            <option key={role.id} value={role.id}>{role.name}</option>
                                        ))}
                                    </select>
                                </div>
                                {errors.role_id && <p className="mt-1.5 text-sm text-red-600 dark:text-red-400 flex items-center gap-1"><FiAlertCircle className="w-4 h-4" />{errors.role_id}</p>}
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-end gap-3 mt-8 pt-6 border-t border-light-border-light dark:border-dark-border-light">
                        <button type="button" onClick={onClose} disabled={loading}
                            className="px-6 py-2.5 bg-light-background-soft dark:bg-dark-background-soft hover:bg-gray-200 dark:hover:bg-gray-700 text-light-text dark:text-dark-text font-semibold rounded-xl transition-all">
                            Cancel
                        </button>
                        <button type="button" onClick={handleSubmit} disabled={loading}
                            className="px-6 py-2.5 bg-gradient-to-r from-ocean-500 to-ocean-600 hover:from-ocean-600 hover:to-ocean-700 text-white font-semibold rounded-xl transition-all shadow-lg shadow-ocean-500/30 disabled:opacity-50 disabled:cursor-not-allowed">
                            {loading ? (
                                <span className="flex items-center gap-2">
                                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    Creating...
                                </span>
                            ) : 'Create User'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}