// utils/clientInfo.ts

export interface ClientInfo {
  ip_address: string;
  user_agent: string | null;
  platform: string;
  device_type: string;
  browser: string;
  os: string;
}

export interface RequestContext {
  currentUser?: any;
  clientInfo: ClientInfo;
  timestamp: Date;
}

/**
 * ตรวจสอบว่าเป็น Private IP หรือไม่
 */
const isPrivateIP = (ip: string): boolean => {
  if (!ip || ip === 'unknown' || ip === '') {
    return true;
  }

  // ลบ IPv6 prefix ถ้ามี
  const cleanIP = ip.replace(/^::ffff:/, '');

  // Private IP ranges
  const privateRanges = [
    /^10\./,                          // 10.0.0.0/8 (Docker Swarm ingress)
    /^172\.(1[6-9]|2[0-9]|3[01])\./, // 172.16.0.0/12 (Docker default bridge)
    /^192\.168\./,                    // 192.168.0.0/16
    /^127\./,                         // 127.0.0.0/8 (localhost)
    /^169\.254\./,                    // 169.254.0.0/16 (link-local)
    /^0\.0\.0\.0$/,                   // 0.0.0.0
    /^::1$/,                          // IPv6 localhost
    /^fe80:/i,                        // IPv6 link-local
    /^fc00:/i,                        // IPv6 ULA
    /^fd00:/i,                        // IPv6 ULA
  ];

  return privateRanges.some(range => range.test(cleanIP));
};

/**
 * ดึง IP Address จาก request headers
 * รองรับ Nginx Proxy Manager + Docker Swarm
 */
export const getClientIP = (request: any): string => {
  if (!request?.headers) return '127.0.0.1';

  const readHeader = (name: string): string | null => {
    // Elysia/Bun: request.headers เป็น Headers (มี .get)
    if (typeof request.headers.get === 'function') {
      return request.headers.get(name);
    }
    // เผื่อบาง middleware แปลงเป็น object
    const v = request.headers[name] ?? request.headers[name.toLowerCase()];
    if (typeof v === 'string') return v;
    if (Array.isArray(v)) return v[0];
    return null;
  };

  const normalize = (ip: string) => ip.trim().replace(/^::ffff:/, '');

  const isLoopbackOrInvalid = (ip: string) =>
    /^127\./.test(ip) || ip === '0.0.0.0' || ip === '::1' || ip === '';

  const extractIPs = (raw: string): string[] => {
    // รองรับ Forwarded: for=1.2.3.4;proto=https, for=5.6.7.8
    if (/for=/i.test(raw)) {
      return raw
        .split(',')
        .map(x => x.trim())
        .map(x => {
          const m = x.match(/for="?(\[.*?\]|[^";\s,]+)"?/i);
          return m?.[1] ?? '';
        })
        .map(normalize)
        .filter(Boolean);
    }

    // X-Forwarded-For: "client, proxy1, proxy2"
    return raw
      .split(',')
      .map(normalize)
      .filter(Boolean);
  };

  const ipHeaders = [
    'x-forwarded-for',     // ⭐ NPM / reverse proxy
    'cf-connecting-ip',
    'x-real-ip',
    'true-client-ip',
    'x-client-ip',
    'forwarded',
    'x-forwarded',
    'forwarded-for',
  ];

  let privateIP: string | null = null;
  let publicIP: string | null = null;

  for (const header of ipHeaders) {
    const raw = readHeader(header);
    if (!raw) continue;

    const ips = extractIPs(raw);

    for (const ip of ips) {
      if (!ip) continue;

      if (isPrivateIP(ip)) {
        // ✅ requirement: เอาภายในก่อน แต่กัน loopback/invalid
        if (!privateIP && !isLoopbackOrInvalid(ip)) privateIP = ip;
      } else {
        if (!publicIP) publicIP = ip;
      }
    }
  }

  if (privateIP) return privateIP;
  if (publicIP) return publicIP;

  // Elysia บางทีมี request.ip (ขึ้นกับ adapter/plugin)
  const fallback =
    request.ip ??
    request.connection?.remoteAddress ??
    request.socket?.remoteAddress ??
    '127.0.0.1';

  return normalize(String(fallback));
};



/**
 * ดึง User Agent จาก request
 */
