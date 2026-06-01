// services/auth.service.ts
import prisma from '@/config/prisma.config';
import { AuthHistoryUtil } from "@/utils/auth-history";
import { PasswordUtil } from '@/utils/password';
import { createSessionForUser, generateTfaSessionToken } from '@/services/session.service';
import { SessionCleanupService } from '@/utils/cleanup-expired-session';
// import { UserRegistrationEmailService } from '@/templates/new-user-notification-for-admin';
// import { WelcomeEmailService } from '@/templates/new-user-notification-for-user';
import type { ClientInfo } from '@/utils/clientInfo';
import { getClientInfo } from '@/utils/clientInfo';
// import { TelegramManager } from '@/config/telegram.config';
import { decryptText, testEncryption } from '@/utils/encryption';
import { getSettingValue } from '@/utils/get-setting-value';
import { LoginNotificationEmailService } from '@/templates/login-notification';
import { AccountLockedEmailService } from '@/templates/account-locked';
import { getUserRolesAndPermissions } from '@/utils/get-user-role-permission';



export class AuthService {

  static async login(loginData: LoginData, request?: any, clientInfo?: ClientInfo) {
    // ห้ามลบออก  ตัวดีบักฉัน 
    console.log('Testing encryption:', testEncryption("xvtxijxldikilhqs"));
    try {
      const { username: encryptedUsername, password: encryptedPassword } = loginData;

      let username, password;
      
      try {
        username =  decryptText(encryptedUsername);
        password =  decryptText(encryptedPassword);
      } catch (decryptError) {
        console.error('🔴 [LOGIN] Decryption failed:', decryptError);
        return { success: false, status: 400, message: 'Invalid credentials format' };
      }

      // ตรวจสอบว่าถอดรหัสได้หรือไม่
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

        // ✅ ส่งอีเมลแจ้งเตือน
        try {
          console.log('📧 [LOGIN] Sending account locked notification (case 1)...');

          const emailResult = await AccountLockedEmailService.sendAccountLockedEmail({
            username: user.username,
            email: user.email,
            locked_until: lockedUntil,
            failed_attempts: maxFailedAttempts,
            locked_duration_minutes: loginLockDurationMinutes,
            last_attempt_ip: finalClientInfo.ip_address || 'Unknown',
            last_attempt_device: finalClientInfo.device_type || 'Unknown',
            last_attempt_time: new Date().toLocaleString('th-TH')
          });

          if (emailResult.success) {
            console.log('✅ [LOGIN] Account locked notification sent successfully');
          } else {
            console.error('⚠️ [LOGIN] Failed to send notification:', emailResult.error);
          }
        } catch (emailError) {
          console.error('❌ [LOGIN] Exception sending notification:', emailError);
        }

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
        if (newAttempts >= maxFailedAttempts) {
          updateData.locked_until = new Date(Date.now() + loginLockDurationMinutes * 60 * 1000);
        }

        setTimeout(async () => {
          await Promise.all([
            prisma.users.update({ where: { id: user.id }, data: updateData }),
            AuthHistoryUtil.logLoginFailed(username, 'INCORRECT_PASSWORD', {
              user_id: user.id, ...getLogData()
            })
          ]);
        }, 0);
        return { success: false, status: 401, message: 'Invalid username or password' };
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


      // ส่งเมลแจ้งเตือนการเข้าสู่ระบบ ถ้าเปิด (background)
      setTimeout(() => {
        LoginNotificationEmailService.shouldSendLoginNotification(user.id)
          .then(async (shouldSend) => {
            if (!shouldSend) return;
            await LoginNotificationEmailService.sendLoginNotificationEmail({
              username: user.username,
              email: user.email,
              login_time: new Date().toLocaleString('th-TH'),
              ip_address: finalClientInfo.ip_address,
              device_type: finalClientInfo.device_type,
              browser: finalClientInfo.browser,
              os: finalClientInfo.os,
              platform: finalClientInfo.platform,
            });
          })
          .catch(() => {});
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
}
