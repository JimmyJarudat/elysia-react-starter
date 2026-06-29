import prisma from "@/config/prisma.config";

type AuthType = "LOGIN" | "LOGOUT" | "REGISTER" | "PASSWORD_RESET" | "PASSWORD_CHANGE";
type AuthStatus = "SUCCESS" | "FAILED" | "BLOCKED" | "PENDING";
type AuthSource = "WEB" | "MOBILE_APP" | "API" | "LDAP";

export interface AuthHistoryData {
  user_id?: number | null;
  username: string;
  auth_type: AuthType;
  auth_status: AuthStatus;
  failure_reason?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  device_info?: string | null;
  browser?: string | null;
  os?: string | null;
  location?: string | null;
  auth_source?: AuthSource;
  session_id?: number | null;
  two_factor_used?: boolean;
  remember_me?: boolean;
  logout_time?: Date | null;
  session_duration?: number | null;
  additional_data?: unknown;
}

export class AuthHistoryUtil {
  static log(data: AuthHistoryData): void {
    void prisma.auth_history.create({
      data: {
        user_id: data.user_id ?? null,
        username: data.username,
        auth_type: data.auth_type,
        auth_status: data.auth_status,
        failure_reason: data.failure_reason ?? null,
        ip_address: data.ip_address ?? null,
        user_agent: data.user_agent ?? null,
        device_info: data.device_info ?? null,
        browser: data.browser ?? null,
        os: data.os ?? null,
        location: data.location ?? null,
        auth_source: data.auth_source ?? "WEB",
        session_id: data.session_id ?? null,
        two_factor_used: data.two_factor_used ?? false,
        remember_me: data.remember_me ?? false,
        logout_time: data.logout_time ?? null,
        session_duration: data.session_duration ?? null,
        additional_data: data.additional_data ? JSON.stringify(data.additional_data) : null,
        created_at: new Date(),
      },
    }).catch(() => {});
  }
}
