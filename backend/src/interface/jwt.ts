interface JwtUserPayload {
    id: string; // เก็บเป็น string ใน JWT
    roles?: string[]; // เพิ่ม roles array
}

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