import { Elysia } from "elysia";
import prisma from "@/config/prisma.config";
import { verifyToken } from "@/services/jwt.service";
import { getClientIP } from "@/utils/clientInfo";

const publicRoutes = new Set([
  "/",
  "/api/auth/login",
]);

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

async function getRouteRequirement(method: string, path: string) {
  const routes = await prisma.api_route_requirements.findMany({
    where: {
      method: method.toUpperCase(),
      is_active: true,
    },
  });

  return routes.find((route) => pathMatches(route.path, path)) ?? null;
}

export const authMiddleware = new Elysia({ name: "auth-middleware" }).onRequest(
  async ({ request, set }) => {
    if (request.method === "OPTIONS") {
      return;
    }

    const url = new URL(request.url);
    const path = url.pathname;

    if (publicRoutes.has(path)) {
      return;
    }

    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      set.status = 401;
      return jsonResponse(401, "Authorization header is required");
    }

    const token = authHeader.slice("Bearer ".length).trim();

    try {
      const payload = await verifyToken(token);
      const userId = Number(payload.id);

      if (!Number.isInteger(userId)) {
        throw new Error("Invalid token payload");
      }

      const session = await prisma.session.findFirst({
        where: {
          user_id: userId,
          access_token: token,
          is_active: true,
          expires_at: { gt: new Date() },
        },
      });

      if (!session) {
        throw new Error("Session expired");
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
                select: {
                  id: true,
                  role_permissions: {
                    select: {
                      permissions: {
                        select: {
                          id: true,
                          name: true,
                        },
                      },
                    },
                  },
                },
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

      const roles = user.user_roles_user_roles_user_idTousers.map(
        (userRole) => userRole.roles.id,
      );
      const permissions = Array.from(
        new Set(
          user.user_roles_user_roles_user_idTousers.flatMap((userRole) =>
            userRole.roles.role_permissions.map(
              (rolePermission) => rolePermission.permissions.id,
            ),
          ),
        ),
      );

      const routeRequirement = await getRouteRequirement(request.method, path);
      if (routeRequirement?.role_id && !roles.includes(routeRequirement.role_id)) {
        set.status = 403;
        return jsonResponse(403, "Insufficient role");
      }

      if (
        routeRequirement?.permission_id &&
        !permissions.includes(routeRequirement.permission_id)
      ) {
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
