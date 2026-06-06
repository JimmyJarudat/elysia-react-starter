import { v4 as uuidv4 } from 'uuid';
import * as jwt from 'jsonwebtoken';
import { getSettingValue } from '@/utils/get-setting-value';
import { getJwtConfig } from '@/config/jwt.config';

interface JwtPayload {
    id: string;
    roles?: string[];
    iat?: number;
    exp?: number;
    aud?: string | string[];
    iss?: string;
    jti?: string;
    [key: string]: any;
}

function isTokenExpiredError(error: unknown): boolean {
    return error instanceof Error && error.name === 'TokenExpiredError';
}

function generateJwtId(prefix?: string): string {
    const uniqueId = uuidv4() + uuidv4().replace(/-/g, '');
    const cleanPrefix = prefix?.trim();

    return cleanPrefix ? `${cleanPrefix}-${uniqueId}` : uniqueId;
}

// สร้าง Access Token - รับ userId เป็น number หรือ string และ roles
export async function generateAccessToken(userData: { 
    id: number | string; 
    roles?: string[] 
}): Promise<string> {
    const jwtConfig = await getJwtConfig();
    if (!jwtConfig.secret) {
        console.error('JWT_SECRET ไม่ได้ถูกกำหนด กรุณาตั้งค่าในไฟล์ .env');
    }

    const userId = userData.id.toString(); // แปลงเป็น string สำหรับ JWT
    const roles = userData.roles || [];

    // สร้าง timestamp ปัจจุบัน
    const issuedAt = Math.floor(Date.now() / 1000);

    // คำนวณเวลาหมดอายุ (เป็นนาที)
    const JWT_EXP_IN_MINUTES = await getSettingValue('access_token_expiry_minutes', 60);
    const accessTokenExpiryMinutes = Math.max(1, parseInt(JWT_EXP_IN_MINUTES.toString(), 10) || 60);
    const expiresAt = issuedAt + (accessTokenExpiryMinutes * 60); // แปลงนาทีเป็นวินาที

    // สร้าง JTI (JWT ID) แบบสุ่ม
    const jti = generateJwtId(jwtConfig.jit);

    // สร้าง payload ตามที่ต้องการ
    const payload: JwtPayload = {
        id: userId,
        roles: roles, // เพิ่ม roles เข้าไปใน payload
        iat: issuedAt,
        exp: expiresAt,
        aud: jwtConfig.audience,
        iss: jwtConfig.issuer,
        jti: jti
    };

    // สร้าง JWT ด้วย jsonwebtoken
    return jwt.sign(payload, jwtConfig.secret, {
        algorithm: 'HS256'
    });
}

// สร้าง Refresh Token - รับ userId เป็น number หรือ string
export async function generateRefreshToken(userId: number | string, sessionId?: number | string): Promise<string> {    
    const jwtConfig = await getJwtConfig();
    if (!jwtConfig.secret) {
        console.error('JWT_SECRET ไม่ได้ถูกกำหนด กรุณาตั้งค่าในไฟล์ .env');
    }

    const userIdStr = userId.toString(); // แปลงเป็น string สำหรับ JWT

    // สร้าง timestamp ปัจจุบัน
    const issuedAt = Math.floor(Date.now() / 1000);

    // คำนวณเวลาหมดอายุ (เป็นนาที)
    const RFT_EXP_IN_MINUTES = await getSettingValue('refresh_token_expiry_minutes', 10080);
    const refreshTokenExpiryMinutes = Math.max(1, parseInt(RFT_EXP_IN_MINUTES.toString(), 10) || 10080);
    const expiresAt = issuedAt + (refreshTokenExpiryMinutes * 60); // แปลงนาทีเป็นวินาที

    // สร้าง JTI (JWT ID) แบบสุ่ม สำหรับ Refresh Token
    const jti = sessionId?.toString() || generateJwtId(jwtConfig.jit);

    // สร้าง payload สำหรับ refresh token
    const payload: JwtPayload = {
        id: userIdStr,
        iat: issuedAt,
        exp: expiresAt,
        aud: jwtConfig.audience,
        iss: jwtConfig.issuer,
        jti: jti
    };

    // สร้าง JWT
    return jwt.sign(payload, jwtConfig.secret, {
        algorithm: 'HS256'
    });
}

// ถอดรหัส และตรวจสอบ token
export async function verifyToken(token: string): Promise<JwtPayload> {    
    try {
        const jwtConfig = await getJwtConfig();

        // ตรวจสอบ JWT ด้วย jsonwebtoken
        const payload = jwt.verify(token, jwtConfig.secret, {
            issuer: jwtConfig.issuer,
            audience: jwtConfig.audience,
        }) as JwtPayload;

        // แปลง payload กลับเป็นรูปแบบที่ต้องการ
        return {
            id: payload.id,
            roles: payload.roles || [],
            iat: payload.iat,
            exp: payload.exp,
            aud: payload.aud,
            iss: payload.iss,
            jti: payload.jti
        };
    } catch (error) {
        if (!isTokenExpiredError(error)) {
            console.error('การตรวจสอบ token ล้มเหลว:', error);
        }
        throw new Error('Token ไม่ถูกต้องหรือหมดอายุ');
    }
}

export async function verifyRefreshToken(refreshToken: string, sessionId?: number | string): Promise<JwtPayload> {
    try {
        const jwtConfig = await getJwtConfig();

        // ตรวจสอบ JWT ด้วย jsonwebtoken
        const payload = jwt.verify(refreshToken, jwtConfig.secret, {
            issuer: jwtConfig.issuer,
            audience: jwtConfig.audience,
        }) as JwtPayload;

        // แปลง payload กลับเป็นรูปแบบที่ต้องการ
        return {
            id: payload.id,
            roles: payload.roles || [],
            iat: payload.iat,
            exp: payload.exp,
            aud: payload.aud,
            iss: payload.iss,
            jti: payload.jti
        };
    } catch (error) {
        if (!isTokenExpiredError(error)) {
            console.error('การตรวจสอบ Refresh Token ล้มเหลว:', error);
        }
        throw new Error('Refresh Token ไม่ถูกต้องหรือหมดอายุ');
    }
}
