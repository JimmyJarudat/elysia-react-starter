import prisma from '@/config/prisma.config';

type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE';

interface AuditLogData {
  userId?: number | null;
  username?: string | null;
  action: AuditAction;
  tableName: string;
  recordId: string | number;
  beforeData?: unknown;
  afterData?: unknown;
  changedFields?: string[];
  ipAddress?: string | null;
  requestId?: string | null;
}

export function getChangedFields(before: Record<string, unknown>, after: Record<string, unknown>): string[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changed: string[] = [];
  for (const key of keys) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) changed.push(key);
  }
  return changed;
}

export class AuditLogUtil {
  static log(data: AuditLogData): void {
    const changedFields = data.changedFields
      ?? (
        data.beforeData != null
        && data.afterData != null
        && typeof data.beforeData === 'object'
        && typeof data.afterData === 'object'
        && !Array.isArray(data.beforeData)
        && !Array.isArray(data.afterData)
          ? getChangedFields(
              data.beforeData as Record<string, unknown>,
              data.afterData as Record<string, unknown>,
            )
          : []
      );

    void prisma.audit_logs.create({
      data: {
        user_id: data.userId ?? null,
        username: data.username ?? null,
        action: data.action,
        table_name: data.tableName,
        record_id: String(data.recordId),
        before_data: data.beforeData != null ? JSON.stringify(data.beforeData) : null,
        after_data: data.afterData != null ? JSON.stringify(data.afterData) : null,
        changed_fields: changedFields.length > 0 ? changedFields.join(',') : null,
        ip_address: data.ipAddress ?? null,
        request_id: data.requestId ?? null,
      },
    }).catch(() => {});
  }
}
