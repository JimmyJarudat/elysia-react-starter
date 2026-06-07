import { generateRefreshToken, generateAccessToken } from "./jwt.service";
import * as jwt from 'jsonwebtoken';
import { getSettingValue } from "@/utils/get-setting-value";
import type { ClientInfo } from "@/utils/clientInfo";
import { getJwtConfig } from "@/config/jwt.config";
import prisma from "@/config/prisma.config";
import { ErrorLogUtil } from "@/utils/error-log";

export async function createSessionForUser(
  userId: number,
  roles: string[],
  clientInfo?: ClientInfo
) {
  const finalClientInfo: ClientInfo = clientInfo || {
    ip_address: '127.0.0.1',
    user_agent: null,
    platform: 'Unknown',
    device_type: 'Unknown',
    browser: 'Unknown',
    os: 'Unknown'
  };

  const ipAddress = finalClientInfo.ip_address;
  const isPrivateNetwork = !ipAddress
    || ipAddress === '127.0.0.1'
    || ipAddress === '::1'
    || ipAddress.startsWith('192.168.')
    || ipAddress.startsWith('10.');

  const [
    MAX_ACTIVE_SESSIONS,
    forceSingleSession,
    activeSessions,
    accessToken,
    refreshToken,
    sessionExpiryMinutes,
  ] = await Promise.all([
    getSettingValue('max_active_sessions', 2),
    getSettingValue('force_single_session', false),
    prisma.session.findMany({
      where: { user_id: userId, is_active: true },
      orderBy: { created_at: 'asc' },
      select: { id: true },
    }),
    generateAccessToken({ id: userId, roles }),
    generateRefreshToken(userId.toString()),
    getSettingValue('session_expiry_minutes', 2880),
  ]);

  if (forceSingleSession) {
    // Revoke all existing sessions — only one active session allowed
    if (activeSessions.length > 0) {
      await prisma.session.updateMany({
        where: { user_id: userId, is_active: true },
        data: { is_active: false, updated_at: new Date(), revocation_reason: 'FORCE_SINGLE_SESSION' },
      });
    }
  } else if (activeSessions.length >= MAX_ACTIVE_SESSIONS) {
    const sessionsToDeactivate = activeSessions.length - MAX_ACTIVE_SESSIONS + 1;
    await prisma.session.updateMany({
      where: { id: { in: activeSessions.slice(0, sessionsToDeactivate).map((session) => session.id) } },
      data: {
        is_active: false,
        updated_at: new Date(),
        revocation_reason: 'เกินจำนวน Session ที่กำหนดใน policy',
      },
    });
  }

  const sessionExpiresAt = new Date(Date.now() + sessionExpiryMinutes * 60 * 1000);

  const session = await prisma.session.create({
    data: {
      user_id: userId,
      access_token: accessToken,
      refresh_token: refreshToken,
      ip_address: finalClientInfo.ip_address,
      user_agent: finalClientInfo.user_agent || '',
      device_info: `${finalClientInfo.device_type} - ${finalClientInfo.browser} on ${finalClientInfo.os} (${finalClientInfo.platform})`,
      location: isPrivateNetwork ? "private network" : "geolocation pending",
      login_source: finalClientInfo.platform === 'Mobile App' ? 'MOBILE' : 
                    finalClientInfo.platform === 'API Testing' ? 'API' : 'WEB',
      session_type: finalClientInfo.platform === 'Mobile App' ? 'MOBILE' : 'WEB',
      is_active: true,
      expires_at: sessionExpiresAt,
      last_used_at: new Date()
    }
  });

  if (!isPrivateNetwork) {
    void (async () => {
      let location = "geolocation unavailable";
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        const response = await fetch(
          `https://get.geojs.io/v1/ip/geo/${ipAddress}.json`,
          { signal: controller.signal },
        );
        clearTimeout(timeoutId);
        if (response.ok) location = JSON.stringify(await response.json());
      } catch (error) {
        console.error('Error fetching geolocation:', error);
        ErrorLogUtil.log(error, {
          level: 'warn',
          source: 'session-creation:fetch-geolocation',
          userId,
          ipAddress,
          context: { sessionId: session.id },
        });
      }

      try {
        await prisma.session.update({
          where: { id: session.id },
          data: { location, updated_at: new Date() },
        });
      } catch (error) {
        console.error('Error updating session geolocation:', error);
        ErrorLogUtil.log(error, {
          source: 'session-creation:update-geolocation',
          userId,
          ipAddress,
          context: { sessionId: session.id },
        });
      }
    })();
  }

  return {
    sessionId: session.id,
    accessToken,
    refreshToken
  };
}

// ฟังก์ชันสร้าง token สำหรับการยืนยันตัวตนสองขั้นตอน
export async function generateTfaSessionToken(userId: number): Promise<string> {
  const jwtConfig = await getJwtConfig();
  const TFA_SESSION_SECRET = jwtConfig.secret || '8;p';

  // สร้าง token ด้วย jsonwebtoken
  return jwt.sign(
    { type: 'tfa' },
    TFA_SESSION_SECRET,
    {
      algorithm: 'HS256',
      subject: userId.toString(), // แปลง number เป็น string สำหรับ JWT
      expiresIn: '5m' // หมดอายุใน 5 นาที
    }
  );
}

export async function verifyTfaSessionToken(token: string): Promise<number> {
  const jwtConfig = await getJwtConfig();
  const TFA_SESSION_SECRET = jwtConfig.secret || '8;p';
  try {
    const payload = jwt.verify(token, TFA_SESSION_SECRET) as { type?: string; sub?: string };
    if (payload.type !== 'tfa') throw new Error('invalid type');
    const userId = parseInt(payload.sub ?? '', 10);
    if (!Number.isInteger(userId) || userId <= 0) throw new Error('invalid subject');
    return userId;
  } catch {
    throw new Error('ลิงก์ยืนยัน 2FA ไม่ถูกต้องหรือหมดอายุแล้ว');
  }
}
