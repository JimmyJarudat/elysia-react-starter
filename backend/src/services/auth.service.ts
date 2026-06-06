// services/auth.service.ts
import prisma from '@/config/prisma.config';
import redis from '@/config/redis.config';
import { AuthHistoryUtil } from "@/utils/auth-history";
import { PasswordUtil } from '@/utils/password';
import { getPasswordPolicy, isPasswordInHistory, validatePasswordPolicy } from '@/utils/password-policy';
import { createSessionForUser, generateTfaSessionToken } from '@/services/session-creation.service';
import { SessionCleanupService } from '@/utils/cleanup-expired-session';
// import { UserRegistrationEmailService } from '@/templates/new-user-notification-for-admin';
// import { WelcomeEmailService } from '@/templates/new-user-notification-for-user';
import type { ClientInfo } from '@/utils/clientInfo';
import { getClientInfo } from '@/utils/clientInfo';
// import { TelegramManager } from '@/config/telegram.config';
import { testEncryption } from '@/utils/encryption';
import { randomBytes } from 'node:crypto';
import { getSettingValue } from '@/utils/get-setting-value';
import { NotificationService } from '@/services/notification.service';
import { getUserRolesAndPermissions } from '@/utils/get-user-role-permission';
import { PasswordResetRequestEmailService } from '@/templates/email/password-reset-request';
import { getEmailTemplateConfig } from '@/utils/email-template-config';
import { generateAccessToken, verifyRefreshToken, verifyToken } from '@/services/jwt.service';
import { invalidateAuthUserCache } from '@/utils/cache-invalidation';
import { markUserOffline, markUserOnline } from '@/utils/online-presence';

