// services/auth.service.ts
import prisma from '@/config/prisma.config';
import type { Prisma } from '@/generated/prisma/client';
import redis from '@/config/redis.config';
import { Client } from 'ldapts';
import { AuthHistoryUtil } from "@/utils/auth-history";
import { PasswordUtil } from '@/utils/password';
import { getPasswordPolicy, isPasswordExpired, isPasswordInHistory, validatePasswordPolicy } from '@/utils/password-policy';
import { createSessionForUser, generateTfaSessionToken, verifyTfaSessionToken } from '@/modules/auth/session-creation.service';
import { verifyTotpCode } from '@/utils/totp';
// import { UserRegistrationEmailService } from '@/templates/new-user-notification-for-admin';
// import { WelcomeEmailService } from '@/templates/new-user-notification-for-user';
import type { ClientInfo } from '@/utils/clientInfo';
import { getClientInfo } from '@/utils/clientInfo';
// import { TelegramManager } from '@/config/telegram.config';
import { testEncryption } from '@/utils/encryption';
import { randomBytes } from 'node:crypto';
import { getSettingValue } from '@/utils/get-setting-value';
import { NotificationService } from '@/modules/notifications/notification.service';
import { getUserRolesAndPermissions } from '@/utils/get-user-role-permission';
import { PasswordResetRequestEmailService } from '@/templates/email/password-reset-request';
import { getEmailTemplateConfig } from '@/utils/email-template-config';
import { generateAccessToken, verifyRefreshToken, verifyToken } from '@/modules/auth/jwt.service';
import { invalidateAuthUserCache } from '@/utils/cache-invalidation';
import { markUserOffline, markUserOnline } from '@/utils/online-presence';
import { ActivityLogUtil } from '@/utils/activity-log';
import { ErrorLogUtil } from '@/utils/error-log';
import { translateBackendMessage } from '@/utils/response-language';


interface LoginData {
  username: string;
  password: string;
}

export class AuthService {
  private static normalizeLanguage(language?: string | null) {
    const normalized = language?.trim().toUpperCase();
    return normalized === "TH" ? "TH" : "EN";
  }

  private static async getUserLanguage(userId: number) {
    const rows = await prisma.$queryRaw<Array<{ language: string | null }>>`
      SELECT language FROM users WHERE id = ${userId}
    `;

    return AuthService.normalizeLanguage(rows[0]?.language);
  }

  private static isSystemPasswordExpired(user: { auth_source?: string | null; password_changed_at: Date | null }, expiryDays: number) {
    return user.auth_source?.trim().toUpperCase() === "LDAP" ? false : isPasswordExpired(user.password_changed_at, expiryDays);
  }

