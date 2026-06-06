import prisma from '@/config/prisma.config';
import { PasswordUtil } from '@/utils/password';
import { getOnlineUserIds } from '@/utils/online-presence';
import { formatSystemDate } from '@/utils/date-formatter';
import { UserRegistrationEmailService } from '@/templates/email/new-user-notification-for-admin';
import { WelcomeEmailService } from '@/templates/email/new-user-notification-for-user';
import { NotificationService } from '@/services/notification.service';
import { ActivityLogUtil } from '@/utils/activity-log';
import { AuditLogUtil, getChangedFields } from '@/utils/audit-log';

export class UsersService {
  static async createUser(body: {
    username: string;
    email: string;
    password: string;
    firstName?: string | null;
    lastName?: string | null;
    displayName?: string | null;
    phoneNumber?: string | null;
    department?: string | null;
    groupName?: string | null;
    roleIds?: string[];
    isActive?: boolean;
    isApproved?: boolean;
    isEmailVerified?: boolean;
    mustChangePassword?: boolean;
  }, createdByUserId?: number) {
    // ตรวจสอบว่า role ที่ assign ไม่สูงกว่า priority ของ creator
    if (body.roleIds && body.roleIds.length > 0 && createdByUserId) {
      const creatorRoleRows = await prisma.user_roles.findMany({
        where: { user_id: createdByUserId },
        select: { roles: { select: { priority: true } } },
      });
      const creatorMaxPriority = creatorRoleRows.reduce(
        (max, r) => Math.max(max, r.roles.priority ?? 0), 0
      );

      const requestedRoles = await prisma.roles.findMany({
        where: { id: { in: body.roleIds } },
        select: { id: true, name: true, priority: true },
      });
      const tooHigh = requestedRoles.find((r) => (r.priority ?? 0) > creatorMaxPriority);
      if (tooHigh) {
        throw new Error(`ไม่สามารถ assign role "${tooHigh.name}" ที่มี priority สูงกว่าของคุณได้`);
      }
    }

    const existing = await prisma.users.findFirst({
      where: { OR: [{ username: body.username }, { email: body.email }] },
      select: { username: true, email: true },
    });
    if (existing) {
      const field = existing.username === body.username ? 'username' : 'email';
      throw new Error(`${field} already exists`);
    }

    const passwordHash = await PasswordUtil.hash(body.password);

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.users.create({
        data: {
          username: body.username.trim(),
          email: body.email.trim().toLowerCase(),
          password: passwordHash,
          group_name: body.groupName?.trim() || null,
          is_active: body.isActive ?? true,
          is_approved: body.isApproved ?? true,
          is_email_verified: body.isEmailVerified ?? true,
          must_change_password: body.mustChangePassword ?? false,
          creation_type: 'ADMIN_CREATED',
        },
      });

      if (body.firstName || body.lastName || body.displayName || body.phoneNumber || body.department) {
        await tx.profile.create({
          data: {
            user_id: created.id,
            first_name: body.firstName?.trim() || null,
            last_name: body.lastName?.trim() || null,
            display_name: body.displayName?.trim() || null,
            phone_number: body.phoneNumber?.trim() || null,
            department: body.department?.trim() || null,
          },
        });
      }

      if (body.roleIds && body.roleIds.length > 0) {
        await tx.user_roles.createMany({
          data: body.roleIds.map((role_id) => ({ user_id: created.id, role_id })),
        });
      }

      await tx.notification_settings.create({
        data: {
          user_id: created.id,
          login_notifications: true,
          security_notifications: true,
          system_notifications: true,
          email_notifications: true,
          sound_notifications: true,
        },
      });

      return created;
    });

    const roleLabel = body.roleIds?.[0] ?? 'ไม่ระบุ';
    const createdAt = await formatSystemDate();

    // ส่งอีเมลแบบ background ไม่บล็อก response
    setTimeout(async () => {
      console.log(`[createUser] Sending notifications for user: ${user.username}`);

      try {
        const adminResult = await UserRegistrationEmailService.notifyNewUserRegistration({
          username: user.username,
          email: user.email,
          role: roleLabel,
          created_at: createdAt,
        });
        console.log(`[createUser] Admin notify: ${adminResult.emailsSent} emails sent`);
      } catch (err) {
        console.error('[createUser] admin notify error:', err);
      }

      try {
        const welcomeResult = await WelcomeEmailService.sendWelcomeEmail({
          username: user.username,
          email: user.email,
          temporary_password: body.password,
          role: roleLabel,
          created_at: createdAt,
        });
        console.log(`[createUser] Welcome email: ${welcomeResult.success ? 'sent' : 'failed'}`);
      } catch (err) {
        console.error('[createUser] welcome email error:', err);
      }
    }, 0);

    ActivityLogUtil.log({
      userId: createdByUserId,
      action: 'CREATE',
      resourceType: 'users',
      resourceId: user.id,
      description: `สร้างผู้ใช้ ${user.username}`,
    });
    AuditLogUtil.log({
      userId: createdByUserId,
      action: 'CREATE',
      tableName: 'users',
      recordId: user.id,
      afterData: { username: user.username, email: user.email, is_active: body.isActive ?? true, is_approved: body.isApproved ?? true, roles: body.roleIds ?? [] },
    });

    return { success: true, data: { id: user.id, username: user.username, email: user.email } };
  }

  static async getUserById(id: number) {
    const user = await prisma.users.findUnique({
      where: { id, is_deleted: false },
      select: {
        id: true, username: true, email: true, group_name: true,
        is_active: true, is_approved: true, is_email_verified: true,
        must_change_password: true, failed_login_attempts: true,
        locked_until: true, last_login: true, created_at: true,
        recovery_email: true, temporary_account: true, account_expiry: true,
        remarks: true,
        profile: { select: { first_name: true, last_name: true, display_name: true, phone_number: true, department: true, avatar_url: true } },
        user_roles_user_roles_user_idTousers: { select: { role_id: true } },
      },
    });
    if (!user) throw new Error('User not found');
    return { success: true, data: user };
  }

  static async updateUser(id: number, body: {
    username?: string; email?: string; groupName?: string | null;
    firstName?: string | null; lastName?: string | null; displayName?: string | null;
    phoneNumber?: string | null; department?: string | null;
    isActive?: boolean; isApproved?: boolean; isEmailVerified?: boolean; mustChangePassword?: boolean;
    recoveryEmail?: string | null; temporaryAccount?: boolean; accountExpiry?: string | null;
    remarks?: string | null;
  }, actorId?: number) {
    const before = await prisma.users.findUnique({
      where: { id },
      select: { username: true, email: true, group_name: true, is_active: true, is_approved: true, is_email_verified: true, must_change_password: true, recovery_email: true, temporary_account: true, account_expiry: true, remarks: true },
    });

    await prisma.$transaction(async (tx) => {
      await tx.users.update({
        where: { id },
        data: {
          ...(body.username !== undefined && { username: body.username.trim() }),
          ...(body.email !== undefined && { email: body.email.trim().toLowerCase() }),
          ...(body.groupName !== undefined && { group_name: body.groupName }),
          ...(body.isActive !== undefined && { is_active: body.isActive }),
          ...(body.isApproved !== undefined && { is_approved: body.isApproved }),
          ...(body.isEmailVerified !== undefined && { is_email_verified: body.isEmailVerified }),
          ...(body.mustChangePassword !== undefined && { must_change_password: body.mustChangePassword }),
          ...(body.recoveryEmail !== undefined && { recovery_email: body.recoveryEmail }),
          ...(body.temporaryAccount !== undefined && { temporary_account: body.temporaryAccount }),
          ...(body.accountExpiry !== undefined && { account_expiry: body.accountExpiry ? new Date(body.accountExpiry) : null }),
          ...(body.remarks !== undefined && { remarks: body.remarks }),
          updated_at: new Date(),
        },
      });

      if (body.firstName !== undefined || body.lastName !== undefined || body.displayName !== undefined || body.phoneNumber !== undefined || body.department !== undefined) {
        await tx.profile.upsert({
          where: { user_id: id },
          create: {
            user_id: id,
            first_name: body.firstName ?? null,
            last_name: body.lastName ?? null,
            display_name: body.displayName ?? null,
            phone_number: body.phoneNumber ?? null,
            department: body.department ?? null,
          },
          update: {
            ...(body.firstName !== undefined && { first_name: body.firstName }),
            ...(body.lastName !== undefined && { last_name: body.lastName }),
            ...(body.displayName !== undefined && { display_name: body.displayName }),
            ...(body.phoneNumber !== undefined && { phone_number: body.phoneNumber }),
            ...(body.department !== undefined && { department: body.department }),
          },
        });
      }
    });

    if (before) {
      const afterSnap = { username: body.username ?? before.username, email: body.email ?? before.email, is_active: body.isActive ?? before.is_active, is_approved: body.isApproved ?? before.is_approved };
      const changed = getChangedFields(before as Record<string, unknown>, { ...before, ...body } as Record<string, unknown>);
      ActivityLogUtil.log({ userId: actorId, action: 'UPDATE', resourceType: 'users', resourceId: id, description: `แก้ไขข้อมูลผู้ใช้ #${id}` });
      AuditLogUtil.log({ userId: actorId, action: 'UPDATE', tableName: 'users', recordId: id, beforeData: before, afterData: afterSnap, changedFields: changed });
    }

    return { success: true };
  }

  static async unlockAccount(id: number, actorId?: number) {
    await prisma.users.update({
      where: { id },
      data: { failed_login_attempts: 0, locked_until: null, updated_at: new Date() },
    });
    void NotificationService.notifyAccountUnlocked({ userId: id });
    ActivityLogUtil.log({ userId: actorId, action: 'UNLOCK', resourceType: 'users', resourceId: id, description: `ปลดล็อกบัญชีผู้ใช้ #${id}` });
    return { success: true };
  }

  static async forceLogout(id: number, actorId?: number) {
    const count = await prisma.session.updateMany({
      where: { user_id: id, is_active: true },
      data: { is_active: false, revocation_reason: 'ADMIN_FORCE_LOGOUT', updated_at: new Date() },
    });
    void NotificationService.notifyForceLogout({ userId: id });
    ActivityLogUtil.log({ userId: actorId, action: 'FORCE_LOGOUT', resourceType: 'users', resourceId: id, description: `บังคับออกจากระบบผู้ใช้ #${id} (${count.count} session)`, metadata: { sessionsRevoked: count.count } });
    return { success: true, sessionsRevoked: count.count };
  }

  static async resetPassword(id: number, newPassword: string, mustChangePassword: boolean, actorId?: number) {
    const hash = await PasswordUtil.hash(newPassword);
    await prisma.users.update({
      where: { id },
      data: {
        password: hash,
        must_change_password: mustChangePassword,
        password_changed_at: new Date(),
        updated_at: new Date(),
      },
    });
    void NotificationService.notifyPasswordResetByAdmin({ userId: id, mustChangePassword });
    ActivityLogUtil.log({ userId: actorId, action: 'RESET_PASSWORD', resourceType: 'users', resourceId: id, description: `รีเซ็ตรหัสผ่านผู้ใช้ #${id}`, metadata: { mustChangePassword } });
    return { success: true };
  }

  static async getUserRoles(id: number) {
    const rows = await prisma.user_roles.findMany({
      where: { user_id: id },
      include: { roles: { select: { id: true, name: true, priority: true, description: true } } },
    });
    return {
      success: true,
      data: rows.map((r) => ({
        roleId: r.role_id,
        roleName: r.roles.name,
        priority: r.roles.priority ?? 0,
        description: r.roles.description,
        assignedAt: r.assigned_at,
      })),
    };
  }

  static async updateUserRoles(id: number, roleIds: string[], updatedByUserId?: number) {
    // ตรวจ priority constraint
    if (updatedByUserId) {
      const updaterRoles = await prisma.user_roles.findMany({
        where: { user_id: updatedByUserId },
        select: { roles: { select: { priority: true } } },
      });
      const updaterMax = updaterRoles.reduce((max, r) => Math.max(max, r.roles.priority ?? 0), 0);

      const requested = await prisma.roles.findMany({
        where: { id: { in: roleIds } },
        select: { id: true, name: true, priority: true },
      });
      const tooHigh = requested.find((r) => (r.priority ?? 0) > updaterMax);
      if (tooHigh) {
        throw new Error(`ไม่สามารถ assign role "${tooHigh.name}" ที่มี priority สูงกว่าของคุณได้`);
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.user_roles.deleteMany({ where: { user_id: id } });
      if (roleIds.length > 0) {
        await tx.user_roles.createMany({
          data: roleIds.map((role_id) => ({ user_id: id, role_id })),
        });
      }
    });

    void NotificationService.notifyUserRolesUpdated({ userId: id });
    ActivityLogUtil.log({ userId: updatedByUserId, action: 'UPDATE', resourceType: 'user_roles', resourceId: id, description: `อัปเดต roles ของผู้ใช้ #${id}`, metadata: { roleIds } });
    AuditLogUtil.log({ userId: updatedByUserId, action: 'UPDATE', tableName: 'user_roles', recordId: id, afterData: { roleIds } });

    return { success: true };
  }

  static async listDeletedUsers() {
    const users = await prisma.users.findMany({
      where: { is_deleted: true },
      orderBy: { deleted_at: 'desc' },
      select: {
        id: true, username: true, email: true, group_name: true,
        is_active: true, deleted_at: true, created_at: true,
        profile: { select: { first_name: true, last_name: true, display_name: true, avatar_url: true, department: true } },
        user_roles_user_roles_user_idTousers: { select: { role_id: true } },
      },
    });

    return {
      success: true,
      data: users.map((user) => ({
        id: user.id,
        username: user.username,
        email: user.email,
        groupName: user.group_name?.trim() || null,
        deletedAt: user.deleted_at,
        createdAt: user.created_at,
        profile: {
          firstName: user.profile?.first_name ?? null,
          lastName: user.profile?.last_name ?? null,
          displayName: user.profile?.display_name ?? null,
          avatarUrl: user.profile?.avatar_url ?? null,
          department: user.profile?.department ?? null,
        },
        roles: user.user_roles_user_roles_user_idTousers.map((r) => r.role_id),
      })),
    };
  }

  static async restoreUser(id: number, actorId?: number) {
    const user = await prisma.users.findUnique({ where: { id }, select: { id: true, username: true, is_deleted: true } });
    if (!user || !user.is_deleted) throw new Error('User not found or not deleted');

    await prisma.users.update({
      where: { id },
      data: { is_deleted: false, deleted_at: null, updated_at: new Date() },
    });
    ActivityLogUtil.log({ userId: actorId, action: 'RESTORE', resourceType: 'users', resourceId: id, description: `กู้คืนบัญชีผู้ใช้ ${user.username}` });
    return { success: true };
  }

  static async permanentDeleteUser(id: number, currentUserId: number) {
    if (id === currentUserId) throw new Error('Cannot delete your own account');

    const user = await prisma.users.findUnique({ where: { id }, select: { id: true, username: true, email: true } });
    if (!user) throw new Error('User not found');

    await prisma.users.delete({ where: { id } });
    ActivityLogUtil.log({ userId: currentUserId, action: 'DELETE', resourceType: 'users', resourceId: id, description: `ลบบัญชีผู้ใช้ ${user.username} อย่างถาวร` });
    AuditLogUtil.log({ userId: currentUserId, action: 'DELETE', tableName: 'users', recordId: id, beforeData: { username: user.username, email: user.email } });
    void NotificationService.notifyAdminsUserPermanentDeleted({ username: user.username, actorId: currentUserId });
    return { success: true };
  }

  static async deleteUser(id: number, currentUserId: number) {
    if (id === currentUserId) {
      throw new Error('Cannot delete your own account');
    }

    const user = await prisma.users.findUnique({
      where: { id, is_deleted: false },
      select: { id: true, username: true },
    });
    if (!user) throw new Error('User not found');

    await prisma.users.update({
      where: { id },
      data: { is_deleted: true, deleted_at: new Date(), updated_at: new Date() },
    });
    ActivityLogUtil.log({ userId: currentUserId, action: 'DELETE', resourceType: 'users', resourceId: id, description: `ลบบัญชีผู้ใช้ ${user.username} (soft delete)` });

    return { success: true };
  }

  static async toggleUserStatus(id: number, currentUserId: number) {
    if (id === currentUserId) {
      throw new Error('Cannot change your own account status');
    }

    const user = await prisma.users.findUnique({
      where: { id, is_deleted: false },
      select: { id: true, username: true, is_active: true },
    });
    if (!user) throw new Error('User not found');

    const updated = await prisma.users.update({
      where: { id },
      data: { is_active: !user.is_active, updated_at: new Date() },
      select: { id: true, username: true, is_active: true },
    });

    void NotificationService.notifyAccountStatusChanged({ userId: id, isActive: updated.is_active });
    ActivityLogUtil.log({ userId: currentUserId, action: updated.is_active ? 'ENABLE' : 'DISABLE', resourceType: 'users', resourceId: id, description: `${updated.is_active ? 'เปิด' : 'ปิด'}ใช้งานบัญชีผู้ใช้ ${updated.username}` });

    return { success: true, data: updated };
  }

  static async listUsers() {
    const users = await prisma.users.findMany({
      where: {
        is_deleted: false,
      },
      orderBy: {
        created_at: 'desc',
      },
      select: {
        id: true,
        username: true,
        email: true,
        group_name: true,
        is_active: true,
        is_email_verified: true,
        is_approved: true,
        last_login: true,
        created_at: true,
        profile: {
          select: {
            first_name: true,
            last_name: true,
            display_name: true,
            avatar_url: true,
            phone_number: true,
            department: true,
          },
        },
        user_roles_user_roles_user_idTousers: {
          select: {
            role_id: true,
          },
        },
      },
    });
    const onlineUserIds = await getOnlineUserIds(users.map((user) => user.id));

    return {
      success: true,
      data: users.map((user) => ({
        id: user.id,
        username: user.username,
        email: user.email,
        groupName: user.group_name?.trim() || null,
        isActive: user.is_active,
        isOnline: onlineUserIds.has(user.id),
        isEmailVerified: user.is_email_verified,
        isApproved: user.is_approved,
        lastLogin: user.last_login,
        createdAt: user.created_at,
        profile: {
          firstName: user.profile?.first_name ?? null,
          lastName: user.profile?.last_name ?? null,
          displayName: user.profile?.display_name ?? null,
          avatarUrl: user.profile?.avatar_url ?? null,
          phoneNumber: user.profile?.phone_number ?? null,
          department: user.profile?.department ?? null,
        },
        roles: user.user_roles_user_roles_user_idTousers.map((role) => role.role_id),
      })),
    };
  }
}
