import prisma from '@/config/prisma.config';
import { serializeLogValue } from '@/utils/log-serializer';

type ErrorLevel = 'warn' | 'error' | 'fatal';

interface ErrorLogData {
  level?: ErrorLevel;
  message: string;
  stackTrace?: string | null;
  source?: string;
  code?: string;
  userId?: number | null;
  username?: string | null;
  requestPath?: string | null;
  requestMethod?: string | null;
  ipAddress?: string | null;
  context?: unknown;
}

export class ErrorLogUtil {
  static log(error: unknown, extra?: Omit<ErrorLogData, 'message' | 'stackTrace'>): void {
    let message = 'Unknown error';
    let stackTrace: string | null = null;

    if (error instanceof Error) {
      message = error.message;
      stackTrace = error.stack ?? null;
    } else if (typeof error === 'string') {
      message = error;
    } else if (error != null && typeof error === 'object' && 'message' in error) {
      message = String((error as { message: unknown }).message);
    }

    void prisma.error_logs.create({
      data: {
        level: extra?.level ?? 'error',
        message,
        stack_trace: stackTrace,
        source: extra?.source ?? null,
        code: extra?.code ?? null,
        user_id: extra?.userId ?? null,
        username: extra?.username ?? null,
        request_path: extra?.requestPath ?? null,
        request_method: extra?.requestMethod ?? null,
        ip_address: extra?.ipAddress ?? null,
        context: serializeLogValue(extra?.context, 4000),
      },
    }).catch(() => {});
  }

  static warn(message: string, extra?: Omit<ErrorLogData, 'message' | 'stackTrace' | 'level'>): void {
    this.log(message, { ...extra, level: 'warn' });
  }
}
