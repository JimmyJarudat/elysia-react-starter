// common/auth-history.ts
import prisma from "@/config/prisma.config";
interface AuthHistoryData {
    user_id?: number;  // เปลี่ยนเป็น number ตรงตาม schema
    username: string;
    auth_type: 'LOGIN' | 'LOGOUT' | 'REGISTER' | 'PASSWORD_RESET' | 'PASSWORD_CHANGE';
    auth_status: 'SUCCESS' | 'FAILED' | 'BLOCKED' | 'PENDING';
    failure_reason?: string;
    ip_address?: string;
    user_agent?: string;
    device_info?: string;
    browser?: string;
    os?: string;
    location?: string;
    auth_source?: 'WEB' | 'MOBILE_APP' | 'API';
    session_id?: number;  // เปลี่ยนเป็น number ตรงตาม schema
    two_factor_used?: boolean;
    remember_me?: boolean;
    additional_data?: any;
}

export class AuthHistoryUtil {
    static async log(data: AuthHistoryData) {
        try {
            await prisma.auth_history.create({
                data: {
                    user_id: data.user_id || null,
                    username: data.username,
                    auth_type: data.auth_type,
                    auth_status: data.auth_status,
                    failure_reason: data.failure_reason || null,
                    ip_address: data.ip_address || null,
                    user_agent: data.user_agent || null,
                    device_info: data.device_info || null,
                    browser: data.browser || null,
                    os: data.os || null,
                    location: data.location || null,
                    auth_source: data.auth_source || 'WEB',
                    session_id: data.session_id || null,  // ไม่ต้องแปลง เป็น number อยู่แล้ว
                    two_factor_used: data.two_factor_used || false,
                    remember_me: data.remember_me || false,
                    additional_data: data.additional_data ? JSON.stringify(data.additional_data) : null,
                    created_at: new Date()
                }
            });
        } catch (error) {
            console.error('Failed to log auth history:', error);
        }
    }

    // Helper methods
    static async logRegisterSuccess(user_id: number, username: string, extra?: Partial<AuthHistoryData>) {
        return this.log({
            user_id,
            username,
            auth_type: 'REGISTER',
            auth_status: 'SUCCESS',
            ...extra
        });
    }

    static async logRegisterFailed(username: string, reason: string, extra?: Partial<AuthHistoryData>) {
        return this.log({
            username,
            auth_type: 'REGISTER',
            auth_status: 'FAILED',
            failure_reason: reason,
            ...extra
        });
    }

    static async logLoginSuccess(user_id: number, username: string, extra?: Partial<AuthHistoryData>) {
        return this.log({
            user_id,
            username,
            auth_type: 'LOGIN',
            auth_status: 'SUCCESS',
            ...extra
        });
    }

    static async logLoginFailed(username: string, reason: string, extra?: Partial<AuthHistoryData>) {
        return this.log({
            username, // ให้แน่ใจว่า username ถูกส่งไป
            auth_type: 'LOGIN',
            auth_status: 'FAILED',
            failure_reason: reason,
            ...extra
        });
    }

    static async logLogout(user_id: number, username: string, extra?: Partial<AuthHistoryData>) {
        return this.log({
            user_id,
            username,
            auth_type: 'LOGOUT',
            auth_status: 'SUCCESS',
            ...extra
        });
    }

    static async logPasswordReset(user_id: number, username: string, extra?: Partial<AuthHistoryData>) {
        return this.log({
            user_id,
            username,
            auth_type: 'PASSWORD_RESET',
            auth_status: 'SUCCESS',
            ...extra
        });
    }

    static async logPasswordChange(user_id: number, username: string, extra?: Partial<AuthHistoryData>) {
        return this.log({
            user_id,
            username,
            auth_type: 'PASSWORD_CHANGE',
            auth_status: 'SUCCESS',
            ...extra
        });
    }
}
