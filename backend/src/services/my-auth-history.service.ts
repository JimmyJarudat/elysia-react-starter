import prisma from "@/config/prisma.config";

type ServiceResult<T = unknown> = {
  success: boolean;
  status?: number;
  message?: string;
  data?: T;
};

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
        sessions: sessions.map((session) => this.mapSession(session, currentSessionId)),
        authHistory: authHistory.map((item) => this.mapAuthHistory(item, currentSessionId)),
      },
    };
  }

  static async revokeSession(
    userId: number,
    currentSessionId: number | null,
    sessionId: number,
  ): Promise<ServiceResult> {
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

  private static mapSession<T extends { id: number; is_active: boolean | null; location: string | null }>(
    session: T,
    currentSessionId: number | null,
  ) {
    return {
      ...session,
      location: this.formatLocation(session.location),
      isCurrent: currentSessionId === session.id,
      canRevoke: Boolean(session.is_active) && currentSessionId !== session.id,
    };
  }

  private static mapAuthHistory<T extends { session_id: number | null; location: string | null }>(
    item: T,
    currentSessionId: number | null,
  ) {
    return {
      ...item,
      location: this.formatLocation(item.location),
      isCurrentSession: currentSessionId === item.session_id,
    };
  }

  private static formatLocation(value: string | null) {
    if (!value) return null;
    if (value === "private network" || value === "geolocation unavailable") return value;

    try {
      const parsed = JSON.parse(value);
      const city = parsed.city || parsed.region || "";
      const country = parsed.country || parsed.country_code || "";
      return [city, country].filter(Boolean).join(", ") || value;
    } catch {
      return value;
    }
  }
}
