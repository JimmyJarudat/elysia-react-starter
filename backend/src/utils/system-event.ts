import prisma from '@/config/prisma.config';
import { serializeLogValue } from '@/utils/log-serializer';

type EventType = 'CRON' | 'CACHE' | 'EMAIL' | 'QUEUE' | 'STARTUP' | 'SHUTDOWN' | 'BACKUP' | 'SYSTEM' | 'SMTP' | 'REDIS' | 'STORAGE' | 'LDAP';
type EventStatus = 'success' | 'failed' | 'running' | 'skipped';

interface SystemEventData {
  eventType: EventType;
  eventName: string;
  status: EventStatus;
  durationMs?: number | null;
  message?: string | null;
  details?: unknown;
  triggeredBy?: string;
}

export class SystemEventUtil {
  static log(data: SystemEventData): void {
    void prisma.system_events.create({
      data: {
        event_type: data.eventType,
        event_name: data.eventName,
        status: data.status,
        duration_ms: data.durationMs ?? null,
        message: data.message ?? null,
        details: serializeLogValue(data.details, 4000),
        triggered_by: data.triggeredBy ?? 'system',
      },
    }).catch(() => {});
  }

  static success(eventType: EventType, eventName: string, durationMs?: number, details?: unknown): void {
    this.log({ eventType, eventName, status: 'success', durationMs, details });
  }

  static failed(eventType: EventType, eventName: string, message: string, details?: unknown): void {
    this.log({ eventType, eventName, status: 'failed', message, details });
  }
}