export const getUserAgent = (request: any): string | null => {
  if (!request || !request.headers) {
    return null;
  }

  if (typeof request.headers.get === 'function') {
    return request.headers.get('user-agent');
  } else if (request.headers['user-agent']) {
    return request.headers['user-agent'];
  } else if (request.headers['User-Agent']) {
    return request.headers['User-Agent'];
  }

  return null;
};

/**
 * แยกข้อมูลจาก User Agent
 */
export const parseUserAgent = (userAgent: string | null): {
  browser: string;
  os: string;
  device_type: string;
  platform: string;
} => {
  if (!userAgent) {
    return {
      browser: 'Unknown',
      os: 'Unknown',
      device_type: 'Unknown',
      platform: 'Unknown'
    };
  }

  const ua = userAgent.toLowerCase();

  let browser = 'Unknown';
  if (ua.includes('chrome') && !ua.includes('edg')) browser = 'Chrome';
  else if (ua.includes('firefox')) browser = 'Firefox';
  else if (ua.includes('safari') && !ua.includes('chrome')) browser = 'Safari';
  else if (ua.includes('edg')) browser = 'Edge';
  else if (ua.includes('opera') || ua.includes('opr')) browser = 'Opera';
  else if (ua.includes('postman')) browser = 'Postman';
  else if (ua.includes('insomnia')) browser = 'Insomnia';
  else if (ua.includes('curl')) browser = 'cURL';

  let os = 'Unknown';
  if (ua.includes('windows')) os = 'Windows';
  else if (ua.includes('mac os') || ua.includes('macos')) os = 'macOS';
  else if (ua.includes('linux')) os = 'Linux';
  else if (ua.includes('android')) os = 'Android';
  else if (ua.includes('ios') || ua.includes('iphone') || ua.includes('ipad')) os = 'iOS';

  let device_type = 'Desktop';
  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
    device_type = 'Mobile';
  } else if (ua.includes('tablet') || ua.includes('ipad')) {
    device_type = 'Tablet';
  } else if (ua.includes('postman') || ua.includes('insomnia') || ua.includes('curl')) {
    device_type = 'API Tool';
  }

  let platform = 'Web';
  if (ua.includes('postman') || ua.includes('insomnia') || ua.includes('curl')) {
    platform = 'API Testing';
  } else if (ua.includes('mobile')) {
    platform = 'Mobile App';
  } else if (ua.includes('electron')) {
    platform = 'Desktop App';
  }

  return { browser, os, device_type, platform };
};

/**
 * ดึงข้อมูล Client ทั้งหมด
 */
export const getClientInfo = (request: any): ClientInfo => {
  try {
    const ip_address = getClientIP(request);
    const user_agent = getUserAgent(request);
    const { browser, os, device_type, platform } = parseUserAgent(user_agent);

    return {
      ip_address,
      user_agent,
      browser,
      os,
      device_type,
      platform
    };
  } catch (error) {
    console.error('Error getting client info:', error);

    return {
      ip_address: '127.0.0.1',
      user_agent: null,
      browser: 'Unknown',
      os: 'Unknown',
      device_type: 'Unknown',
      platform: 'Unknown'
    };
  }
};

/**
 * สร้าง Request Context สำหรับส่งไป Service
 */
export const createRequestContext = (request: any, currentUser?: any): RequestContext => {
  return {
    currentUser,
    clientInfo: getClientInfo(request),
    timestamp: new Date()
  };
};

/**
 * Helper สำหรับแสดงข้อมูล Client แบบสั้น
 */
export const getClientSummary = (clientInfo: ClientInfo): string => {
  const { device_type, browser, os, platform } = clientInfo;

  if (platform === 'API Testing') {
    return `${browser} (${platform})`;
  }

  return `${device_type} - ${browser} on ${os}`;
};

/**
 * ตรวจสอบว่าเป็น request จาก API testing tool หรือไม่
 */
export const isAPITool = (clientInfo: ClientInfo): boolean => {
  return clientInfo.platform === 'API Testing';
};

/**
 * ตรวจสอบว่าเป็น Mobile device หรือไม่
 */
export const isMobileDevice = (clientInfo: ClientInfo): boolean => {
  return clientInfo.device_type === 'Mobile' || clientInfo.device_type === 'Tablet';
};