import { Elysia } from "elysia";
import prisma from "@/config/prisma.config";
import { verifyToken } from "@/services/jwt.service";
import { getClientIP } from "@/utils/clientInfo";
import redis from "@/config/redis.config";
import { parse } from "cookie";
import { PersonalAccessTokenService } from "@/modules/personal-access-tokens/personal-access-tokens.service";
import { getPermissionIdsForRoles } from "@/utils/get-user-role-permission";
import { getSettingValue } from "@/utils/get-setting-value";
import { ErrorLogUtil } from "@/utils/error-log";

// Hierarchical permission check: exact match, child permission, or root-level broad permission
function hasPermission(permissionId: string, permissions: string[]): boolean {
  if (permissions.includes(permissionId)) return true;
  const childPrefix = permissionId + ".";
  if (permissions.some(p => p.startsWith(childPrefix))) return true;
  if (permissionId.includes(".")) {
    const root = permissionId.split(".")[0];
    if (permissions.includes(root + ".read") || permissions.includes(root + ".update")) return true;
  }
  return false;
}

const IP_BLOCKLIST_CACHE_KEY = "security:ip_blocklist";
const IP_BLOCKLIST_TTL = 60; // seconds
const IDLE_TIMEOUT_CACHE_KEY = "security:idle_timeout_minutes";
const IDLE_TIMEOUT_CACHE_TTL = 60; // seconds

async function getIdleTimeoutMinutes(): Promise<number> {
  if (redis) {
    try {
      const cached = await redis.get(IDLE_TIMEOUT_CACHE_KEY);
      if (cached !== null) return Number(cached);
    } catch { /* fall through */ }
  }

  const value = Number(await getSettingValue("idle_timeout_minutes", 0));
  const result = Number.isFinite(value) && value >= 0 ? value : 0;

  if (redis) {
    try { await redis.set(IDLE_TIMEOUT_CACHE_KEY, String(result), "EX", IDLE_TIMEOUT_CACHE_TTL); } catch { /* non-critical */ }
  }

  return result;
}

async function isIpBlocked(ip: string): Promise<boolean> {
  if (!ip || ip === "127.0.0.1") return false;

  if (redis) {
    try {
      const cached = await redis.get(IP_BLOCKLIST_CACHE_KEY);
      if (cached) {
        const list: string[] = JSON.parse(cached);
        return list.includes(ip);
      }
    } catch { /* fall through */ }
  }

  const rows = await prisma.ip_blocklist.findMany({ select: { ip_address: true } });
  const list = rows.map((r) => r.ip_address);

  if (redis) {
    try { await redis.set(IP_BLOCKLIST_CACHE_KEY, JSON.stringify(list), "EX", IP_BLOCKLIST_TTL); } catch { /* non-critical */ }
  }

  return list.includes(ip);
}

const publicRoutes = new Set([
  "/",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/register",
  "/api/auth/me",
  "/api/auth/refresh-token",
  "/api/auth/tfa-verify",
  "/api/auth/forgot-password",
  "/api/auth/password-policy",
  "/api/auth/reset-password",
  "/api/system-setting/identity",
  "/api/system-setting/registration/status",
  "/api/system-setting/regional/status",
  "/api/access-control/roles",   //  เพราะตัวระบบดึงrole ไปใส่ดรอปดาว
  "/api/access-control/roles-permissions", // เพราะตัวระบบดึงrole ไปใส่ดรอปดาว
  "/api/access-control/role-hierarchy", // เพราะตัวระบบดึงrole ไปใส่ดรอปดาว
  "/api/system-setting/maintenance/status",
]);

const publicRoutePrefixes = [
  "/uploads/",
];

function jsonResponse(status: number, message: string) {
  return new Response(
    JSON.stringify({
      success: false,
      message,
      timestamp: new Date().toISOString(),
    }),
    {
      status,
      headers: { "content-type": "application/json" },
    },
  );
}

function getCookieValues(cookieHeader: string, name: string) {
  return cookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.startsWith(`${name}=`))
    .map((part) => decodeURIComponent(part.slice(name.length + 1)))
    .filter(Boolean);
}

function getJwtExpiry(token: string) {
  try {
    const payload = token.split(".")[1];
    if (!payload) return 0;

    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return typeof decoded.exp === "number" ? decoded.exp : 0;
  } catch {
    return 0;
  }
}

function getNewestCookieValue(cookieHeader: string, name: string, fallback?: string) {
  const values = getCookieValues(cookieHeader, name);
  if (values.length === 0) return fallback;
  if (values.length === 1) return values[0];

  return values.sort((a, b) => getJwtExpiry(b) - getJwtExpiry(a))[0];
}

