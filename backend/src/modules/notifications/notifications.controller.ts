import { Elysia, t } from "elysia";
import { NotificationInboxService } from "@/services/notification-inbox.service";
import { getCurrentUserFromHeaders } from "@/utils/get-current-user";
import { sseSubscribe, sseUnsubscribe } from "@/utils/notification-sse";

const encoder = new TextEncoder();

export const notificationsController = new Elysia({ prefix: "/notifications" })
  .get("/sse", ({ request }) => {
    const user = getCurrentUserFromHeaders(request);
    if (!user) {
      return new Response(JSON.stringify({ success: false, message: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const userId = user.id;
    let heartbeatTimer: ReturnType<typeof setInterval>;

    const stream = new ReadableStream({
      start(ctrl) {
        sseSubscribe(userId, ctrl);
        ctrl.enqueue(encoder.encode(": connected\n\n"));

        heartbeatTimer = setInterval(() => {
          try {
            ctrl.enqueue(encoder.encode(": heartbeat\n\n"));
          } catch {
            clearInterval(heartbeatTimer);
          }
        }, 30_000);

        request.signal.addEventListener("abort", () => {
          clearInterval(heartbeatTimer);
          sseUnsubscribe(userId, ctrl);
          try { ctrl.close(); } catch { /* already closed */ }
        });
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  })
  .get("/", async ({ request, query, set }) => {
    const user = getCurrentUserFromHeaders(request);
    if (!user) {
      set.status = 401;
      return { success: false, message: "Unauthorized" };
    }
    return NotificationInboxService.list(user.id, {
      page: query.page ? Number(query.page) : undefined,
      pageSize: query.pageSize ? Number(query.pageSize) : undefined,
      search: query.search || undefined,
      type: query.type || undefined,
      status: query.status as "all" | "read" | "unread" | undefined,
      sort: query.sort as "newest" | "oldest" | undefined,
    });
  }, {
    query: t.Object({
      page: t.Optional(t.String()),
      pageSize: t.Optional(t.String()),
      search: t.Optional(t.String()),
      type: t.Optional(t.String()),
      status: t.Optional(t.String()),
      sort: t.Optional(t.String()),
    }),
  })
  .patch("/read-all", async ({ request, set }) => {
    const user = getCurrentUserFromHeaders(request);
    if (!user) {
      set.status = 401;
      return { success: false, message: "Unauthorized" };
    }
    return NotificationInboxService.markAllRead(user.id);
  })
  .patch("/:id/read", async ({ request, params, set }) => {
    const user = getCurrentUserFromHeaders(request);
    if (!user) {
      set.status = 401;
      return { success: false, message: "Unauthorized" };
    }
    const result = await NotificationInboxService.markRead(user.id, Number(params.id));
    if (!result.success && "status" in result) {
      set.status = result.status;
    }
    return result;
  }, {
    params: t.Object({ id: t.String() }),
  });
