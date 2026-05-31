import prisma from "@/common/prisma";
import { generateRefreshToken, generateAccessToken } from "./jwt.service";
import { Context } from 'elysia';
import * as jwt from 'jsonwebtoken';
import { getSettingValue } from "../utils/get-setting-value";
import { ClientInfo, getClientInfo } from "@/utils/clientInfo";
import { getJwtConfig } from "@/config/jwt.config";
import novaPlatform from '@/common/prisma-nova-platform';

// สร้าง Session และ Tokens สำหรับ Userimport { ClientInfo, getClientInfo } from '../utils/clientInfo';

export async function createSessionForUser(
  userId: number,
  roles: string[],
  clientInfo?: ClientInfo  // ✅ เปลี่ยนเป็นรับ clientInfo โดยตรง
) {
  const finalClientInfo: ClientInfo = clientInfo || {
    ip_address: '127.0.0.1',
    user_agent: null,
    platform: 'Unknown',
    device_type: 'Unknown',
    browser: 'Unknown',
    os: 'Unknown'
  };

  // ดึงข้อมูล geolocation
let geoString = "private network";
const ipAddress = finalClientInfo.ip_address;

// Add null/undefined check before using string methods
if (ipAddress && ipAddress !== '127.0.0.1' && !ipAddress.startsWith('192.168.') && !ipAddress.startsWith('10.')) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const geoLocation = await fetch(
      `https://get.geojs.io/v1/ip/geo/${ipAddress}.json`,
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);

    if (geoLocation.ok) {
      const geoData = await geoLocation.json();
      geoString = JSON.stringify(geoData);
    }
  } catch (error) {
    console.error('Error fetching geolocation:', error);
    geoString = "geolocation unavailable";
  }
}
  const MAX_ACTIVE_SESSIONS = await getSettingValue('max_active_sessions', 2);

  const activeSessions = await novaPlatform.session.findMany({
    where: {
      user_id: userId,
      is_active: true
    },
    orderBy: {
      created_at: 'asc'
    }
  });

  if (activeSessions.length >= MAX_ACTIVE_SESSIONS) {
    const sessionsToDeactivate = activeSessions.length - MAX_ACTIVE_SESSIONS + 1;

    for (let i = 0; i < sessionsToDeactivate; i++) {
      await novaPlatform.session.update({
        where: { id: activeSessions[i].id },
        data: {
          is_active: false,
          updated_at: new Date(),
          revocation_reason: 'เกินจำนวน Session ที่กำหนดใน policy'
        }
      });
    }
  }

  const accessToken = await generateAccessToken({
    id: userId,
    roles: roles
  });
  const refreshToken = await generateRefreshToken(userId.toString());

  const sessionExpiryMinutes = await getSettingValue('session_expiry_minutes', 2880);
  const sessionExpiresAt = new Date(Date.now() + sessionExpiryMinutes * 60 * 1000);

  const session = await novaPlatform.session.create({
    data: {
      user_id: userId,
      access_token: accessToken,
      refresh_token: refreshToken,
      ip_address: finalClientInfo.ip_address,
      user_agent: finalClientInfo.user_agent || '',
      device_info: `${finalClientInfo.device_type} - ${finalClientInfo.browser} on ${finalClientInfo.os} (${finalClientInfo.platform})`,
      location: geoString,
      login_source: finalClientInfo.platform === 'Mobile App' ? 'MOBILE' : 
                    finalClientInfo.platform === 'API Testing' ? 'API' : 'WEB',
      session_type: finalClientInfo.platform === 'Mobile App' ? 'MOBILE' : 'WEB',
      is_active: true,
      expires_at: sessionExpiresAt,
      last_used_at: new Date()
    }
  });

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