function pathMatches(routePattern: string, requestPath: string) {
  const routeParts = routePattern.split("/").filter(Boolean);
  const requestParts = requestPath.split("/").filter(Boolean);

  if (routeParts.length !== requestParts.length) {
    return false;
  }

  return routeParts.every((part, index) => {
    return part.startsWith(":") || part === requestParts[index];
  });
}

const ROUTE_CACHE_TTL = 300; // 5 min
type RouteRequirementRow = {
  path: string;
  role_id: string | null;
  permission_id: string | null;
  is_active: boolean;
};

function getAutoRegisterPath(path: string) {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  return `/${path
    .split("/")
    .filter(Boolean)
    .map((part) => (/^\d+$/.test(part) || uuidPattern.test(part) ? ":id" : part))
    .join("/")}`;
}

async function autoRegisterRouteRequirement(method: string, path: string) {
  const normalizedMethod = method.toUpperCase();
  const normalizedPath = getAutoRegisterPath(path);

  try {
    await prisma.api_route_requirements.upsert({
      where: {
        method_path: {
          method: normalizedMethod,
          path: normalizedPath,
        },
      },
      update: {},
      create: {
        method: normalizedMethod,
        path: normalizedPath,
        role_id: null,
        permission_id: null,
        is_active: false,
      },
    });

  if (redis) {
      try {
        await redis.del(`routes:${normalizedMethod}`);
      } catch { /* non-critical */ }
    }
  } catch (error) {
    console.warn(
      `[AuthMiddleware] Failed to auto-register route ${normalizedMethod} ${normalizedPath}:`,
      error,
    );
    ErrorLogUtil.log(error, {
      source: "auth-middleware:auto-register-route",
      requestMethod: normalizedMethod,
      requestPath: normalizedPath,
    });
  }
}

async function getRouteRequirement(method: string, path: string) {
  const cacheKey = `routes:${method.toUpperCase()}`;

  let routes: RouteRequirementRow[];

  if (redis) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        routes = JSON.parse(cached);
        const matched = routes.find((r) => pathMatches(r.path, path));
        if (!matched) await autoRegisterRouteRequirement(method, path);
        return matched?.is_active ? matched : null;
      }
    } catch { /* fall through */ }
  }

  routes = await prisma.api_route_requirements.findMany({
    where: { method: method.toUpperCase() },
    select: { path: true, role_id: true, permission_id: true, is_active: true },
  });

  if (redis) {
    try { await redis.set(cacheKey, JSON.stringify(routes), "EX", ROUTE_CACHE_TTL); } catch { /* non-critical */ }
  }

  const matched = routes.find((r) => pathMatches(r.path, path));
  if (!matched) await autoRegisterRouteRequirement(method, path);
  return matched?.is_active ? matched : null;
}

