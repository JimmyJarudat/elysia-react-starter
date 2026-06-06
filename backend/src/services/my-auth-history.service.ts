import prisma from "@/config/prisma.config";
import { formatLocation } from "@/utils/format-location";

export class MyAuthHistoryService {
  static async getOverview(userId: number, currentSessionId: number | null) {
    const [sessions, authHistory] = await Promise.all([
      prisma.session.findMany({
        where: { user_id: userId },
        orderBy: [{ is_active: "desc" }, { last_used_at: "desc" }, { created_at: "desc" }],
        select: {
          id: true,
          ip_address: true,
          user_agent: true,
          device_info: true,
          location: true,
          login_source: true,
          session_type: true,
          is_active: true,
          revocation_reason: true,
          created_at: true,
          updated_at: true,
          expires_at: true,
          last_used_at: true,
        },
      }),
      prisma.auth_history.findMany({
        where: { user_id: userId },
        orderBy: { created_at: "desc" },
        take: 100,
        select: {
          id: true,
          auth_type: true,
          auth_status: true,
          failure_reason: true,
          ip_address: true,
          user_agent: true,
          device_info: true,
          browser: true,
          os: true,
          location: true,
          auth_source: true,
          session_id: true,
          logout_time: true,
          session_duration: true,
          created_at: true,
        },
      }),
    ]);

    return {
      success: true,
      data: {
        sessions: sessions.map((session) => ({
          ...session,
          location: formatLocation(session.location),
          isCurrent: currentSessionId === session.id,
          canRevoke: Boolean(session.is_active) && currentSessionId !== session.id,
        })),
        authHistory: authHistory.map((item) => ({
          ...item,
          location: formatLocation(item.location),
          isCurrentSession: currentSessionId === item.session_id,
        })),
      },
    };
  }

  static async revokeSession(
    userId: number,
    currentSessionId: number | null,
    sessionId: number,
  ) {
    if (!Number.isInteger(sessionId)) {
      return { success: false, status: 400, message: "Invalid session id" };
    }

    if (currentSessionId === sessionId) {
      return { success: false, status: 400, message: "ไม่สามารถจัดการ session ปัจจุบันได้" };
    }

    const session = await prisma.session.findFirst({
      where: { id: sessionId, user_id: userId },
      select: { id: true, is_active: true },
    });

    if (!session) {
      return { success: false, status: 404, message: "Session not found" };
    }

    if (!session.is_active) {
      return { success: true, message: "Session already inactive" };
    }

    await prisma.session.update({
      where: { id: sessionId },
      data: {
        is_active: false,
        revocation_reason: "USER_REVOKED",
        updated_at: new Date(),
      },
    });

    return { success: true, message: "Session revoked" };
  }
}
