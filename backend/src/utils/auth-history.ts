// common/auth-history.ts
import prisma from "@/config/prisma.config";
import type { ClientInfo } from "@/utils/clientInfo";
import { ErrorLogUtil } from "@/utils/error-log";

type AuthType = "LOGIN" | "LOGOUT" | "REGISTER" | "PASSWORD_RESET" | "PASSWORD_CHANGE";
type AuthStatus = "SUCCESS" | "FAILED" | "BLOCKED" | "PENDING";
type AuthSource = "WEB" | "MOBILE_APP" | "API";

interface AuthHistoryData {
  user_id?: number;
  username: string;
  auth_type: AuthType;
  auth_status: AuthStatus;
  failure_reason?: string;
  ip_address?: string;
  user_agent?: string;
  device_info?: string;
  browser?: string;
  os?: string;
  location?: string;
  auth_source?: AuthSource;
  session_id?: number;
  two_factor_used?: boolean;
  remember_me?: boolean;
  logout_time?: Date;
  session_duration?: number;
  additional_data?: unknown;
}

interface SessionLogData {
  id: number;
  user_id: number;
  ip_address?: string | null;
  user_agent?: string | null;
  device_info?: string | null;
  location?: string | null;
  login_source?: string | null;
}

const getAuthSourceFromPlatform = (platform?: string | null): AuthSource => {
  if (platform === "Mobile App") return "MOBILE_APP";
  if (platform === "API Testing") return "API";
  return "WEB";
};

const getAuthSourceFromSession = (loginSource?: string | null): AuthSource => {
  if (loginSource === "MOBILE") return "MOBILE_APP";
  if (loginSource === "API") return "API";
  return "WEB";
};

const getDeviceInfo = (clientInfo: ClientInfo) =>
  `${clientInfo.device_type} - ${clientInfo.browser} on ${clientInfo.os} (${clientInfo.platform})`;

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
          auth_source: data.auth_source || "WEB",
          session_id: data.session_id || null,
          two_factor_used: data.two_factor_used || false,
          remember_me: data.remember_me || false,
          logout_time: data.logout_time || null,
          session_duration: data.session_duration || null,
          additional_data: data.additional_data ? JSON.stringify(data.additional_data) : null,
          created_at: new Date(),
        },
      });
    } catch (error) {
      console.error("Failed to log auth history:", error);
      ErrorLogUtil.log(error, { source: "auth-history:write", userId: data.user_id, username: data.username, context: { authType: data.auth_type, authStatus: data.auth_status } });
    }
  }

  static async logRegisterSuccess(user_id: number, username: string, extra?: Partial<AuthHistoryData>) {
    return this.log({
      user_id,
      username,
      auth_type: "REGISTER",
      auth_status: "SUCCESS",
      ...extra,
    });
  }

  static async logRegisterFailed(username: string, reason: string, extra?: Partial<AuthHistoryData>) {
    return this.log({
      username,
      auth_type: "REGISTER",
      auth_status: "FAILED",
      failure_reason: reason,
      ...extra,
    });
  }

  static async logLoginSuccess(user_id: number, username: string, extra?: Partial<AuthHistoryData>) {
    return this.log({
      user_id,
      username,
      auth_type: "LOGIN",
      auth_status: "SUCCESS",
      ...extra,
    });
  }

  static async logLoginSuccessForSession(
    user: { id: number; username: string },
    sessionId: number,
    clientInfo: ClientInfo,
    extra?: Partial<AuthHistoryData>,
  ) {
    return this.logLoginSuccess(user.id, user.username, {
      ip_address: clientInfo.ip_address,
      user_agent: clientInfo.user_agent || undefined,
      browser: clientInfo.browser,
      os: clientInfo.os,
      device_info: getDeviceInfo(clientInfo),
      auth_source: getAuthSourceFromPlatform(clientInfo.platform),
      session_id: sessionId,
      ...extra,
    });
  }

  static async logLoginFailed(username: string, reason: string, extra?: Partial<AuthHistoryData>) {
    return this.log({
      username,
      auth_type: "LOGIN",
      auth_status: "FAILED",
      failure_reason: reason,
      ...extra,
    });
  }

  static async logLogout(user_id: number, username: string, extra?: Partial<AuthHistoryData>) {
    return this.log({
      user_id,
      username,
      auth_type: "LOGOUT",
      auth_status: "SUCCESS",
      ...extra,
    });
  }

  static async logLogoutForSession(username: string, session: SessionLogData) {
    return this.logLogout(session.user_id, username, {
      ip_address: session.ip_address || undefined,
      user_agent: session.user_agent || undefined,
      device_info: session.device_info || undefined,
      location: session.location || undefined,
      auth_source: getAuthSourceFromSession(session.login_source),
      session_id: session.id,
      logout_time: new Date(),
    });
  }

  static async logPasswordReset(user_id: number, username: string, extra?: Partial<AuthHistoryData>) {
    return this.log({
      user_id,
      username,
      auth_type: "PASSWORD_RESET",
      auth_status: "SUCCESS",
      ...extra,
    });
  }

  static async logPasswordChange(user_id: number, username: string, extra?: Partial<AuthHistoryData>) {
    return this.log({
      user_id,
      username,
      auth_type: "PASSWORD_CHANGE",
      auth_status: "SUCCESS",
      ...extra,
    });
  }
}