  private static mapSessionUser(user: {
    id: number;
    username: string;
    email: string;
    language: string;
    isEmailVerified: boolean;
    security: {
      mustChangePassword: boolean;
      isEmailVerified: boolean;
      hasTwoFactor: boolean | null;
      passwordExpiry: boolean;
      accountExpiry: Date | null;
      temporaryAccount: boolean;
    };
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
      language: AuthService.normalizeLanguage(user.language),
      isEmailVerified: user.isEmailVerified,
      security: user.security,
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
      ErrorLogUtil.log(`Default registration role "${defaultRole}" is not configured`, { source: 'auth:register' });
      return { success: false, status: 500, message: 'Default registration role is not configured' };
    }

    const passwordHash = await PasswordUtil.hash(password);
    const isApproved = !requireApproval;

    const user = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const created = await tx.users.create({
        data: {
          username,
          email,
          password: passwordHash,
          is_active: true,
          is_approved: isApproved,
          is_email_verified: false,
          must_change_password: false,
          auth_source: 'LOCAL',
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

    if (!isApproved) {
      void NotificationService.notifyAdminsPendingApproval({ username: user.username, email: user.email });
    }
    ActivityLogUtil.log({ userId: user.id, username: user.username, action: 'CREATE', resourceType: 'users', resourceId: user.id, description: 'Self-registration completed', metadata: { requiresApproval: !isApproved } });
    AuthHistoryUtil.log({ user_id: user.id, username: user.username, auth_type: 'REGISTER', auth_status: 'SUCCESS' });

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

  private static maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!domain) return '***@***';
    if (local.length <= 2) return `***@${domain}`;
    return `${local[0]}${'*'.repeat(Math.min(3, local.length - 2))}${local[local.length - 1]}@${domain}`;
  }

  private static async sendPasswordResetEmail(
    user: { id: number; username: string; email: string; recovery_email: string | null; last_password_reset_request_at: Date | null },
    emailType: 'main' | 'recovery',
    expiryMinutes: number,
    rateLimitMinutes: number,
  ) {
    if (user.last_password_reset_request_at) {
      const minutesSince = (Date.now() - user.last_password_reset_request_at.getTime()) / 60000;
      if (minutesSince < rateLimitMinutes) {
        const minutesLeft = Math.ceil(rateLimitMinutes - minutesSince);
        return { success: false, status: 429, message: `กรุณารอ ${minutesLeft} นาทีก่อนขอลิงก์ใหม่` };
      }
    }

    const targetEmail = emailType === 'recovery' ? user.recovery_email! : user.email;
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
          email: targetEmail,
          resetUrl: `${config.appUrl}/reset-password?token=${token}`,
          expiryMinutes,
        });
      } catch (err) {
        console.error('[FORGOT_PASSWORD] Email error:', err);
        ErrorLogUtil.log(err, { source: 'auth:forgot-password-email', userId: user.id });
      }
    }, 0);

    return {
      success: true,
      message: `ส่งลิงก์รีเซ็ตรหัสผ่านไปยัง ${this.maskEmail(targetEmail)} เรียบร้อยแล้ว ลิงก์มีอายุ ${expiryMinutes} นาที`,
    };
  }

  static async forgotPassword(identifier: string, emailType?: 'main' | 'recovery') {
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
            recovery_email: true,
            last_password_reset_request_at: true,
          },
        }),
        getSettingValue('password_reset_expiry_minutes', 60),
      ]);
      const expiryMinutes = Math.max(1, Number(configuredExpiryMinutes) || 60);

      if (!user) {
        return { success: false, status: 404, message: 'ไม่พบอีเมลหรือชื่อผู้ใช้นี้ในระบบ' };
      }

      // Lookup mode (no emailType): return masked email options without generating token
      if (!emailType) {
        if (!user.recovery_email) {
          // No recovery email → send directly to main email
          return await this.sendPasswordResetEmail(user, 'main', expiryMinutes, RATE_LIMIT_MINUTES);
        }
        // Has recovery email → return choice options
        return {
          success: true,
          needChoice: true,
          data: {
            mainEmail: this.maskEmail(user.email),
            recoveryEmail: this.maskEmail(user.recovery_email),
          },
        };
      }

      // Send mode: validate and send to chosen email type
      if (emailType === 'recovery' && !user.recovery_email) {
        return { success: false, status: 400, message: 'บัญชีนี้ยังไม่ได้ตั้งค่าอีเมลสำรอง' };
      }

      return await this.sendPasswordResetEmail(user, emailType, expiryMinutes, RATE_LIMIT_MINUTES);
    } catch (error) {
      console.error('[FORGOT_PASSWORD] Error:', error);
      ErrorLogUtil.log(error, { source: 'auth:forgot-password' });
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
        select: { id: true, username: true, password: true, password_reset_expiry: true, is_active: true, is_deleted: true },
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
      ActivityLogUtil.log({ userId: user.id, action: 'RESET_PASSWORD', resourceType: 'users', resourceId: user.id, description: 'Password reset via recovery link' });
      AuthHistoryUtil.log({ user_id: user.id, username: user.username, auth_type: 'PASSWORD_RESET', auth_status: 'SUCCESS' });
      void NotificationService.notifyPasswordChanged({ userId: user.id });

      return { success: true, status: 200, message: 'รีเซ็ตรหัสผ่านสำเร็จ กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่' };
    } catch (error) {
      console.error('[RESET_PASSWORD] Error:', error);
      ErrorLogUtil.log(error, { source: 'auth:reset-password' });
      return { success: false, status: 500, message: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' };
    }
  }

  static async login(loginData: LoginData, request?: any, clientInfo?: ClientInfo) {
    // ห้ามลบออก  ตัวดีบักฉัน 
    // console.log('Testing encryption:', testEncryption("ททท"));
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
        user_agent: finalClientInfo.user_agent ?? null,
        browser: finalClientInfo.browser,
        os: finalClientInfo.os,
      });

      // ตรวจสอบว่าพบ user หรือไม่
      if (!user) {
        AuthHistoryUtil.log({ username, auth_type: 'LOGIN', auth_status: 'FAILED', failure_reason: 'USER_NOT_FOUND', ...getLogData() });
        return { success: false, status: 401, message: 'Invalid username or password' };
      }

      const language = await AuthService.getUserLanguage(user.id);
      const msg = (message: string) => translateBackendMessage(message, language);
      const accountAuthSource = (user.auth_source || "LOCAL").trim().toUpperCase();
      const loginAuthSource = accountAuthSource === "LDAP"
        ? "LDAP" as const
        : finalClientInfo.platform === 'Mobile App'
          ? 'MOBILE_APP' as const
          : finalClientInfo.platform === 'API Testing'
            ? 'API' as const
            : 'WEB' as const;

      // ตรวจสอบสถานะ user 
      if (!user.is_active) {
        AuthHistoryUtil.log({ user_id: user.id, username, auth_type: 'LOGIN', auth_status: 'FAILED', failure_reason: 'ACCOUNT_INACTIVE', ...getLogData() });
        return { success: false, status: 403, message: msg('This account has been suspended') };
      }

      if (!user.is_approved) {
        AuthHistoryUtil.log({ user_id: user.id, username, auth_type: 'LOGIN', auth_status: 'FAILED', failure_reason: 'ACCOUNT_NOT_APPROVED', ...getLogData() });
        return { success: false, status: 403, message: msg('This account has not been approved yet') };
      }

      if (user.is_deleted) {
        AuthHistoryUtil.log({ user_id: user.id, username, auth_type: 'LOGIN', auth_status: 'FAILED', failure_reason: 'ACCOUNT_DELETED', ...getLogData() });
        return { success: false, status: 403, message: msg('This account does not exist in the system or has been deleted') };
      }

      // ตรวจสอบสถานะล็อคบัญชี
      if (user.locked_until && user.locked_until > new Date()) {
        const minutesLeft = Math.ceil((user.locked_until.getTime() - Date.now()) / (60 * 1000));
        AuthHistoryUtil.log({ user_id: user.id, username, auth_type: 'LOGIN', auth_status: 'FAILED', failure_reason: 'ACCOUNT_LOCKED', ...getLogData() });
        return { success: false, status: 403, message: msg(`Account temporarily suspended. Please try again in ${minutesLeft} minutes`) };
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
          await prisma.users.update({
            where: { id: user.id },
            data: { locked_until: lockedUntil, failed_login_attempts: 0, updated_at: new Date() },
          });
          AuthHistoryUtil.log({ user_id: user.id, username, auth_type: 'LOGIN', auth_status: 'FAILED', failure_reason: 'MAX_ATTEMPTS_EXCEEDED', ...getLogData() });
        } catch (dbError) {
          console.error('❌ [LOGIN] Failed to lock account:', dbError);
          ErrorLogUtil.log(dbError, { source: 'auth:lock-account', userId: user.id, username: user.username });
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
            ErrorLogUtil.log(error, { source: 'auth:account-locked-notification', userId: user.id, username: user.username });
          }
        }, 0);

        return {
          success: false,
          status: 403,
          message: msg(`บัญชีถูกระงับชั่วคราว ${loginLockDurationMinutes} นาที เนื่องจากพยายามเข้าสู่ระบบผิดหลายครั้ง กรุณาตรวจสอบอีเมลของคุณ`)
        };
      }

      // ตรวจสอบบัญชีหมดอายุ
      if (user.account_expiry && user.account_expiry < new Date()) {
        AuthHistoryUtil.log({ user_id: user.id, username, auth_type: 'LOGIN', auth_status: 'FAILED', failure_reason: 'ACCOUNT_EXPIRED', ...getLogData() });
        return { success: false, status: 403, message: msg('This account has expired. Please contact the system administrator') };
      }

      // ตรวจสอบรหัสผ่าน: LOCAL ใช้ hash เดิม, LDAP bind กับ directory
      let isPasswordCorrect = false;
      if (accountAuthSource === "LDAP") {
        const [ldapEnabled, rawUrl, rawEncryption] = await Promise.all([
          getSettingValue('ldap_enabled', false),
          getSettingValue('ldap_url', ''),
          getSettingValue('ldap_encryption', 'none'),
        ]);
        const encryption = ["none", "starttls", "ldaps"].includes(String(rawEncryption))
          ? String(rawEncryption) as "none" | "starttls" | "ldaps"
          : "none";
        const trimmedUrl = String(rawUrl || "").trim();
        const urlWithProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmedUrl)
          ? trimmedUrl
          : `${encryption === "ldaps" ? "ldaps" : "ldap"}://${trimmedUrl}`;
        const ldapUrl = encryption === "ldaps" && urlWithProtocol.startsWith("ldap://")
          ? `ldaps://${urlWithProtocol.slice("ldap://".length)}`
          : encryption !== "ldaps" && urlWithProtocol.startsWith("ldaps://")
            ? `ldap://${urlWithProtocol.slice("ldaps://".length)}`
            : urlWithProtocol;

        if (ldapEnabled && trimmedUrl) {
          const ldapClient = new Client(
            encryption === "ldaps"
              ? { url: ldapUrl, timeout: 10_000, connectTimeout: 10_000, tlsOptions: { rejectUnauthorized: false } }
              : { url: ldapUrl, timeout: 10_000, connectTimeout: 10_000 },
          );

          try {
            if (encryption === "starttls") {
              await ldapClient.startTLS({ rejectUnauthorized: false });
            }

            await ldapClient.bind(user.ldap_dn || user.email || user.username, password);
            isPasswordCorrect = true;
          } catch (ldapError) {
            ErrorLogUtil.log(ldapError, { source: 'auth:ldap-login', userId: user.id, username: user.username });
            isPasswordCorrect = false;
          } finally {
            await ldapClient.unbind().catch(() => {});
          }
        }
      } else {
        isPasswordCorrect = await PasswordUtil.compare(password, user.password);
      }

      if (!isPasswordCorrect) {
        const newAttempts = user.failed_login_attempts + 1;
        const updateData: any = { failed_login_attempts: newAttempts };
        const lockedUntil = new Date(Date.now() + loginLockDurationMinutes * 60 * 1000);
        if (newAttempts >= maxFailedAttempts) {
          updateData.locked_until = lockedUntil;
        }

        await prisma.users.update({ where: { id: user.id }, data: updateData });
        AuthHistoryUtil.log({ user_id: user.id, username, auth_type: 'LOGIN', auth_status: 'FAILED', failure_reason: accountAuthSource === "LDAP" ? 'LDAP_AUTH_FAILED' : 'INCORRECT_PASSWORD', auth_source: loginAuthSource, ...getLogData() });

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
              ErrorLogUtil.log(error, { source: 'auth:account-locked-notification', userId: user.id, username: user.username });
            }
          }
        }, 0);
        return newAttempts >= maxFailedAttempts
          ? { success: false, status: 403, message: msg(`บัญชีถูกระงับชั่วคราว ${loginLockDurationMinutes} นาที เนื่องจากพยายามเข้าสู่ระบบผิดหลายครั้ง`) }
          : { success: false, status: 401, message: msg('Invalid username or password') };
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
          success: true, status: 200, message: msg('Please verify two-factor authentication'),
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
      AuthHistoryUtil.log({
        user_id: user.id,
        username: user.username,
        auth_type: 'LOGIN',
        auth_status: 'SUCCESS',
        ip_address: finalClientInfo.ip_address,
        user_agent: finalClientInfo.user_agent ?? null,
        browser: finalClientInfo.browser,
        os: finalClientInfo.os,
        device_info: `${finalClientInfo.device_type} - ${finalClientInfo.browser} on ${finalClientInfo.os} (${finalClientInfo.platform})`,
        auth_source: loginAuthSource,
        session_id: sessionId,
      });

      const isExpired = AuthService.isSystemPasswordExpired(user, expiryDays);


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
          ErrorLogUtil.log(error, { source: 'auth:login-notification', userId: user.id, username: user.username });
        }
      }, 0);


      // Telegram notification disabled.

      // ส่งข้อมูลการเข้าสู่ระบบสำเร็จกลับไป ทันที
      return {
        status: 200,
        success: true,
        message: msg('Login successful'),
        user: {
          id: user.id,
          sessionId: sessionId,
          username: user.username,
          email: user.email,
          language,
          isEmailVerified: user.is_email_verified,
          security: {
            mustChangePassword: user.must_change_password,
            isEmailVerified: user.is_email_verified,
            hasTwoFactor: requires2FA,
            passwordExpiry: isExpired,
            accountExpiry: user.account_expiry,
            temporaryAccount: user.temporary_account,
          },
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
      ErrorLogUtil.log(error, {
        source: 'auth:login',
        username: loginData.username,
        ipAddress: clientInfo?.ip_address,
      });

      AuthHistoryUtil.log({
        username: loginData.username,
        auth_type: 'LOGIN',
        auth_status: 'FAILED',
        failure_reason: 'INTERNAL_ERROR',
        ip_address: clientInfo?.ip_address ?? '127.0.0.1',
        user_agent: clientInfo?.user_agent ?? null,
        browser: clientInfo?.browser,
        os: clientInfo?.os,
      });

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

      const [user, rolesPerms, profile, expiryDays, language] = await Promise.all([
        prisma.users.findUnique({
          where: { id: userId },
          select: {
            id: true,
            username: true,
            email: true,
            is_email_verified: true,
            must_change_password: true,
            password_changed_at: true,
            auth_source: true,
            account_expiry: true,
            temporary_account: true,
            is_active: true,
            is_deleted: true,
          },
        }),
        getUserRolesAndPermissions(userId),
        prisma.profile.findUnique({ where: { user_id: userId } }),
        getSettingValue('password_expiry_days', 90),
        AuthService.getUserLanguage(userId),
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
        language,
        isEmailVerified: user.is_email_verified,
        security: {
          mustChangePassword: user.must_change_password,
          isEmailVerified: user.is_email_verified,
          hasTwoFactor: null,
          passwordExpiry: AuthService.isSystemPasswordExpired(user, expiryDays),
          accountExpiry: user.account_expiry,
          temporaryAccount: user.temporary_account,
        },
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
      return { success: false, status: 200, user: null };
    }

    try {
      const payload = tokens.accessToken
        ? await verifyToken(tokens.accessToken)
        : await verifyRefreshToken(tokens.refreshToken!);
      const userId = Number(payload.id);

      if (!Number.isInteger(userId)) {
        return { success: false, status: 200, user: null };
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
        return { success: false, status: 200, user: null };
      }

      // Session ผ่านแล้ว — เช็ค cache ก่อนตี DB
      const cacheKey = `auth:user:${userId}`;
      if (redis) {
        try {
          const raw = await redis.get(cacheKey);
          if (raw) {
            const cachedUser = JSON.parse(raw);
            if (typeof cachedUser.isEmailVerified === "boolean" && cachedUser.security && typeof cachedUser.language === "string") {
              // update last_used_at แบบ background ไม่บล็อก response
              prisma.session.update({ where: { id: session.id }, data: { last_used_at: new Date() } }).catch(() => {});
              void markUserOnline(userId);
              return { success: true, status: 200, user: cachedUser };
            }
          }
        } catch { /* fall through to DB */ }
      }

      const [user, rolesPerms, profile, expiryDays, language] = await Promise.all([
        prisma.users.findUnique({
          where: { id: userId },
          select: {
            id: true,
            username: true,
            email: true,
            is_email_verified: true,
            must_change_password: true,
            password_changed_at: true,
            auth_source: true,
            account_expiry: true,
            temporary_account: true,
            is_active: true,
            is_deleted: true,
          },
        }),
        getUserRolesAndPermissions(userId),
        prisma.profile.findUnique({ where: { user_id: userId } }),
        getSettingValue('password_expiry_days', 90),
        AuthService.getUserLanguage(userId),
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
        language,
        isEmailVerified: user.is_email_verified,
        security: {
          mustChangePassword: user.must_change_password,
          isEmailVerified: user.is_email_verified,
          hasTwoFactor: null,
          passwordExpiry: AuthService.isSystemPasswordExpired(user, expiryDays),
          accountExpiry: user.account_expiry,
          temporaryAccount: user.temporary_account,
        },
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

      return { success: false, status: 200, user: null };
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
        AuthHistoryUtil.log({
          user_id: session.user_id,
          username: user.username,
          auth_type: 'LOGOUT',
          auth_status: 'SUCCESS',
          ip_address: session.ip_address ?? null,
          user_agent: session.user_agent ?? null,
          device_info: session.device_info ?? null,
          location: session.location ?? null,
          auth_source: session.login_source === 'MOBILE' ? 'MOBILE_APP' : session.login_source === 'API' ? 'API' : 'WEB',
          session_id: session.id,
          logout_time: new Date(),
        });
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

  static async verifyTfaLogin(tfaToken: string, code: string, clientInfo?: ClientInfo) {
    const MAX_ATTEMPTS = 10;
    try {
      const userId = await verifyTfaSessionToken(tfaToken);

      const [user, tfaRecord] = await Promise.all([
        prisma.users.findUnique({
          where: { id: userId },
          select: {
            id: true, username: true, email: true, is_active: true, is_deleted: true,
            is_email_verified: true, must_change_password: true, account_expiry: true,
            temporary_account: true, password_changed_at: true, auth_source: true,
          },
        }),
        prisma.two_factor_auth.findUnique({ where: { user_id: userId } }),
      ]);

      if (!user || !user.is_active || user.is_deleted) {
        return { success: false, status: 401, message: 'บัญชีไม่พบหรือถูกปิดใช้งาน' };
      }
      const language = await AuthService.getUserLanguage(user.id);
      const msg = (message: string) => translateBackendMessage(message, language);
      if (!tfaRecord?.is_enabled || !tfaRecord.secret) {
        return { success: false, status: 401, message: msg('2FA ไม่ได้เปิดใช้งานบนบัญชีนี้') };
      }
      if (!tfaRecord.tfaSessionToken || tfaRecord.tfaSessionToken !== tfaToken) {
        return { success: false, status: 401, message: msg('ลิงก์ยืนยันไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่') };
      }
      if (tfaRecord.verification_attempts >= MAX_ATTEMPTS) {
        return { success: false, status: 429, message: msg('พยายามยืนยันเกินจำนวน กรุณาเข้าสู่ระบบใหม่อีกครั้ง') };
      }

      if (!verifyTotpCode(tfaRecord.secret, code)) {
        await prisma.two_factor_auth.update({
          where: { user_id: userId },
          data: { verification_attempts: { increment: 1 }, updated_at: new Date() },
        });
        const remaining = MAX_ATTEMPTS - (tfaRecord.verification_attempts + 1);
        return {
          success: false, status: 401,
          message: msg(`รหัส OTP ไม่ถูกต้อง${remaining > 0 ? ` (เหลืออีก ${remaining} ครั้ง)` : ' กรุณาเข้าสู่ระบบใหม่'}`),
        };
      }

      const [rolesPerms, profile, expiryDays] = await Promise.all([
        getUserRolesAndPermissions(userId),
        prisma.profile.findUnique({ where: { user_id: userId } }),
        getSettingValue('password_expiry_days', 90),
      ]);

      await prisma.two_factor_auth.update({
        where: { user_id: userId },
        data: { tfaSessionToken: null, verification_attempts: 0, last_verified_at: new Date(), updated_at: new Date() },
      });

      const { roles, permissions } = rolesPerms;
      const finalClientInfo = clientInfo ?? {
        ip_address: '127.0.0.1', user_agent: null,
        platform: 'Unknown', device_type: 'Unknown', browser: 'Unknown', os: 'Unknown',
      };

      const { sessionId, accessToken, refreshToken } = await createSessionForUser(userId, roles, finalClientInfo);
      const loginAt = new Date();

      await Promise.all([
        prisma.users.update({
          where: { id: userId },
          data: { last_login: loginAt, failed_login_attempts: 0, locked_until: null, updated_at: loginAt },
        }),
        markUserOnline(userId),
      ]);

      AuthHistoryUtil.log({
        user_id: user.id,
        username: user.username,
        auth_type: 'LOGIN',
        auth_status: 'SUCCESS',
        ip_address: finalClientInfo.ip_address,
        user_agent: finalClientInfo.user_agent ?? null,
        browser: finalClientInfo.browser,
        os: finalClientInfo.os,
        device_info: `${finalClientInfo.device_type} - ${finalClientInfo.browser} on ${finalClientInfo.os} (${finalClientInfo.platform})`,
        auth_source: finalClientInfo.platform === 'Mobile App' ? 'MOBILE_APP' : finalClientInfo.platform === 'API Testing' ? 'API' : 'WEB',
        session_id: sessionId,
        two_factor_used: true,
      });

      const isExpired = AuthService.isSystemPasswordExpired(user, expiryDays);

      setTimeout(async () => {
        try {
          await NotificationService.notifyLoginSuccess({
            userId: user.id, username: user.username, email: user.email,
            ipAddress: finalClientInfo.ip_address, deviceType: finalClientInfo.device_type,
            browser: finalClientInfo.browser, os: finalClientInfo.os, platform: finalClientInfo.platform,
          });
        } catch (error) {
          console.error('[TFA_VERIFY] Notification error:', error);
          ErrorLogUtil.log(error, { source: 'auth:tfa-login-notification', userId: user.id, username: user.username });
        }
      }, 0);

      return {
        status: 200, success: true, message: msg('Login successful'),
        user: {
          id: user.id, sessionId, username: user.username, email: user.email, language,
          isEmailVerified: user.is_email_verified,
          security: {
            mustChangePassword: user.must_change_password,
            isEmailVerified: user.is_email_verified,
            hasTwoFactor: true,
            passwordExpiry: isExpired,
            accountExpiry: user.account_expiry,
            temporaryAccount: user.temporary_account,
          },
          roles, permissions,
          profile: profile ? {
            firstName: profile.first_name, lastName: profile.last_name,
            displayName: profile.display_name, avatarUrl: profile.avatar_url,
            phoneNumber: profile.phone_number,
          } : null,
        },
        security: {
          mustChangePassword: user.must_change_password, isEmailVerified: user.is_email_verified,
          hasTwoFactor: true, passwordExpiry: isExpired,
          accountExpiry: user.account_expiry, temporaryAccount: user.temporary_account,
        },
        accessToken, refreshToken,
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes('ไม่ถูกต้องหรือหมดอายุ')) {
        return { success: false, status: 401, message: error.message };
      }
      console.error('[TFA_VERIFY] Error:', error);
      ErrorLogUtil.log(error, { source: 'auth:verify-tfa-login' });
      return { success: false, status: 500, message: 'เกิดข้อผิดพลาด กรุณาเข้าสู่ระบบใหม่' };
    }
  }
}
