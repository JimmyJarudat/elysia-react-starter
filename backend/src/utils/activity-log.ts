import prisma from '@/config/prisma.config';

type ActivityAction =
  | 'CREATE' | 'UPDATE' | 'DELETE' | 'VIEW' | 'EXPORT' | 'IMPORT'
  | 'ENABLE' | 'DISABLE' | 'APPROVE' | 'REJECT' | 'RESTORE'
  | 'LOCK' | 'UNLOCK' | 'REVOKE' | 'CLONE'
  | 'RESET_PASSWORD' | 'CHANGE_PASSWORD' | 'FORCE_LOGOUT';

interface ActivityLogData {
  userId?: number | null;
  username?: string | null;
  action: ActivityAction;
  resourceType: string;
  resourceId?: string | number | null;
  description?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  status?: 'success' | 'failed';
  metadata?: unknown;
}

export class ActivityLogUtil {
  static log(data: ActivityLogData): void {
    void prisma.activity_logs.create({
      data: {
        user_id: data.userId ?? null,
        username: data.username ?? null,
        action: data.action,
        resource_type: data.resourceType,
        resource_id: data.resourceId != null ? String(data.resourceId) : null,
        description: data.description ?? null,
        ip_address: data.ipAddress ?? null,
        user_agent: data.userAgent ?? null,
        status: data.status ?? 'success',
        metadata: data.metadata != null ? JSON.stringify(data.metadata) : null,
      },
    }).catch(() => {});
  }
}
