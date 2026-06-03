import prisma from '@/config/prisma.config';
import { PasswordUtil } from '@/utils/password';
import { getOnlineUserIds } from '@/utils/online-presence';
import { UserRegistrationEmailService } from '@/templates/new-user-notification-for-admin';
import { WelcomeEmailService } from '@/templates/new-user-notification-for-user';

interface CreateUserInput {
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
}

export class UsersService {
  static async createUser(body: CreateUserInput) {
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

      return created;
    });

    const roleLabel = body.roleIds?.[0] ?? 'ไม่ระบุ';
    const createdAt = new Date().toLocaleString('th-TH');

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

    return { success: true, data: { id: user.id, username: user.username, email: user.email } };
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
