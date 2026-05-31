import { v4 as uuidv4 } from 'uuid';
import * as jwt from 'jsonwebtoken';
import { getSettingValue } from '@/utils/get-setting-value';
import { getJwtConfig } from '@/config/jwt.config';

const jwtConfig = await getJwtConfig();
const JWT_SECRET = jwtConfig.secret;
const JWT_JIT = jwtConfig.jit;
const JWT_ISSUER = jwtConfig.issuer;
const JWT_AUDIENCE = jwtConfig.audience;

// console.log('JWT_SECRET', JWT_SECRET);W
// console.log('JWT_JIT', JWT_JIT);
// console.log('JWT_ISSUER', JWT_ISSUER);
// console.log('JWT_AUDIENCE', JWT_AUDIENCE);

if (!JWT_SECRET) {
    console.error('JWT_SECRET ไม่ได้ถูกกำหนด กรุณาตั้งค่าในไฟล์ .env');
}



// สร้าง Access Token - รับ userId เป็น number หรือ string และ roles
export async function generateAccessToken(userData: { 
    id: number | string; 
    roles?: string[] 
}): Promise<string> {
    const userId = userData.id.toString(); // แปลงเป็น string สำหรับ JWT
    const roles = userData.roles || [];

    // สร้าง timestamp ปัจจุบัน
    const issuedAt = Math.floor(Date.now() / 1000);

    // คำนวณเวลาหมดอายุ (เป็นนาที)
    const JWT_EXP_IN_MINUTES = await getSettingValue('access_token_expiry_minutes', 60); // ค่าเริ่มต้น 60 นาที (1 ชม.)
    console.log("JWT_EXP_IN_MINUTES:", JWT_EXP_IN_MINUTES);
    const expiresAt = issuedAt + (parseInt(JWT_EXP_IN_MINUTES.toString()) * 60); // แปลงนาทีเป็นวินาที

    // สร้าง JTI (JWT ID) แบบสุ่ม
    const jti = JWT_JIT || uuidv4() + uuidv4().replace(/-/g, '');

    // สร้าง payload ตามที่ต้องการ
    const payload: JwtPayload = {
        id: userId,
        roles: roles, // เพิ่ม roles เข้าไปใน payload
        iat: issuedAt,
        exp: expiresAt,
        aud: JWT_AUDIENCE,
        iss: JWT_ISSUER,
        jti: jti
    };

    // สร้าง JWT ด้วย jsonwebtoken
    return jwt.sign(payload, JWT_SECRET, {
        algorithm: 'HS256'
    });
}

// สร้าง Refresh Token - รับ userId เป็น number หรือ string
export async function generateRefreshToken(userId: number | string, sessionId?: number | string): Promise<string> {    
    const userIdStr = userId.toString(); // แปลงเป็น string สำหรับ JWT

    // สร้าง timestamp ปัจจุบัน
    const issuedAt = Math.floor(Date.now() / 1000);

    // คำนวณเวลาหมดอายุ (เป็นนาที)
    const RFT_EXP_IN_MINUTES = await getSettingValue('refresh_token_expiry_minutes', 10080); // ค่าเริ่มต้น 10080 นาที (7 วัน)
    console.log("REFRESH_TOKEN_EXPIRY_MINUTES:", RFT_EXP_IN_MINUTES);
    const expiresAt = issuedAt + (parseInt(RFT_EXP_IN_MINUTES.toString()) * 60); // แปลงนาทีเป็นวินาที

    // สร้าง JTI (JWT ID) แบบสุ่ม สำหรับ Refresh Token
    const jti = sessionId?.toString() || uuidv4() + uuidv4().replace(/-/g, '');

    // สร้าง payload สำหรับ refresh token
    const payload: JwtPayload = {
        id: userIdStr,
        iat: issuedAt,
        exp: expiresAt,
        aud: JWT_AUDIENCE,
        iss: JWT_ISSUER,
        jti: jti
    };

    // สร้าง JWT
    return jwt.sign(payload, JWT_SECRET, {
        algorithm: 'HS256'
    });
}

// ถอดรหัส และตรวจสอบ token
export async function verifyToken(token: string): Promise<JwtPayload> {    
    try {
        // ตรวจสอบ JWT ด้วย jsonwebtoken
        const payload = jwt.verify(token, JWT_SECRET, {
            issuer: JWT_ISSUER,
            audience: JWT_AUDIENCE,
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
        console.error('การตรวจสอบ token ล้มเหลว:', error);
        throw new Error('Token ไม่ถูกต้องหรือหมดอายุ');
    }
}

export async function verifyRefreshToken(refreshToken: string, sessionId?: number | string): Promise<JwtPayload> {
    try {
        // ตรวจสอบ JWT ด้วย jsonwebtoken
        const payload = jwt.verify(refreshToken, JWT_SECRET, {
            issuer: JWT_ISSUER,
            audience: JWT_AUDIENCE,
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
        console.error('การตรวจสอบ Refresh Token ล้มเหลว:', error);
        throw new Error('Refresh Token ไม่ถูกต้องหรือหมดอายุ');
    }
}