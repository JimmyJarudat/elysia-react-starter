import { Elysia } from 'elysia';
import { getCurrentUserFromHeaders } from '@/utils/get-current-user';
import { getClientInfo } from '@/utils/clientInfo';
import type { ClientInfo } from '@/utils/clientInfo';
import prisma from '@/config/prisma.config';
import { ErrorLogUtil } from '@/utils/error-log';

// ── Paths/methods ที่ไม่บันทึก ────────────────────────────────────────────────

const EXCLUDED_PATHS = new Set([
  // ── auto-called ทุก page load / render ────────────────────────────────────
  '/api/auth/me',                           // session restore
  '/api/menus/me',                          // sidebar menu
  '/api/system-setting/identity',           // system name header
  '/api/system-setting/maintenance/status', // maintenance mode check
  '/api/system-setting/regional/status',    // locale/timezone
  '/api/system-setting/notification-sound', // notification sound setting
  '/api/account-security/notifications',    // user notification preferences
  // ── long-lived / streaming ────────────────────────────────────────────────
  '/api/notifications/sse',                 // SSE stream
  '/api/logs/live-console/stream',          // SSE stream
  // ── static / non-API ─────────────────────────────────────────────────────
  '/',
  '/favicon.ico',
  '/robots.txt',
]);

const EXCLUDED_PREFIXES = ['/uploads/'];

function shouldSkip(method: string, pathname: string): boolean {
  if (method === 'OPTIONS') return true;
  if (EXCLUDED_PATHS.has(pathname)) return true;
  if (EXCLUDED_PREFIXES.some((p) => pathname.startsWith(p))) return true;
  return false;
}

// ── Background queue ──────────────────────────────────────────────────────────

type LogRow = {
  timestamp: Date;
  method: string;
  url: string;
  path: string;
  query_params: string | null;
  user_id: number | null;
  username: string | null;
  ip_address: string;
  user_agent: string | null;
  browser: string;
  os: string;
  device_type: string;
  platform: string;
  status_code: number;
  response_time: number;
  request_size: number | null;
  error_message: string | null;
  error_stack: string | null;
  referer: string | null;
  session_id: string | null;
};

const queue: LogRow[] = [];
let flushing = false;

async function flushQueue() {
  if (flushing || queue.length === 0) return;
  flushing = true;
  try {
    while (queue.length > 0) {
      const batch = queue.splice(0, 50);
      await prisma.request_logs.createMany({ data: batch }).catch(() => {}); // silent fail
    }
  } finally {
    flushing = false;
  }
}

setInterval(flushQueue, 5_000);

function enqueue(row: LogRow) {
  queue.push(row);
  if (queue.length >= 10) void flushQueue();
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function calcRequestSize(request: Request): number | null {
  try {
    let size = Buffer.byteLength(request.url, 'utf8');
    request.headers.forEach((val, key) => { size += Buffer.byteLength(`${key}: ${val}\r\n`, 'utf8'); });
    return size;
  } catch { return null; }
}

function buildRow(
  timing: { startTime: number; request: Request; method: string; url: string; path: string },
  statusCode: number,
  errorMessage: string | null,
  errorStack: string | null,
): LogRow {
  let user: { id: number; username: string } | null = null;
  let client: ClientInfo = { ip_address: '127.0.0.1', user_agent: null, browser: 'Unknown', os: 'Unknown', device_type: 'Unknown', platform: 'Unknown' };
  try { user = getCurrentUserFromHeaders(timing.request); } catch {}
  try { client = getClientInfo(timing.request); } catch {}

  const { search } = new URL(timing.url);

  return {
    timestamp: new Date(),
    method: timing.method,
    url: timing.url,
    path: timing.path,
    query_params: search || null,
    user_id: user?.id ?? null,
    username: user?.username ?? null,
    ip_address: client.ip_address,
    user_agent: client.user_agent,
    browser: client.browser,
    os: client.os,
    device_type: client.device_type,
    platform: client.platform,
    status_code: statusCode,
    response_time: Date.now() - timing.startTime,
    request_size: calcRequestSize(timing.request),
    error_message: errorMessage,
    error_stack: errorStack,
    referer: timing.request.headers.get('referer'),
    session_id: timing.request.headers.get('x-session-id'),
  };
}

// ── Timing store ──────────────────────────────────────────────────────────────

type Timing = { startTime: number; request: Request; method: string; url: string; path: string };
const timings = new Map<string, Timing>();

// ── Plugin ────────────────────────────────────────────────────────────────────

export const requestLoggerPlugin = new Elysia({ name: 'request-logger' })
  .derive({ as: 'global' }, ({ request }) => {
    const { pathname } = new URL(request.url);
    if (shouldSkip(request.method, pathname)) return { _rltk: null as string | null };

    const key = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    timings.set(key, { startTime: Date.now(), request, method: request.method, url: request.url, path: pathname });
    setTimeout(() => timings.delete(key), 30_000); // cleanup stuck requests
    return { _rltk: key };
  })
  .onAfterHandle({ as: 'global' }, ({ set, _rltk }) => {
    if (!_rltk) return;
    const timing = timings.get(_rltk);
    if (!timing) return;
    timings.delete(_rltk);
    enqueue(buildRow(timing, Number(set.status) || 200, null, null));
  })
  .onError({ as: 'global' }, ({ error, set, _rltk, request }) => {
    let statusCode = Number(set.status) || 500;
    let errorMessage = 'Internal Server Error';
    let errorStack: string | null = null;

    if (error instanceof Error) {
      errorMessage = error.message;
      errorStack = error.stack ?? null;
    } else if (typeof error === 'object' && error !== null && 'message' in error) {
      errorMessage = String((error as { message: unknown }).message);
    }
    if (typeof error === 'object' && error !== null && 'status' in error) {
      statusCode = Number((error as { status: unknown }).status) || statusCode;
    }

    const timing = _rltk ? timings.get(_rltk) : undefined;
    if (_rltk) timings.delete(_rltk);
    if (timing) enqueue(buildRow(timing, statusCode, errorMessage, errorStack));

    if (statusCode >= 500) {
      let user: { id: number; username: string } | null = null;
      let client: ClientInfo | null = null;
      try { user = getCurrentUserFromHeaders(request); } catch {}
      try { client = getClientInfo(request); } catch {}
      const requestUrl = new URL(request.url);

      ErrorLogUtil.log(error, {
        source: 'request-logger',
        code: String(statusCode),
        userId: user?.id,
        username: user?.username,
        requestPath: requestUrl.pathname,
        requestMethod: request.method,
        ipAddress: client?.ip_address,
        context: {
          url: request.url,
          responseTimeMs: timing ? Date.now() - timing.startTime : null,
        },
      });
    }
  });

// ── Exports ────────────────────────────────────────────────────────────────────

export const getLogQueueStatus = () => ({
  queueLength: queue.length,
  isProcessing: flushing,
  activeRequests: timings.size,
});

export const flushLogQueue = () => flushQueue();
