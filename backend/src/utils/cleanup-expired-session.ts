// src/services/session/sessionCleanupService.ts
import prisma from "@/config/prisma.config";
import { ErrorLogUtil } from "@/utils/error-log";

export class SessionCleanupService {
  /**
   * ย้าย session ที่หมดอายุหรือไม่ active ไปยัง history
   */
  static async moveExpiredSessionsToHistory() {
    try {
      // 1. ค้นหา session ที่ต้องย้าย (หมดอายุหรือไม่ active)
      const sessionsToMove = await prisma.session.findMany({
        where: {
          OR: [
            { expires_at: { lte: new Date() } }, // หมดอายุ
            { is_active: false } // ไม่ active
          ]
        }
      });

      // 2. ย้ายแต่ละ session ไปยัง history
      for (const session of sessionsToMove) {
        await prisma.$transaction([
          // สร้าง record ใน history (ไม่ต้องระบุ id เพราะ auto increment)
          prisma.session_history.create({
            data: {
              user_id: session.user_id,
              access_token: session.access_token,
              refresh_token: session.refresh_token,
              ip_address: session.ip_address,
              user_agent: session.user_agent,
              device_info: session.device_info,
              location: session.location,
              login_source: session.login_source,
              session_type: session.session_type,
              is_active: session.is_active,
              status: session.is_active ? 'EXPIRED' : 'REVOKED',
              revocation_reason: session.revocation_reason,
              created_at: session.created_at,
              expired_at: session.expires_at,
              last_used_at: session.last_used_at,
              moved_to_history_at: new Date() // ใช้ค่า default หรือระบุเอง
            }
          }),
          // ลบจากตาราง session ปัจจุบัน
          prisma.session.delete({
            where: { id: session.id }
          })
        ]);
      }

      return {
        success: true,
        movedCount: sessionsToMove.length
      };
    } catch (error) {
      console.error('Session cleanup error:', error);
      ErrorLogUtil.log(error, { source: 'session-cleanup:move-expired' });
      return {
        success: false,
        error: 'Failed to move sessions to history'
      };
    }
  }

  /**
   * ตรวจสอบและอัพเดท session ที่หมดอายุ
   */
  static async checkAndExpireSessions() {
    try {
      // อัพเดท session ที่หมดอายุแต่ยัง active อยู่
      const result = await prisma.session.updateMany({
        where: {
          expires_at: { lte: new Date() },
          is_active: true
        },
        data: {
          is_active: false,
          updated_at: new Date(),
          revocation_reason: 'Session expired'
        }
      });

      return {
        success: true,
        expiredCount: result.count
      };
    } catch (error) {
      console.error('Session expiration error:', error);
      ErrorLogUtil.log(error, { source: 'session-cleanup:expire-sessions' });
      return {
        success: false,
        error: 'Failed to expire sessions'
      };
    }
  }

  /**
   * ทำความสะอาด session history เก่า (ลบข้อมูลที่เก่ากว่า X วัน)
   */
  static async cleanupOldSessionHistory(daysToKeep: number = 90) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const result = await prisma.session_history.deleteMany({
        where: {
          moved_to_history_at: {
            lt: cutoffDate
          }
        }
      });

      return {
        success: true,
        deletedCount: result.count
      };
    } catch (error) {
      console.error('Session history cleanup error:', error);
      ErrorLogUtil.log(error, { source: 'session-cleanup:delete-old-history', context: { daysToKeep } });
      return {
        success: false,
        error: 'Failed to cleanup old session history'
      };
    }
  }

  /**
   * รันกระบวนการทำความสะอาดแบบครบชุด
   */
  static async runFullCleanup(historyRetentionDays: number = 90) {
    try {
      console.log('Starting session cleanup...');

      // 1. ตรวจสอบและ expire sessions ที่หมดอายุ
      const expireResult = await this.checkAndExpireSessions();
      console.log(`Expired ${expireResult.expiredCount || 0} sessions`);

      // 2. ย้าย expired/inactive sessions ไป history
      const moveResult = await this.moveExpiredSessionsToHistory();
      console.log(`Moved ${moveResult.movedCount || 0} sessions to history`);

      // 3. ทำความสะอาด history เก่า
      const cleanupResult = await this.cleanupOldSessionHistory(historyRetentionDays);
      console.log(`Deleted ${cleanupResult.deletedCount || 0} old history records`);

      return {
        success: true,
        summary: {
          expiredSessions: expireResult.expiredCount || 0,
          movedToHistory: moveResult.movedCount || 0,
          deletedHistory: cleanupResult.deletedCount || 0
        }
      };
    } catch (error) {
      console.error('Full cleanup error:', error);
      ErrorLogUtil.log(error, { source: 'session-cleanup:full', context: { historyRetentionDays } });
      return {
        success: false,
        error: 'Failed to complete full cleanup'
      };
    }
  }

  /**
   * ปิด session ทั้งหมดของ user (สำหรับ logout all devices)
   */
  static async revokeAllUserSessions(userId: number, reason: string = 'User logout all devices') {
    try {
      const result = await prisma.session.updateMany({
        where: {
          user_id: userId,
          is_active: true
        },
        data: {
          is_active: false,
          updated_at: new Date(),
          revocation_reason: reason
        }
      });

      return {
        success: true,
        revokedCount: result.count
      };
    } catch (error) {
      console.error('Revoke user sessions error:', error);
      ErrorLogUtil.log(error, { source: 'session-cleanup:revoke-user-sessions', userId });
      return {
        success: false,
        error: 'Failed to revoke user sessions'
      };
    }
  }

  /**
   * ปิด session เฉพาะ (สำหรับ logout specific device)
   */
  static async revokeSession(sessionId: number, reason: string = 'User logout') {
    try {
      const result = await prisma.session.update({
        where: { id: sessionId },
        data: {
          is_active: false,
          updated_at: new Date(),
          revocation_reason: reason
        }
      });

      return {
        success: true,
        session: result
      };
    } catch (error) {
      console.error('Revoke session error:', error);
      ErrorLogUtil.log(error, { source: 'session-cleanup:revoke-session', context: { sessionId } });
      return {
        success: false,
        error: 'Failed to revoke session'
      };
    }
  }
}
