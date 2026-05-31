import prisma from "@/config/prisma.config";

export async function cleanupExpiredSessions() {
  const now = new Date();

  const expiredSessions = await prisma.session.findMany({
    where: {
      expires_at: {
        lte: now,
      },
    },
  });

  if (expiredSessions.length === 0) {
    return {
      archived: 0,
      deleted: 0,
    };
  }

  let archived = 0;

  for (const session of expiredSessions) {
    await prisma.$transaction([
      prisma.session_history.create({
        data: {
          user_id: session.user_id,
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          ip_address: session.ip_address,
          user_agent: session.user_agent,
          device_info: session.device_info,
          location: session.location,
          login_source: session.login_source,
          session_type: session.session_type,
          is_active: false,
          status: "EXPIRED",
          revocation_reason: session.revocation_reason ?? "Session expired",
          created_at: session.created_at,
          expired_at: session.expires_at,
          last_used_at: session.last_used_at,
          moved_to_history_at: now,
        },
      }),
      prisma.session.delete({
        where: {
          id: session.id,
        },
      }),
    ]);

    archived += 1;
  }

  return {
    archived,
    deleted: archived,
  };
}