export class AuthService {
  private static mapSessionUser(user: {
    id: number;
    username: string;
    email: string;
    isEmailVerified: boolean;
    roles: string[];
    permissions: string[];
    profile: {
      firstName?: string | null;
      lastName?: string | null;
      displayName?: string | null;
      avatarUrl?: string | null;
      phoneNumber?: string | null;
    } | null;
  }) {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      isEmailVerified: user.isEmailVerified,
      roles: user.roles,
      permissions: user.permissions,
      profile: {
        firstName: user.profile?.firstName ?? '',
        lastName: user.profile?.lastName ?? '',
        displayName: user.profile?.displayName ?? '',
        avatarUrl: user.profile?.avatarUrl ?? '',
        phoneNumber: user.profile?.phoneNumber ?? '',
      },
    };
  }

  static async register(registerData: {
    username: string;
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
  }) {
    const [registrationEnabled, requireApproval, defaultRole] = await Promise.all([
      getSettingValue('self_registration_enabled', false),
      getSettingValue('registration_requires_approval', true),
      getSettingValue('registration_default_role', 'USER'),
    ]);

    if (!registrationEnabled) {
      return { success: false, status: 403, message: 'Registration is currently disabled' };
    }

    const username = registerData.username.trim();
    const email = registerData.email.trim().toLowerCase();
    const password = registerData.password;

    if (!username || !email || !password) {
      return { success: false, status: 400, message: 'Username, email, and password are required' };
    }

    const existing = await prisma.users.findFirst({
      where: { OR: [{ username }, { email }] },
      select: { username: true, email: true },
    });

    if (existing) {
      const field = existing.username === username ? 'username' : 'email';
      return { success: false, status: 409, message: `${field} already exists` };
    }

    const role = await prisma.roles.findUnique({
      where: { id: String(defaultRole).trim().toUpperCase() || 'USER' },
      select: { id: true },
    });

    if (!role) {
      return { success: false, status: 500, message: 'Default registration role is not configured' };
    }

    const passwordHash = await PasswordUtil.hash(password);
    const isApproved = !requireApproval;

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.users.create({
        data: {
          username,
          email,
          password: passwordHash,
          is_active: true,
          is_approved: isApproved,
          is_email_verified: false,
          must_change_password: false,
          creation_type: 'SELF_REGISTER',
        },
      });

      if (registerData.firstName || registerData.lastName) {
        await tx.profile.create({
          data: {
            user_id: created.id,
            first_name: registerData.firstName?.trim() || null,
            last_name: registerData.lastName?.trim() || null,
          },
        });
      }

      await tx.user_roles.create({
        data: {
          user_id: created.id,
          role_id: role.id,
        },
      });

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

    return {
      success: true,
      status: 201,
      message: isApproved
        ? 'Registration successful. You can sign in now.'
        : 'Registration successful. Please wait for admin approval.',
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
        requiresApproval: !isApproved,
      },
    };
  }

  static async forgotPassword(identifier: string) {
    const RATE_LIMIT_MINUTES = 5;

    try {
      const [user, configuredExpiryMinutes] = await Promise.all([
        prisma.users.findFirst({
          where: {
            OR: [{ email: identifier.toLowerCase().trim() }, { username: identifier.trim() }],
            is_active: true,
            is_deleted: false,
          },
          select: {
            id: true,
            username: true,
            email: true,
            last_password_reset_request_at: true,
          },
        }),
        getSettingValue('password_reset_expiry_minutes', 60),
      ]);
      const expiryMinutes = Math.max(1, Number(configuredExpiryMinutes) || 60);

      if (!user) {
        return { success: false, status: 404, message: 'ไม่พบอีเมลหรือชื่อผู้ใช้นี้ในระบบ' };
      }

      if (user.last_password_reset_request_at) {
        const minutesSince = (Date.now() - user.last_password_reset_request_at.getTime()) / 60000;
        if (minutesSince < RATE_LIMIT_MINUTES) {
          const minutesLeft = Math.ceil(RATE_LIMIT_MINUTES - minutesSince);
          return { success: false, status: 429, message: `กรุณารอ ${minutesLeft} นาทีก่อนขอลิงก์ใหม่` };
        }
      }

      const token = randomBytes(32).toString('hex');
      const expiry = new Date(Date.now() + expiryMinutes * 60 * 1000);

      await prisma.users.update({
        where: { id: user.id },
        data: {
          password_reset_token: token,
          password_reset_expiry: expiry,
          last_password_reset_request_at: new Date(),
          updated_at: new Date(),
        },
      });

      setTimeout(async () => {
        try {
          const config = await getEmailTemplateConfig();
          await PasswordResetRequestEmailService.send({
            username: user.username,
            email: user.email,
            resetUrl: `${config.appUrl}/reset-password?token=${token}`,
            expiryMinutes,
          });
        } catch (err) {
          console.error('[FORGOT_PASSWORD] Email error:', err);
        }
      }, 0);

      return {
        success: true,
        message: `ส่งลิงก์รีเซ็ตรหัสผ่านไปยัง ${user.email} เรียบร้อยแล้ว ลิงก์มีอายุ ${expiryMinutes} นาที`,
      };
    } catch (error) {
      console.error('[FORGOT_PASSWORD] Error:', error);
      return { success: false, status: 500, message: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' };
    }
  }

  static async resetPassword(token: string, newPassword: string) {
    if (!token || !newPassword) {
      return { success: false, status: 400, message: 'กรุณากรอกข้อมูลให้ครบถ้วน' };
    }

    try {
      const user = await prisma.users.findFirst({
        where: { password_reset_token: token },
        select: { id: true, password: true, password_reset_expiry: true, is_active: true, is_deleted: true },
      });

      if (!user) {
        return { success: false, status: 400, message: 'ลิงก์รีเซ็ตรหัสผ่านไม่ถูกต้องหรือหมดอายุแล้ว' };
      }

      if (!user.is_active || user.is_deleted) {
        return { success: false, status: 400, message: 'บัญชีนี้ถูกปิดใช้งาน' };
      }

      if (!user.password_reset_expiry || user.password_reset_expiry < new Date()) {
        return { success: false, status: 400, message: 'ลิงก์รีเซ็ตรหัสผ่านหมดอายุแล้ว กรุณาขอใหม่อีกครั้ง' };
      }

      const policy = await getPasswordPolicy();
      const failures = validatePasswordPolicy(newPassword, policy);
      if (failures.length > 0) {
        return { success: false, status: 400, message: failures.join(", ") };
      }
      if (await PasswordUtil.compare(newPassword, user.password)) {
        return { success: false, status: 400, message: 'รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านปัจจุบัน' };
      }
      if (await isPasswordInHistory(user.id, newPassword, policy.historyCount)) {
        return {
          success: false,
          status: 400,
          message: `ไม่สามารถใช้รหัสผ่านซ้ำกับ ${policy.historyCount} รหัสล่าสุดได้`,
        };
      }

      const passwordHash = await PasswordUtil.hash(newPassword);
      const changedAt = new Date();

      await prisma.$transaction([
        prisma.password_history.create({
          data: {
            user_id: user.id,
            password_hash: user.password,
            changed_by_user_id: user.id,
            change_reason: 'PASSWORD_RESET',
          },
        }),
        prisma.users.update({
          where: { id: user.id },
          data: {
            password: passwordHash,
            password_changed_at: changedAt,
            password_reset_token: null,
            password_reset_code: null,
            password_reset_expiry: null,
            failed_login_attempts: 0,
            locked_until: null,
            must_change_password: false,
            updated_at: changedAt,
          },
        }),
      ]);
      await invalidateAuthUserCache(user.id);
      void NotificationService.notifyPasswordChanged({ userId: user.id });

      return { success: true, status: 200, message: 'รีเซ็ตรหัสผ่านสำเร็จ กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่' };
    } catch (error) {
      console.error('[RESET_PASSWORD] Error:', error);
      return { success: false, status: 500, message: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' };
    }
  }

  static async login(loginData: LoginData, request?: any, clientInfo?: ClientInfo) {
    // ห้ามลบออก  ตัวดีบักฉัน 
    console.log('Testing encryption:', testEncryption("ททท"));
    try {
      const { username, password } = loginData;

      // ตรวจสอบข้อมูลเข้าสู่ระบบ
      if (!username || !password) {
        return { success: false, status: 400, message: 'Invalid credentials' };
      }

      const [maxFailedAttempts, loginLockDurationMinutes, expiryDays] = await Promise.all([
        getSettingValue('max_login_attempts', 5),
        getSettingValue('account_lock_minutes', 5),
        getSettingValue('password_expiry_days', 90),
      ]);

      const user = await prisma.users.findFirst({
        where: {
          OR: [{ username: username }, { email: username }]
        }
      });

      // ใช้ clientInfo ที่ส่งมา หรือ fallback ถ้าไม่มี
      const finalClientInfo = clientInfo || (request ? getClientInfo(request) : {
        ip_address: '127.0.0.1',
        user_agent: null,
        platform: 'Unknown',
        device_type: 'Unknown',
        browser: 'Unknown',
        os: 'Unknown'
      });

      // Helper function สำหรับ log
      const getLogData = () => ({
        ip_address: finalClientInfo.ip_address,
        user_agent: finalClientInfo.user_agent || undefined,
        browser: finalClientInfo.browser,
        os: finalClientInfo.os,
        device_type: finalClientInfo.device_type,
        platform: finalClientInfo.platform
      });

      // ตรวจสอบว่าพบ user หรือไม่
      if (!user) {
        setTimeout(async () => {
          await AuthHistoryUtil.logLoginFailed(username, 'USER_NOT_FOUND', getLogData());
        }, 0);
        return { success: false, status: 401, message: 'Invalid username or password' };
      }

      // ตรวจสอบสถานะ user 
      if (!user.is_active) {
        setTimeout(async () => {
          await AuthHistoryUtil.logLoginFailed(username, 'ACCOUNT_INACTIVE', {
            user_id: user.id, ...getLogData()
          });
        }, 0);
        return { success: false, status: 403, message: 'This account has been suspended' };
      }

      if (!user.is_approved) {
        setTimeout(async () => {
          await AuthHistoryUtil.logLoginFailed(username, 'ACCOUNT_NOT_APPROVED', {
            user_id: user.id, ...getLogData()
          });
        }, 0);
        return { success: false, status: 403, message: 'This account has not been approved yet' };
      }

      if (user.is_deleted) {
        setTimeout(async () => {
          await AuthHistoryUtil.logLoginFailed(username, 'ACCOUNT_DELETED', {
            user_id: user.id, ...getLogData()
          });
        }, 0);
        return { success: false, status: 403, message: 'This account does not exist in the system or has been deleted' };
      }

      // ตรวจสอบสถานะล็อคบัญชี
      if (user.locked_until && user.locked_until > new Date()) {
        const minutesLeft = Math.ceil((user.locked_until.getTime() - Date.now()) / (60 * 1000));
        setTimeout(async () => {
          await AuthHistoryUtil.logLoginFailed(username, 'ACCOUNT_LOCKED', {
            user_id: user.id, ...getLogData()
          });
        }, 0);
        return { success: false, status: 403, message: `Account temporarily suspended. Please try again in ${minutesLeft} minutes` };
      }

      if (user.locked_until && user.locked_until <= new Date()) {
        await prisma.users.update({
          where: { id: user.id },
          data: {
            failed_login_attempts: 0,
            locked_until: null,
            updated_at: new Date(),
          },
        });
        user.failed_login_attempts = 0;
        user.locked_until = null;
      }

      // ตรวจสอบจำนวนครั้งที่ล็อกอินผิด
      // ตรวจสอบจำนวนครั้งที่ล็อกอินผิด (ก่อนเช็ครหัสผ่าน)
      if (user.failed_login_attempts >= maxFailedAttempts) {
        const lockedUntil = new Date(Date.now() + loginLockDurationMinutes * 60 * 1000);


        // อัปเดต database
        try {
          await Promise.all([
            prisma.users.update({
              where: { id: user.id },
              data: {
                locked_until: lockedUntil,
                failed_login_attempts: 0,
                updated_at: new Date()
              }
            }),
            AuthHistoryUtil.logLoginFailed(username, 'MAX_ATTEMPTS_EXCEEDED', {
              user_id: user.id, ...getLogData()
            })
          ]);

        } catch (dbError) {
          console.error('❌ [LOGIN] Failed to lock account:', dbError);
        }

        setTimeout(async () => {
          try {
            await NotificationService.notifyAccountLocked({
              userId: user.id,
              username: user.username,
              email: user.email,
              lockedUntil,
              failedAttempts: maxFailedAttempts,
              lockedDurationMinutes: loginLockDurationMinutes,
              ipAddress: finalClientInfo.ip_address,
              deviceType: finalClientInfo.device_type,
            });
          } catch (error) {
            console.error('[LOGIN] Failed to create account locked notification:', error);
          }
        }, 0);

        return {
          success: false,
          status: 403,
          message: `บัญชีถูกระงับชั่วคราว ${loginLockDurationMinutes} นาที เนื่องจากพยายามเข้าสู่ระบบผิดหลายครั้ง กรุณาตรวจสอบอีเมลของคุณ`
        };
      }

      // ตรวจสอบบัญชีหมดอายุ
      if (user.account_expiry && user.account_expiry < new Date()) {
        setTimeout(async () => {
          await AuthHistoryUtil.logLoginFailed(username, 'ACCOUNT_EXPIRED', {
            user_id: user.id, ...getLogData()
          });
        }, 0);
        return { success: false, status: 403, message: 'This account has expired. Please contact the system administrator' };
      }

      // ตรวจสอบรหัสผ่าน
      const isPasswordCorrect = await PasswordUtil.compare(password, user.password);
      if (!isPasswordCorrect) {
        const newAttempts = user.failed_login_attempts + 1;
        const updateData: any = { failed_login_attempts: newAttempts };
        const lockedUntil = new Date(Date.now() + loginLockDurationMinutes * 60 * 1000);
        if (newAttempts >= maxFailedAttempts) {
          updateData.locked_until = lockedUntil;
        }

        await prisma.users.update({ where: { id: user.id }, data: updateData });
        void AuthHistoryUtil.logLoginFailed(username, 'INCORRECT_PASSWORD', {
          user_id: user.id, ...getLogData()
        });

        setTimeout(async () => {
          if (newAttempts >= maxFailedAttempts) {
            try {
              await NotificationService.notifyAccountLocked({
                userId: user.id,
                username: user.username,
                email: user.email,
                lockedUntil,
                failedAttempts: newAttempts,
                lockedDurationMinutes: loginLockDurationMinutes,
                ipAddress: finalClientInfo.ip_address,
                deviceType: finalClientInfo.device_type,
              });
            } catch (error) {
              console.error('[LOGIN] Failed to create account locked notification:', error);
            }
          }
        }, 0);
        return newAttempts >= maxFailedAttempts
          ? { success: false, status: 403, message: `บัญชีถูกระงับชั่วคราว ${loginLockDurationMinutes} นาที เนื่องจากพยายามเข้าสู่ระบบผิดหลายครั้ง` }
          : { success: false, status: 401, message: 'Invalid username or password' };
      }

      const [twoFactorAuth, rolesPerms, profile] = await Promise.all([
        prisma.two_factor_auth.findUnique({ where: { user_id: user.id } }),
        getUserRolesAndPermissions(user.id),
        prisma.profile.findUnique({ where: { user_id: user.id } }),
      ]);

      // ตรวจสอบว่าต้องใช้ 2FA หรือไม่
      const requires2FA = twoFactorAuth && twoFactorAuth.is_enabled;

      // หากต้องใช้ 2FA
      if (requires2FA) {
        const tfaSessionToken = await generateTfaSessionToken(user.id);
        await prisma.two_factor_auth.update({
          where: { user_id: user.id },
          data: { tfaSessionToken: tfaSessionToken }
        });

        return {
          success: true, status: 200, message: 'Please verify two-factor authentication',
          requiresTwoFactor: true, tfaSessionToken, tfaMethod: 'TOTP', userId: user.id
        };
      }

      const { roles, permissions } = rolesPerms;

      // สร้าง session และ tokens
      const { sessionId, accessToken, refreshToken } = await createSessionForUser(user.id, roles, finalClientInfo);
      const loginAt = new Date();
      await Promise.all([
        prisma.users.update({
          where: { id: user.id },
          data: {
            last_login: loginAt,
            failed_login_attempts: 0,
            locked_until: null,
            updated_at: loginAt,
          },
        }),
        markUserOnline(user.id),
      ]);
      void AuthHistoryUtil.logLoginSuccessForSession(user, sessionId, finalClientInfo);

      // ตรวจสอบรหัสผ่านหมดอายุ
      const isPasswordExpired = (passwordChangedAt: Date | null, expiryDays: number): boolean => {
        if (!passwordChangedAt) return true;
        const lastChangedDate = new Date(passwordChangedAt);
        if (isNaN(lastChangedDate.getTime())) return true;
        const expiryDate = new Date(lastChangedDate);
        expiryDate.setDate(expiryDate.getDate() + expiryDays);
        return new Date().getTime() > expiryDate.getTime();
      };

      const isExpired = isPasswordExpired(user.password_changed_at, expiryDays);


      // สร้าง in-app และส่งอีเมลแจ้งเตือนการเข้าสู่ระบบตามการตั้งค่าของผู้ใช้
      setTimeout(async () => {
        try {
          await NotificationService.notifyLoginSuccess({
            userId: user.id,
            username: user.username,
            email: user.email,
            ipAddress: finalClientInfo.ip_address,
            deviceType: finalClientInfo.device_type,
            browser: finalClientInfo.browser,
            os: finalClientInfo.os,
            platform: finalClientInfo.platform,
          });
        } catch (error) {
          console.error('[LOGIN] Failed to create login notification:', error);
        }
      }, 0);


      // Telegram notification disabled.

      // ส่งข้อมูลการเข้าสู่ระบบสำเร็จกลับไป ทันที
      return {
        status: 200,
        success: true,
        message: 'Login successful',
        user: {
          id: user.id,
          sessionId: sessionId,
          username: user.username,
          email: user.email,
          isEmailVerified: user.is_email_verified,
          roles: roles,
          permissions: permissions,
          profile: profile ? {
            firstName: profile.first_name,
            lastName: profile.last_name,
            displayName: profile.display_name,
            avatarUrl: profile.avatar_url,
            phoneNumber: profile.phone_number,
          } : null
        },
        security: {
          mustChangePassword: user.must_change_password,
          isEmailVerified: user.is_email_verified,
          hasTwoFactor: requires2FA,
          passwordExpiry: isExpired,
          accountExpiry: user.account_expiry,
          temporaryAccount: user.temporary_account,
        },
        accessToken,
        refreshToken
      };

    } catch (error) {
      console.error('🔥 [LOGIN] Error:', error);

      // ใช้ clientInfo สำหรับ error log
      const errorLogData = clientInfo ? {
        ip_address: clientInfo.ip_address,
        user_agent: clientInfo.user_agent || undefined,
        browser: clientInfo.browser,
        os: clientInfo.os,
        device_type: clientInfo.device_type,
        platform: clientInfo.platform
      } : {
        ip_address: '127.0.0.1',
        user_agent: undefined,
      };

      setTimeout(async () => {
        await AuthHistoryUtil.logLoginFailed(loginData.username, 'INTERNAL_ERROR', errorLogData);
      }, 0);

      return { success: false, status: 500, message: 'Internal server error' };
    }
  }

  static async refreshToken(refreshToken?: string) {
    if (!refreshToken) {
      return { success: false, status: 401, message: 'No refresh token found' };
    }

    try {
      const payload = await verifyRefreshToken(refreshToken);
      const userId = Number(payload.id);

      if (!Number.isInteger(userId)) {
        return { success: false, status: 401, message: 'Invalid refresh token payload' };
      }

      const session = await prisma.session.findFirst({
        where: {
          user_id: userId,
          refresh_token: refreshToken,
          is_active: true,
          expires_at: { gt: new Date() },
        },
      });

      if (!session) {
        return { success: false, status: 401, message: 'Session expired' };
      }

      const [user, rolesPerms, profile] = await Promise.all([
        prisma.users.findUnique({
          where: { id: userId },
          select: {
            id: true,
            username: true,
            email: true,
            is_email_verified: true,
            is_active: true,
            is_deleted: true,
          },
        }),
        getUserRolesAndPermissions(userId),
        prisma.profile.findUnique({ where: { user_id: userId } }),
      ]);

      if (!user || user.is_deleted) {
        return { success: false, status: 401, message: 'User not found' };
      }

      if (!user.is_active) {
        return { success: false, status: 401, message: 'User account is suspended' };
      }

      const accessToken = await generateAccessToken({
        id: user.id,
        roles: rolesPerms.roles,
      });

      await prisma.session.update({
        where: { id: session.id },
        data: {
          access_token: accessToken,
          last_used_at: new Date(),
        },
      });
      await markUserOnline(userId);
      const cacheTtlUser = 60; // seconds — short TTL เพราะเป็น auth data

      const userData = AuthService.mapSessionUser({
        id: user.id,
        username: user.username,
        email: user.email,
        isEmailVerified: user.is_email_verified,
        roles: rolesPerms.roles,
        permissions: rolesPerms.permissions,
        profile: profile ? {
          firstName: profile.first_name,
          lastName: profile.last_name,
          displayName: profile.display_name,
          avatarUrl: profile.avatar_url,
          phoneNumber: profile.phone_number,
        } : null,
      });

      // Refresh cache ด้วย token ใหม่
      if (redis) {
        try { await redis.set(`auth:user:${userId}`, JSON.stringify(userData), 'EX', cacheTtlUser); } catch { /* non-critical */ }
      }

      return { success: true, status: 200, accessToken, user: userData };
    } catch (error) {
      return {
        success: false,
        status: 401,
        message: error instanceof Error ? error.message : 'Invalid refresh token',
      };
    }
  }

  static async me(tokens: { accessToken?: string; refreshToken?: string }) {
    const token = tokens.accessToken ?? tokens.refreshToken;

    if (!token) {
      return { success: false, status: 401, message: 'Authentication token is required' };
    }

    try {
      const payload = tokens.accessToken
        ? await verifyToken(tokens.accessToken)
        : await verifyRefreshToken(tokens.refreshToken!);
      const userId = Number(payload.id);

      if (!Number.isInteger(userId)) {
        return { success: false, status: 401, message: 'Invalid token payload' };
      }

      const session = await prisma.session.findFirst({
        where: {
          user_id: userId,
          is_active: true,
          expires_at: { gt: new Date() },
          ...(tokens.accessToken
            ? { access_token: tokens.accessToken }
            : { refresh_token: tokens.refreshToken }),
        },
      });

      if (!session) {
        return { success: false, status: 401, message: 'Session expired' };
      }

      // Session ผ่านแล้ว — เช็ค cache ก่อนตี DB
      const cacheKey = `auth:user:${userId}`;
      if (redis) {
        try {
          const raw = await redis.get(cacheKey);
          if (raw) {
            const cachedUser = JSON.parse(raw);
            if (typeof cachedUser.isEmailVerified === "boolean") {
              // update last_used_at แบบ background ไม่บล็อก response
              prisma.session.update({ where: { id: session.id }, data: { last_used_at: new Date() } }).catch(() => {});
              void markUserOnline(userId);
              return { success: true, status: 200, user: cachedUser };
            }
          }
        } catch { /* fall through to DB */ }
      }

      const [user, rolesPerms, profile] = await Promise.all([
        prisma.users.findUnique({
          where: { id: userId },
          select: {
            id: true,
            username: true,
            email: true,
            is_email_verified: true,
            is_active: true,
            is_deleted: true,
          },
        }),
        getUserRolesAndPermissions(userId),
        prisma.profile.findUnique({ where: { user_id: userId } }),
      ]);

      if (!user || user.is_deleted) {
        return { success: false, status: 401, message: 'User not found' };
      }

      if (!user.is_active) {
        return { success: false, status: 401, message: 'User account is suspended' };
      }

      await prisma.session.update({
        where: { id: session.id },
        data: { last_used_at: new Date() },
      });
      await markUserOnline(userId);
      const cacheTtlUser = 60; // seconds — short TTL เพราะเป็น auth data

      const userData = AuthService.mapSessionUser({
        id: user.id,
        username: user.username,
        email: user.email,
        isEmailVerified: user.is_email_verified,
        roles: rolesPerms.roles,
        permissions: rolesPerms.permissions,
        profile: profile ? {
          firstName: profile.first_name,
          lastName: profile.last_name,
          displayName: profile.display_name,
          avatarUrl: profile.avatar_url,
          phoneNumber: profile.phone_number,
        } : null,
      });

      // Cache user data
      if (redis) {
        try { await redis.set(cacheKey, JSON.stringify(userData), 'EX', cacheTtlUser); } catch { /* non-critical */ }
      }

      return { success: true, status: 200, user: userData };
    } catch (error) {
      if (tokens.refreshToken) {
        return AuthService.refreshToken(tokens.refreshToken);
      }

      return {
        success: false,
        status: 401,
        message: error instanceof Error ? error.message : 'Authentication failed',
      };
    }
  }

  static async logout(tokens: { accessToken?: string; refreshToken?: string }) {
    const { accessToken, refreshToken } = tokens;

    if (!accessToken && !refreshToken) {
      return { success: true, status: 200, message: 'Logout successful' };
    }

    const session = await prisma.session.findFirst({
      where: {
        is_active: true,
        OR: [
          ...(accessToken ? [{ access_token: accessToken }] : []),
          ...(refreshToken ? [{ refresh_token: refreshToken }] : []),
        ],
      },
    });

    if (session) {
      await prisma.session.update({
        where: { id: session.id },
        data: {
          is_active: false,
          updated_at: new Date(),
          last_used_at: new Date(),
          revocation_reason: 'USER_LOGOUT',
        },
      });

      const user = await prisma.users.findUnique({
        where: { id: session.user_id },
        select: { username: true },
      });

      if (user) {
        void AuthHistoryUtil.logLogoutForSession(user.username, session);
      }

      // ล้าง user cache ทันทีที่ logout
      try { await invalidateAuthUserCache(session.user_id); } catch { /* non-critical */ }

      const activeSessionCount = await prisma.session.count({
        where: {
          user_id: session.user_id,
          is_active: true,
          expires_at: { gt: new Date() },
        },
      });
      if (activeSessionCount === 0) {
        await markUserOffline(session.user_id);
      }
    }

    return { success: true, status: 200, message: 'Logout successful' };
  }
}