export const authMiddleware = new Elysia({ name: "auth-middleware" }).onRequest(
  async ({ request, set }) => {
    if (request.method === "OPTIONS") {
      return;
    }

    const url = new URL(request.url);
    const path = url.pathname;

    if (publicRoutes.has(path) || publicRoutePrefixes.some((prefix) => path.startsWith(prefix))) {
      return;
    }

    // ── IP Blocklist ───────────────────────────────────────────────────────────
    const clientIp = getClientIP(request);
    if (await isIpBlocked(clientIp)) {
      set.status = 403;
      return jsonResponse(403, "Access denied");
    }

    const authHeader = request.headers.get("authorization");
    const cookieHeader = request.headers.get("cookie") ?? "";
    const cookies = parse(cookieHeader);

    // ── PAT auth: Bearer pat_xxx ───────────────────────────────────────────────
    if (authHeader?.startsWith("Bearer pat_")) {
      const rawToken = authHeader.slice(7).trim();
      const pat = await PersonalAccessTokenService.validateToken(rawToken);
      if (!pat) {
        set.status = 401;
        return jsonResponse(401, "Invalid or expired personal access token");
      }

      // ดึง roles + permissions ของ user
      const userRoleRows = await prisma.user_roles.findMany({
        where: { user_id: pat.userId },
        select: { role_id: true },
      });
      const directRoleIds = userRoleRows.map((ur) => ur.role_id);
      const roles = directRoleIds;
      const permissions = await getPermissionIdsForRoles(directRoleIds);

      // ตรวจ route requirement เหมือน cookie auth
      const routeRequirement = await getRouteRequirement(request.method, path);
      if (routeRequirement?.role_id && !roles.includes(routeRequirement.role_id)) {
        set.status = 403;
        return jsonResponse(403, "Insufficient role");
      }
      if (routeRequirement?.permission_id && !hasPermission(routeRequirement.permission_id, permissions)) {
        set.status = 403;
        return jsonResponse(403, "Insufficient permission");
      }

      request.headers.set("x-user-data", JSON.stringify({
        id: pat.userId,
        username: pat.username,
        email: pat.email,
        roles,
        sessionId: null,
        permissions,
        profile: null,
      }));
      request.headers.set("x-user-id", pat.userId.toString());
      request.headers.set("x-user-username", pat.username);
      request.headers.set("x-pat-id", pat.patId.toString());
      return; // ผ่าน
    }

    // ── Bearer ที่ไม่ใช่ PAT → ปฏิเสธ (ไม่รับ cookie token ผ่าน header) ────────
    if (authHeader?.startsWith("Bearer ")) {
      set.status = 401;
      return jsonResponse(401, "Bearer token must be a Personal Access Token (pat_...)");
    }

    // ── Cookie auth ────────────────────────────────────────────────────────────
    const token = getNewestCookieValue(cookieHeader, "accessToken", cookies.accessToken);

    if (!token) {
      set.status = 401;
      return jsonResponse(401, "Authentication token is required");
    }

    try {
      const payload = await verifyToken(token);
      const userId = Number(payload.id);

      if (!Number.isInteger(userId)) {
        throw new Error("Invalid token payload");
      }

      let session = await prisma.session.findFirst({
        where: {
          user_id: userId,
          access_token: token,
          is_active: true,
          expires_at: { gt: new Date() },
        },
      });

      if (!session && cookies.refreshToken) {
        session = await prisma.session.findFirst({
          where: {
            user_id: userId,
            refresh_token: getNewestCookieValue(cookieHeader, "refreshToken", cookies.refreshToken),
            is_active: true,
            expires_at: { gt: new Date() },
          },
        });
      }

      if (!session) {
        throw new Error("Session expired");
      }

      // ── Idle timeout ─────────────────────────────────────────────────────────
      const idleTimeoutMinutes = await getIdleTimeoutMinutes();
      if (idleTimeoutMinutes > 0 && session.last_used_at) {
        const idleMs = Date.now() - session.last_used_at.getTime();
        if (idleMs > idleTimeoutMinutes * 60 * 1000) {
          await prisma.session.update({
            where: { id: session.id },
            data: { is_active: false, revocation_reason: "IDLE_TIMEOUT", updated_at: new Date() },
          });
          throw new Error("Session expired due to inactivity");
        }
      }

      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: {
          id: true,
          username: true,
          email: true,
          is_active: true,
          is_deleted: true,
          profile: {
            select: {
              first_name: true,
              last_name: true,
              display_name: true,
              avatar_url: true,
            },
          },
          user_roles_user_roles_user_idTousers: {
            select: {
              roles: {
                select: { id: true },
              },
            },
          },
        },
      });

      if (!user || user.is_deleted) {
        throw new Error("User not found");
      }

      if (!user.is_active) {
        throw new Error("User account is suspended");
      }

      const directRoleIds = user.user_roles_user_roles_user_idTousers.map(
        (userRole) => userRole.roles.id,
      );

      const roles = directRoleIds;
      const permissions = await getPermissionIdsForRoles(directRoleIds);

      const routeRequirement = await getRouteRequirement(request.method, path);
      if (routeRequirement?.role_id && !roles.includes(routeRequirement.role_id)) {
        set.status = 403;
        return jsonResponse(403, "Insufficient role");
      }

      if (routeRequirement?.permission_id && !hasPermission(routeRequirement.permission_id, permissions)) {
        set.status = 403;
        return jsonResponse(403, "Insufficient permission");
      }

      await prisma.session.update({
        where: { id: session.id },
        data: { last_used_at: new Date() },
      });

      const userData = {
        id: user.id,
        username: user.username,
        email: user.email,
        roles,
        sessionId: session.id,
        permissions,
        profile: user.profile,
      };

      request.headers.set("x-user-data", JSON.stringify(userData));
      request.headers.set("x-user-id", user.id.toString());
      request.headers.set("x-user-username", user.username);
      request.headers.set("x-session-id", session.id.toString());
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Authentication failed";

      try {
        await prisma.request_logs.create({
          data: {
            method: request.method,
            url: request.url,
            path,
            query_params: url.search || null,
            user_id: null,
            username: null,
            ip_address: getClientIP(request),
            user_agent: request.headers.get("user-agent"),
            browser: "Unknown",
            os: "Unknown",
            device_type: "Unknown",
            platform: "Web",
            status_code: 401,
            error_message: message,
            referer: request.headers.get("referer"),
            session_id: null,
          },
        });
      } catch (logError) {
        console.warn("Failed to log auth error:", logError);
      }

      set.status = 401;
      return jsonResponse(401, message);
    }
  },
);
