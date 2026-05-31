// services/auth.service.ts
import prisma from '@/common/prisma';
import novaPlatform from '@/common/prisma-nova-platform';
import { AuthHistoryUtil } from "@/utils/auth-history";
import { PasswordUtil } from '@/utils/password';
import { Context } from 'elysia';
import { getSettingValue } from '@/utils/get-setting-value';
import { createSessionForUser, generateTfaSessionToken } from '@/services/session.service';
import { SessionCleanupService } from '@/utils/cleanup-expired-session';
import { UserRegistrationEmailService } from '@/templates/new-user-notification-for-admin';
import { WelcomeEmailService } from '@/templates/new-user-notification-for-user';
import { CurrentUser } from '@/utils/get-current-user';
import { ClientInfo, getClientInfo } from '@/utils/clientInfo';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from './jwt.service';
import { isRedisAvailable, RedisManager } from '@/config/redis.config';
import { RegisterDtoType, LoginDtoType, LogoutDtoType, AdminConfirmType } from '@/schemas/auth';
import { TelegramManager } from '@/config/telegram.config';
import { decryptText } from '@/utils/encryption';
import { AccountLockedEmailService } from '@/templates/account-locked';
import { LoginNotificationEmailService } from '@/templates/login-notification';
import { generateVerificationCode } from '@/utils/VerificationCode';
import { EmailManager, getEmailStatus } from '@/config/email.config';
import crypto from 'crypto';
import * as bcrypt from 'bcryptjs';



export class AuthService {

  static async register(userData: RegisterDtoType, currentUser?: CurrentUser, clientInfo?: ClientInfo) {
    try {
      console.log('Current userserrr:', currentUser?.username); // test3

      const { username, email, password, confirmPassword, role_id } = userData;

      // 1. Validate passwords match
      if (password !== confirmPassword) {
        await AuthHistoryUtil.logRegisterFailed(username, 'PASSWORDS_MISMATCH');
        return {
          success: false,
          message: "รหัสผ่านและรหัสผ่านยืนยันไม่ตรงกัน"
        };
      }

      // 2. Check if username already exists
      const existingUsername = await novaPlatform.users.findUnique({
        where: { username: username.trim() }
      });

      if (existingUsername) {
        await AuthHistoryUtil.logRegisterFailed(username, 'USERNAME_EXISTS');
        return {
          success: false,
          message: "ชื่อผู้ใช้นี้มีอยู่ในระบบแล้ว"
        };
      }

      // 3. Check if email already exists
      const existingEmail = await novaPlatform.users.findUnique({
        where: { email: email.trim().toLowerCase() }
      });

      if (existingEmail) {
        await AuthHistoryUtil.logRegisterFailed(username, 'EMAIL_EXISTS');
        return {
          success: false,
          message: "อีเมลนี้มีอยู่ในระบบแล้ว"
        };
      }

      // 4. Check if role exists (if provided)
      if (role_id) {
        const roleExists = await novaPlatform.roles.findUnique({
          where: { id: role_id }
        });

        if (!roleExists) {
          await AuthHistoryUtil.logRegisterFailed(username, 'INVALID_ROLE');
          return {
            success: false,
            message: "บทบาทที่ระบุไม่ถูกต้อง"
          };
        }
      }

      // 5. Hash password
      const passwordHash = await PasswordUtil.hash(password);

      // 6. Create user
      try {
        // ตรวจสอบ role ของ current user (ผู้สร้าง)
        const adminRoles = ['ADMIN', 'SUPERADMIN', 'IT-MANAGER', 'IT-SPECIALIST'];
        const currentUserHasAdminRole = currentUser?.roles?.some(role => adminRoles.includes(role));
        const shouldAutoApprove = currentUserHasAdminRole; // ถ้า current user เป็น admin → approve เลย

        const newUser = await novaPlatform.users.create({
          data: {
            username: username.trim(),
            email: email.trim().toLowerCase(),
            password_hash: passwordHash,
            custgroup: userData.custgroup || "",
            is_active: true,
            is_email_verified: false,
            is_approved: shouldAutoApprove, // approve ถ้า current user เป็น admin
            must_change_password: true,   // เข้าใช้งานครั้งแรก จำเป็นต้องเปลี่ยนรหัส
            creation_type: currentUser?.id ? 'ADMIN_CREATED' : 'SELF_REGISTER',
            create_by: currentUser?.username || null,
            approved_by: shouldAutoApprove ? currentUser?.id : null, // admin ที่ approve
            approved_at: shouldAutoApprove ? new Date() : null,
            created_at: new Date(),
            updated_at: new Date(),
            password_changed_at: new Date()
          }
        });

        // 7. Assign role
        const assignedRoleId = role_id || 'REGULAR-USER';

        await novaPlatform.user_roles.create({
          data: {
            user_id: newUser.id,
            role_id: assignedRoleId,
            assigned_at: new Date(),
            assigned_by_id: currentUser?.id || null,
            created_at: new Date(),
            updated_at: new Date()
          }
        });

        // 8. Create user profile
        await novaPlatform.profile.create({
          data: {
            user_id: newUser.id,
            created_at: new Date(),
            updated_at: new Date()
          }
        });

        // 9. Create user notification settings

        await novaPlatform.notification_settings.create({
          data: {
            user_id: newUser.id,
            login_notifications: false,      // ปิดก่อน
            security_notifications: false,   // ปิดก่อน  
            system_notifications: false,     // ปิดก่อน
            email_notifications: false,      // ปิดก่อน
            browser_notifications: false,    // ปิดก่อน
            created_at: new Date(),
            updated_at: new Date()
          }
        });

        // 10. Log successful registration
        setTimeout(async () => {
          await AuthHistoryUtil.logRegisterSuccess(newUser.id, username, {
            additional_data: { role: assignedRoleId }
          });
        }, 5000);

        // 11. ส่งอีเมลแจ้งเตือน admin (ทั้งอีเมลและในแอป)
        try {
          console.log('📧 [REGISTER] Starting to send admin notification...');

          await UserRegistrationEmailService.notifyNewUserRegistration({
            username: newUser.username,
            email: newUser.email,
            role: assignedRoleId,
            created_at: new Date().toLocaleString('th-TH'),
            registration_ip: clientInfo?.ip_address || '127.0.0.1',
            registration_device: clientInfo?.device_type || 'Unknown'
          });

          console.log('✅ [REGISTER] Admin notification sent successfully');
        } catch (notifyError) {
          console.error('❌ [REGISTER] Failed to send admin notification:', notifyError);
          // ไม่ throw error เพราะไม่อยากให้การสร้าง user ล้มเหลว
        }

        // 12. ส่งอีเมลต้อนรับให้ผู้ใช้ใหม่ - ส่งเสมอ
        try {
          console.log('👋 [REGISTER] Sending welcome email to new user...');
          console.log('👋 [REGISTER] User:', newUser.username, newUser.email);

          const welcomeResult = await WelcomeEmailService.sendWelcomeEmail({
            username: newUser.username,
            email: newUser.email,
            temporary_password: password, // รหัสผ่านก่อน hash
            role: assignedRoleId,
            created_at: new Date().toLocaleString('th-TH')
          });

          if (welcomeResult.success) {
            console.log('✅ [REGISTER] Welcome email sent to user:', newUser.email);
            console.log('✅ [REGISTER] Message ID:', welcomeResult.messageId);
          } else {
            console.error('⚠️ [REGISTER] Welcome email failed:', welcomeResult.error);
          }
        } catch (welcomeError) {
          console.error('❌ [REGISTER] Failed to send welcome email:', welcomeError);
        }

        return {
          success: true,
          message: "ลงทะเบียนสำเร็จ",
          data: {
            user: {
              id: newUser.id,
              username: newUser.username,
              email: newUser.email,
              role: assignedRoleId,
              is_approved: newUser.is_approved
            }
          }
        };

      } catch (createError: any) {
        if (createError.code === 'P2002') {
          await AuthHistoryUtil.logRegisterFailed(username, 'USER_EXISTS_RACE_CONDITION');
          return {
            success: false,
            message: "ชื่อผู้ใช้หรืออีเมลนี้มีอยู่ในระบบแล้ว"
          };
        }
        throw createError;
      }

    } catch (error) {
      console.error('Registration error:', error);
      await AuthHistoryUtil.logRegisterFailed(userData.username, 'INTERNAL_ERROR');
      return {
        success: false,
        message: "เกิดข้อผิดพลาดในการลงทะเบียน"
      };
    }
  }

  static async login(loginData: LoginDtoType, request?: any, clientInfo?: ClientInfo) {

    try {
      const { username: encryptedUsername, password: encryptedPassword } = loginData;

      let username, password;
      try {
        username = await decryptText(encryptedUsername);
        password = await decryptText(encryptedPassword);
      } catch (decryptError) {
        console.error('🔴 [LOGIN] Decryption failed:', decryptError);
        return { success: false, status: 400, message: 'Invalid credentials format' };
      }

      // ตรวจสอบว่าถอดรหัสได้หรือไม่
      if (!username || !password) {
        return { success: false, status: 400, message: 'Invalid credentials' };
      }

      // 🚀 Phase 1: Security Settings Cache ONLY (เปลี่ยนแทบไม่เคย, ใช้ทุก login)
      let settingsMap = new Map();
      const settingsCacheKey = 'system_config:config';

      if (isRedisAvailable) {
        try {
          const cachedSettings = await RedisManager.get(settingsCacheKey);
          if (cachedSettings) {
            const settingsArray = JSON.parse(cachedSettings);
            settingsArray.forEach((setting: any) => {
              let value;
              switch (setting.data_type) {
                case 'NUMBER': value = parseInt(setting.value, 10); break;
                case 'BOOLEAN': value = setting.value.toLowerCase() === 'true'; break;
                default: value = setting.value;
              }
              settingsMap.set(setting.id, value);
            });
            console.log('✅ [LOGIN] Security settings loaded from Redis cache');
          }
        } catch (redisError) {
          console.error('🔴 [LOGIN] Redis settings cache error:', redisError);
        }
      }

      // Fallback to database if cache miss
      if (settingsMap.size === 0) {
        console.log('🔄 [LOGIN] Security settings cache miss, fetching from database');
        const settingsArray = await novaPlatform.system_config.findMany({
          where: {
            id: { in: ['max_login_attempts', 'account_lock_minutes', 'password_expiry_days'] },
            is_active: true
          }
        });

        settingsArray.forEach((setting: any) => {
          let value;
          switch (setting.data_type) {
            case 'NUMBER': value = parseInt(setting.value, 10); break;
            case 'BOOLEAN': value = setting.value.toLowerCase() === 'true'; break;
            default: value = setting.value;
          }
          settingsMap.set(setting.id, value);
        });

        // Cache for 1 hour (เปลี่ยนไม่บ่อย)
        if (isRedisAvailable) {
          try {
            await RedisManager.set(settingsCacheKey, JSON.stringify(settingsArray), 3600);
            console.log('✅ [LOGIN] Security settings cached in Redis');
          } catch (redisError) {
            console.error('🔴 [LOGIN] Failed to cache security settings:', redisError);
          }
        }
      }

      // ใช้ค่า default ถ้าไม่พบ
      const maxFailedAttempts = settingsMap.get('max_login_attempts') ?? 5;
      const loginLockDurationMinutes = settingsMap.get('account_lock_minutes') ?? 5;
      const expiryDays = settingsMap.get('password_expiry_days') ?? 90;

      // 🔄 NO CACHE: User Data (query database ตรงๆ - เร็วอยู่แล้ว)
      console.log(`🔄 [LOGIN] Fetching user data from database for: ${username}`);
      const user = await novaPlatform.users.findFirst({
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

        console.log('🔒 [LOGIN] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🔒 [LOGIN] Max login attempts already reached!');
        console.log('🔒 [LOGIN] User:', user.username, user.email);
        console.log('🔒 [LOGIN] Current attempts:', user.failed_login_attempts);
        console.log('🔒 [LOGIN] Locking account until:', lockedUntil.toLocaleString('th-TH'));
        console.log('🔒 [LOGIN] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        // อัปเดต database
        try {
          await Promise.all([
            novaPlatform.users.update({
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

          console.log('✅ [LOGIN] Account locked in database');
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
      const isPasswordCorrect = await PasswordUtil.compare(password, user.password_hash);
      if (!isPasswordCorrect) {
        const newAttempts = user.failed_login_attempts + 1;
        const updateData: any = { failed_login_attempts: newAttempts };
        if (newAttempts >= maxFailedAttempts) {
          updateData.locked_until = new Date(Date.now() + loginLockDurationMinutes * 60 * 1000);
        }

        setTimeout(async () => {
          await Promise.all([
            novaPlatform.users.update({ where: { id: user.id }, data: updateData }),
            AuthHistoryUtil.logLoginFailed(username, 'INCORRECT_PASSWORD', {
              user_id: user.id, ...getLogData()
            })
          ]);
        }, 0);
        return { success: false, status: 401, message: 'Invalid username or password' };
      }

      // 🔄 NO CACHE: User Relations
      console.log(`🔄 [LOGIN] Fetching user relations from database for user: ${user.id}`);
      const [twoFactorAuth, userRoles, profile] = await Promise.all([
        novaPlatform.two_factor_auth.findUnique({ where: { user_id: user.id } }),
        novaPlatform.user_roles.findMany({
          where: { user_id: user.id },
          include: {
            roles: {
              include: {
                role_permissions: {
                  include: {
                    permissions: true
                  }
                }
              }
            }
          }
        }),
        novaPlatform.profile.findUnique({ where: { user_id: user.id } })
      ]);

      // ตรวจสอบว่าต้องใช้ 2FA หรือไม่
      const requires2FA = twoFactorAuth && twoFactorAuth.is_enabled;

      // หากต้องใช้ 2FA
      if (requires2FA) {
        const tfaSessionToken = await generateTfaSessionToken(user.id);
        await novaPlatform.two_factor_auth.update({
          where: { user_id: user.id },
          data: { tfaSessionToken: tfaSessionToken }
        });

        return {
          success: true, status: 200, message: 'Please verify two-factor authentication',
          requiresTwoFactor: true, tfaSessionToken, tfaMethod: 'TOTP', userId: user.id
        };
      }

      // ดึงบทบาทของผู้ใช้
      const roles = userRoles.map(ur => ur.roles.id);
      const permissionsSet = new Set<string>();
      userRoles.forEach(ur => {
        ur.roles.role_permissions.forEach(rp => {
          permissionsSet.add(rp.permissions.name);
        });
      });
      const permissions = Array.from(permissionsSet).sort(); // เรียงตามตัวอักษร

      // สร้าง session และ tokens
      const { sessionId, accessToken, refreshToken } = await createSessionForUser(user.id, roles, finalClientInfo);

      // 🚀 IMPORTANT CACHE ONLY: User Token (สำหรับ refresh token performance)
      if (isRedisAvailable) {
        try {
          const tokenCacheKey = `active_token:${user.id}`;
          const tokenCacheData = {
            accessToken,
            refreshToken,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            lastRefreshed: new Date().toISOString(),
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
            }
          };

          const cacheTTL = 7 * 24 * 60 * 60; // 7 days
          await RedisManager.set(tokenCacheKey, JSON.stringify(tokenCacheData), cacheTTL);
          console.log(`✅ [LOGIN] User tokens cached in Redis for user: ${user.username} (refresh token performance)`);
        } catch (redisError) {
          console.error('🔴 [LOGIN] Failed to cache user tokens:', redisError);
        }
      }

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

      // ⚡ Background operations - ไม่รอ (Session cleanup, user update, logging)
      setTimeout(async () => {
        await Promise.all([
          // Session cleanup
          SessionCleanupService.checkAndExpireSessions(),
          SessionCleanupService.moveExpiredSessionsToHistory(),

          // Update user login info
          novaPlatform.users.update({
            where: { id: user.id },
            data: { failed_login_attempts: 0, locked_until: null, last_login: new Date() }
          }),

          // Log login success
          AuthHistoryUtil.logLoginSuccess(user.id, username, {
            session_id: sessionId, ...getLogData()
          })


        ]);
        // ✅ ส่งอีเมลแจ้งเตือนการ login (ถ้าเปิดใช้งาน)
        try {
          const shouldNotify = await LoginNotificationEmailService.shouldSendLoginNotification(user.id);

          if (shouldNotify) {
            console.log('🔔 [LOGIN] Sending login notification email...');

            await LoginNotificationEmailService.sendLoginNotificationEmail({
              username: user.username,
              email: user.email,
              login_time: new Date().toLocaleString('th-TH'),
              ip_address: finalClientInfo.ip_address || 'Unknown',
              device_type: finalClientInfo.device_type || 'Unknown',
              browser: finalClientInfo.browser || 'Unknown',
              os: finalClientInfo.os || 'Unknown',
              platform: finalClientInfo.platform || 'Unknown',
              location: undefined // เพิ่มถ้ามี geolocation service
            });

            console.log('✅ [LOGIN] Login notification email sent');
          } else {
            console.log('ℹ️ [LOGIN] Login notification disabled for this user');
          }
        } catch (notifyError) {
          console.error('❌ [LOGIN] Failed to send login notification:', notifyError);
        }
      }, 0);


      setTimeout(async () => {
        const loginTime = new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });

        const message = `🟢 <b>ผู้ใช้เข้าสู่ระบบ</b>

👤 <b>ชื่อ:</b> ${user.username}
📧 <b>อีเมล:</b> ${user.email}
🔑 <b>User ID:</b> ${user.id}

🕐 <b>เวลา:</b> ${loginTime}
🌐 <b>IP:</b> ${clientInfo?.ip_address || 'ไม่ทราบ'}
💻 <b>อุปกรณ์:</b> ${clientInfo?.browser || 'ไม่ทราบ'} on ${clientInfo?.os || 'ไม่ทราบ'}`;

        await TelegramManager.sendToGroup('admin', message);
      }, 100);

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

  static async logout(logout: LogoutDtoType, request?: any) {
    try {
      const { username, sessionId } = logout;

      // ค้นหา session เฉพาะตัวที่ต้องการ logout
      const session = await novaPlatform.session.findFirst({
        where: {
          id: sessionId,
          is_active: true,
          users: {
            OR: [
              { username: username },
              { email: username }
            ]
          }
        },
        include: {
          users: {
            select: {
              id: true,
              username: true,
              email: true
            }
          }
        }
      });


      if (!session) {
        console.log('⚠️ [LOGOUT] No active session found, returning success anyway');
        return {
          success: true,
          status: 200,
          message: 'Logout successful'
        };
      }

      console.log('🔄 [LOGOUT] Updating session to inactive...');
      // อัปเดต session เฉพาะตัวนี้เป็น inactive
      await novaPlatform.session.update({
        where: {
          id: session.id
        },
        data: {
          is_active: false,
          updated_at: new Date(),
        },
      });
      console.log('✅ [LOGOUT] Session updated successfully');

      // 🗑️ Clear Redis token cache
      if (isRedisAvailable && session.user_id) {
        try {
          const cacheKey = `active_token:${session.user_id}`;
          const deleted = await RedisManager.del(cacheKey);
          console.log(`🗑️ [LOGOUT] Redis token cache ${deleted ? 'cleared' : 'not found'} for user: ${session.users.username}`);
        } catch (redisError) {
          console.error('🔴 [LOGOUT] Failed to clear Redis cache:', redisError);
          // Continue with logout process
        }
      }

      // บันทึก log การออกจากระบบ
      console.log('🔄 [LOGOUT] Getting client info...');
      const clientInfo = request ? getClientInfo(request) : {
        ip_address: '127.0.0.1',
        user_agent: null,
        browser: 'Unknown',
        os: 'Unknown',
        device_type: 'Unknown',
        platform: 'Unknown'
      };

      console.log('🔍 [LOGOUT] Client info:', clientInfo);

      console.log('🔄 [LOGOUT] Logging auth history...');
      await AuthHistoryUtil.logLogout(session.user_id, session.users.username, {
        session_id: session.id,
        ip_address: clientInfo.ip_address,
        user_agent: clientInfo.user_agent || undefined,
        browser: clientInfo.browser,
        os: clientInfo.os,
        auth_source: 'WEB'
      });
      console.log('✅ [LOGOUT] Auth history logged successfully');

      console.log(`✅ [LOGOUT] User ${session.users.username} logged out from session ${sessionId}`);

      return {
        success: true,
        status: 200,
        message: 'Logout successful'
      };

    } catch (error: any) {
      console.error('❌ [LOGOUT] Error during logout:', {
        error: error.message,
        stack: error.stack,
        username: logout.username,
        sessionId: logout.sessionId
      });

      return {
        success: true,
        status: 200,
        message: 'Logout completed'
      };
    }
  }

  static async adminConfirm(body: AdminConfirmType, currentUser: CurrentUser, clientInfo: ClientInfo) {
    try {
      const user = await novaPlatform.users.findUnique({
        where: {
          username: currentUser.username
        },
        select: {
          password_hash: true
        }
      });

      // ตรวจสอบว่าพบผู้ใช้หรือไม่
      if (!user) {
        return {
          success: false,
          message: 'User not found'
        }
      }

      // เปรียบเทียบรหัสผ่านที่ส่งมากับ hash ในฐานข้อมูล
      const isPasswordValid = await PasswordUtil.compare(body.password, user.password_hash);

      if (!isPasswordValid) {
        return {
          success: false,
          message: 'Invalid password'
        }
      }

      return {
        success: true,
        message: 'Admin confirmed successfully'
      };

    } catch (error) {
      console.error('Error in adminConfirm:', error);
      throw error;
    }
  }

  static async refreshToken(refreshTokenParam: string, retryCount = 0): Promise<any> {
    const MAX_RETRIES = 2;
    let decodedToken: any = null;
    const isDev = process.env.NODE_ENV === 'development';

    try {
      // ตรวจสอบ refresh token และรับข้อมูลจาก token
      decodedToken = await verifyRefreshToken(refreshTokenParam);
      const userId = parseInt(decodedToken.id, 10);

      if (!userId) {
        throw new Error('Invalid token: User data not found');
      }

      // 🎯 Check token lifetime first
      const tokenExp = decodedToken.exp * 1000; // convert to milliseconds
      const now = Date.now();
      const timeLeft = tokenExp - now;
      // Development: 1 hour, Production: 15 minutes
      const refreshThreshold = isDev ? 60 * 60 * 1000 : 15 * 60 * 1000;

      console.log(`🕐 [REFRESH_TOKEN] Time left: ${Math.round(timeLeft / 1000 / 60)} minutes, threshold: ${Math.round(refreshThreshold / 1000 / 60)} minutes`);

      // 🚀 Try Redis cache first if token still has time
      if (timeLeft > refreshThreshold && isRedisAvailable) {
        try {
          const cacheKey = `active_token:${userId}`;
          const cached = await RedisManager.get(cacheKey);

          if (cached) {
            const cachedData = JSON.parse(cached);
            console.log(`✅ [REFRESH_TOKEN] Token still valid, returning cached data for user: ${userId}`);

            // Verify cached token is still the same as request
            if (cachedData.refreshToken === refreshTokenParam) {
              return {
                status: 200,
                success: true,
                message: 'Token still valid',
                accessToken: cachedData.accessToken,
                refreshToken: cachedData.refreshToken,
                user: cachedData.user
              };
            }
          }
        } catch (redisError) {
          console.error('🔴 [REFRESH_TOKEN] Redis cache error:', redisError);
          // Continue to database fallback
        }
      }

      console.log(`🔄 [REFRESH_TOKEN] ${timeLeft <= refreshThreshold ? 'Token near expiry' : 'Cache miss'}, generating new tokens for user: ${userId}`);

      // ใช้ transaction เพื่อป้องกัน race condition
      return await novaPlatform.$transaction(async (tx) => {
        // ค้นหา session พร้อมล็อค (FOR UPDATE) เพื่อป้องกัน concurrent access
        const existingSession = await tx.session.findFirst({
          where: {
            refresh_token: refreshTokenParam,
            user_id: userId,
            is_active: true
          },
          include: {
            users: {
              select: {
                id: true,
                username: true,
                email: true,
                is_active: true,
                is_deleted: true,
                is_approved: true,
                must_change_password: true,
                is_email_verified: true,
                account_expiry: true,
                temporary_account: true
              }
            }
          }
        });

        // ถ้าไม่พบ session
        if (!existingSession) {
          throw new Error('Session does not exist in the system. Please log in again');
        }

        // ตรวจสอบสถานะ user
        const user = existingSession.users;
        if (!user.is_active) {
          // ทำ session เป็น inactive
          await tx.session.update({
            where: { id: existingSession.id },
            data: { is_active: false, updated_at: new Date() }
          });
          // 🗑️ Clear Redis cache
          if (isRedisAvailable) {
            await RedisManager.del(`active_token:${userId}`).catch(console.error);
          }
          throw new Error('Account is not active. Please log in again');
        }

        if (user.is_deleted) {
          await tx.session.update({
            where: { id: existingSession.id },
            data: { is_active: false, updated_at: new Date() }
          });
          // 🗑️ Clear Redis cache
          if (isRedisAvailable) {
            await RedisManager.del(`active_token:${userId}`).catch(console.error);
          }
          throw new Error('Account has been deleted. Please log in again');
        }

        if (!user.is_approved) {
          await tx.session.update({
            where: { id: existingSession.id },
            data: { is_active: false, updated_at: new Date() }
          });
          // 🗑️ Clear Redis cache
          if (isRedisAvailable) {
            await RedisManager.del(`active_token:${userId}`).catch(console.error);
          }
          throw new Error('Account is not approved. Please log in again');
        }

        // ตรวจสอบว่า session ยังไม่หมดอายุ
        if (new Date() > new Date(existingSession.expires_at)) {
          await tx.session.update({
            where: { id: existingSession.id },
            data: { is_active: false, updated_at: new Date() }
          });
          // 🗑️ Clear Redis cache
          if (isRedisAvailable) {
            await RedisManager.del(`active_token:${userId}`).catch(console.error);
          }
          throw new Error('Session has expired. Please log in again');
        }

        // ตรวจสอบ account expiry
        if (user.account_expiry && new Date() > new Date(user.account_expiry)) {
          await tx.session.update({
            where: { id: existingSession.id },
            data: { is_active: false, updated_at: new Date() }
          });
          // 🗑️ Clear Redis cache
          if (isRedisAvailable) {
            await RedisManager.del(`active_token:${userId}`).catch(console.error);
          }
          throw new Error('Account has expired. Please log in again');
        }

        // 🚀 Query User Relations แบบ Parallel
        const [userRoles, profile] = await Promise.all([
          tx.user_roles.findMany({
            where: { user_id: userId },
            include: {
              roles: {
                include: {
                  role_permissions: {
                    include: {
                      permissions: true
                    }
                  }
                }
              }
            }
          }),
          tx.profile.findUnique({ where: { user_id: userId } })
        ]);

        // สร้าง token ใหม่
        const accessToken = await generateAccessToken({ id: userId });
        const newRefreshToken = await generateRefreshToken(userId);

        // ดึงบทบาทของผู้ใช้
        const roles = userRoles.map(ur => ur.roles.id);
        const permissionsSet = new Set<string>();
        userRoles.forEach(ur => {
          ur.roles.role_permissions.forEach(rp => {
            permissionsSet.add(rp.permissions.name);
          });
        });
        const permissions = Array.from(permissionsSet).sort(); // เรียงตามตัวอักษร

        const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        // 🎯 Prepare response data
        const responseData = {
          status: 200,
          success: true,
          message: 'Token refreshed successfully',
          accessToken,
          refreshToken: newRefreshToken,
          user: {
            id: user.id,
            sessionId: existingSession.id.toString(),
            username: user.username,
            email: user.email,
            roles: roles,
            permissions: permissions,
            profile: profile ? {
              firstName: profile.first_name || '',
              lastName: profile.last_name || '',
              displayName: profile.display_name || '',
              avatarUrl: profile.avatar_url || '',
              phoneNumber: profile.phone_number || '',
            } : null
          }
        };

        // 🚀 Update Redis cache immediately (priority)
        if (isRedisAvailable) {
          try {
            const cacheKey = `active_token:${userId}`;
            const cacheData = {
              accessToken,
              refreshToken: newRefreshToken,
              expiresAt: newExpiresAt.toISOString(),
              lastRefreshed: new Date().toISOString(),
              user: responseData.user
            };

            const cacheTTL = Math.floor((newExpiresAt.getTime() - Date.now()) / 1000);
            await RedisManager.set(cacheKey, JSON.stringify(cacheData), cacheTTL > 0 ? cacheTTL : 3600);
            console.log(`✅ [REFRESH_TOKEN] New tokens cached in Redis for user: ${user.username}`);
          } catch (redisError) {
            console.error('🔴 [REFRESH_TOKEN] Failed to cache in Redis:', redisError);
            // Continue without cache
          }
        }

        // 🚀 Update database immediately (only when generating new tokens)
        await tx.session.update({
          where: { id: existingSession.id },
          data: {
            access_token: accessToken,
            refresh_token: newRefreshToken,
            updated_at: new Date(),
            expires_at: newExpiresAt
          }
        });

        console.log(`✅ [REFRESH_TOKEN] Token refreshed successfully for user: ${user.username}, session: ${existingSession.id}`);

        return responseData;
      });

    } catch (error: any) {
      console.error('🔥 [REFRESH_TOKEN] Error:', {
        error: error.message,
        stack: error.stack,
        userId: decodedToken?.id || 'unknown',
        retryCount
      });

      // 🗑️ Clear Redis cache on error
      if (decodedToken?.id && isRedisAvailable) {
        await RedisManager.del(`active_token:${decodedToken.id}`).catch(console.error);
      }

      // จัดการกับ error ต่างๆ
      if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid refresh token');
      } else if (error.name === 'TokenExpiredError') {
        throw new Error('Refresh token has expired. Please log in again');
      } else if (error.message.includes('Session does not exist') && retryCount < MAX_RETRIES) {
        // Retry logic สำหรับ race condition
        console.log(`🔄 [REFRESH_TOKEN] Retrying... (${retryCount + 1}/${MAX_RETRIES})`);
        await new Promise(resolve => setTimeout(resolve, 50 + (retryCount * 25))); // Exponential backoff
        return this.refreshToken(refreshTokenParam, retryCount + 1);
      } else {
        console.error('🔴 [REFRESH_TOKEN] Re-throwing original error:', error);
        throw error;
      }
    }
  }

  static async impersonate(
    targetUserId: number,
    adminUserId: number,
    { request, clientInfo }: any
  ) {
    try {
      const adminUser = await novaPlatform.users.findUnique({
        where: { id: adminUserId },
        select: { id: true, username: true, email: true }
      });

      if (!adminUser) {
        return { success: false, status: 404, message: 'Admin user not found' };
      }

      const targetUser = await novaPlatform.users.findUnique({
        where: { id: targetUserId }
      });

      if (!targetUser) {
        return { success: false, status: 404, message: 'User not found' };
      }

      if (!targetUser.is_active) {
        return { success: false, status: 403, message: 'This account is inactive' };
      }

      if (!targetUser.is_approved) {
        return { success: false, status: 403, message: 'This account is not approved' };
      }

      if (targetUser.is_deleted) {
        return { success: false, status: 403, message: 'This account is deleted' };
      }

      const [userRoles, profile] = await Promise.all([
        novaPlatform.user_roles.findMany({
          where: { user_id: targetUser.id },
          include: {
            roles: {
              include: {
                role_permissions: {
                  include: { permissions: true }
                }
              }
            }
          }
        }),
        novaPlatform.profile.findUnique({ where: { user_id: targetUser.id } })
      ]);

      const roles = userRoles.map(ur => ur.roles.id);
      const permissionsSet = new Set<string>();
      userRoles.forEach(ur => {
        ur.roles.role_permissions.forEach(rp => {
          permissionsSet.add(rp.permissions.name);
        });
      });
      const permissions = Array.from(permissionsSet).sort();

      const { sessionId, accessToken, refreshToken } = await createSessionForUser(
        targetUser.id,
        roles,
        request
      );

      if (isRedisAvailable) {
        try {
          const tokenCacheKey = `active_token:${targetUser.id}`;
          const tokenCacheData = {
            accessToken,
            refreshToken,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            lastRefreshed: new Date().toISOString(),
            user: {
              id: targetUser.id,
              sessionId: sessionId,
              username: targetUser.username,
              email: targetUser.email,
              roles: roles,
              permissions: permissions,
              profile: profile ? {
                firstName: profile.first_name,
                lastName: profile.last_name,
                displayName: profile.display_name,
                avatarUrl: profile.avatar_url,
                phoneNumber: profile.phone_number,
              } : null
            }
          };

          const cacheTTL = 7 * 24 * 60 * 60;
          await RedisManager.set(tokenCacheKey, JSON.stringify(tokenCacheData), cacheTTL);
        } catch (redisError) {
          console.error('Failed to cache tokens:', redisError);
        }
      }

      setTimeout(async () => {
        await Promise.all([
          SessionCleanupService.checkAndExpireSessions(),
          SessionCleanupService.moveExpiredSessionsToHistory(),
        ]);
      }, 0);

      return {
        status: 200,
        success: true,
        message: 'Impersonation successful',
        user: {
          id: targetUser.id,
          sessionId: sessionId,
          username: targetUser.username,
          email: targetUser.email,
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
          mustChangePassword: false,
          isEmailVerified: targetUser.is_email_verified,
          hasTwoFactor: false,
          passwordExpiry: false,
          accountExpiry: null,
          temporaryAccount: false,
        },
        accessToken,
        refreshToken
      };

    } catch (error) {
      console.error('Impersonate error:', error);
      return { success: false, status: 500, message: 'Internal server error' };
    }
  }

  static async getAuthHistory(params: {
    user_id?: number;
    page?: number;
    limit?: number;
    auth_type?: string;
    auth_status?: string;
    start_date?: string;
    end_date?: string;
  }) {
    const {
      user_id,
      page = 1,
      limit = 20,
      auth_type,
      auth_status,
      start_date,
      end_date
    } = params;

    // สร้าง where clause
    const where: any = {};

    if (user_id) {
      where.user_id = user_id;
    }

    if (auth_type) {
      where.auth_type = auth_type;
    }

    if (auth_status) {
      where.auth_status = auth_status;
    }

    if (start_date || end_date) {
      where.created_at = {};
      if (start_date) {
        where.created_at.gte = new Date(start_date);
      }
      if (end_date) {
        where.created_at.lte = new Date(end_date);
      }
    }

    // คำนวณ pagination
    const skip = (page - 1) * limit;

    // ดึงข้อมูลและนับจำนวนทั้งหมด
    const [data, total] = await Promise.all([
      novaPlatform.auth_history.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          created_at: 'desc'
        },
        include: {
          users: {
            select: {
              id: true,
              username: true,
              email: true
            }
          }
        }
      }),
      novaPlatform.auth_history.count({ where })
    ]);

    // คำนวณ pagination metadata
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    return {
      success: true,
      status: 200,
      data: data.map(item => ({
        id: item.id,
        user_id: item.user_id,
        username: item.username,
        auth_type: item.auth_type,
        auth_status: item.auth_status,
        failure_reason: item.failure_reason,
        ip_address: item.ip_address,
        user_agent: item.user_agent,
        device_info: item.device_info,
        browser: item.browser,
        os: item.os,
        location: item.location,
        auth_source: item.auth_source,
        session_id: item.session_id,
        two_factor_used: item.two_factor_used,
        remember_me: item.remember_me,
        logout_time: item.logout_time,
        session_duration: item.session_duration,
        created_at: item.created_at,
        user: item.users
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage,
        hasPrevPage
      }
    };
  }

  static async getAuthHistoryStats(user_id?: number) {
    const where: any = user_id ? { user_id } : {};

    const [
      totalLogins,
      successfulLogins,
      failedLogins,
      uniqueIPs,
      recentActivity
    ] = await Promise.all([
      novaPlatform.auth_history.count({
        where: { ...where, auth_type: 'LOGIN' }
      }),
      novaPlatform.auth_history.count({
        where: { ...where, auth_type: 'LOGIN', auth_status: 'SUCCESS' }
      }),
      novaPlatform.auth_history.count({
        where: { ...where, auth_type: 'LOGIN', auth_status: 'FAILED' }
      }),
      novaPlatform.auth_history.groupBy({
        by: ['ip_address'],
        where: { ...where, auth_type: 'LOGIN' },
        _count: true
      }),
      novaPlatform.auth_history.findMany({
        where: { ...where, auth_type: 'LOGIN' },
        orderBy: { created_at: 'desc' },
        take: 5,
        select: {
          created_at: true,
          auth_status: true,
          ip_address: true,
          browser: true,
          os: true
        }
      })
    ]);

    return {
      success: true,
      status: 200,
      stats: {
        totalLogins,
        successfulLogins,
        failedLogins,
        successRate: totalLogins > 0
          ? ((successfulLogins / totalLogins) * 100).toFixed(2) + '%'
          : '0%',
        uniqueIPsCount: uniqueIPs.length,
        recentActivity
      }
    };
  }

  static async resetPasswordRequest(email: string) {
    try {
      console.log('🚀 Starting password reset for:', email);

      const user = await novaPlatform.users.findUnique({
        where: { email: email, is_active: true },
        select: {
          id: true,
          username: true,
          email: true,
          is_active: true,
          is_deleted: true,
          is_email_verified: true,
          last_password_reset_request_at: true
        }
      });

      console.log('👤 User found:', !!user);

      // กรณีไม่พบ user หรือ user ไม่ผ่านเงื่อนไข
      if (!user || !user.is_email_verified || !user.is_active || user.is_deleted) {
        let message = '';

        if (!user) {
          console.log('❌ No user found, returning generic response');
          message = 'If your email is registered, you will receive a password reset code';
        } else if (!user.is_email_verified) {
          console.log('❌ Email not verified, returning generic response');
          message = 'If your email is verified, you will receive a password reset code';
        } else if (!user.is_active) {
          console.log('❌ User is inactive, returning generic response');
          message = 'If your email is registered, you will receive a password reset code';
        } else if (user.is_deleted) {
          console.log('❌ User is deleted, returning generic response');
          message = 'If your email is registered, you will receive a password reset code';
        }

        return {
          success: false,
          message: message
        };
      }

      const COOLDOWN_MINUTES = 0;

      // ตรวจสอบ cooldown
      if (user.last_password_reset_request_at) {
        const nextAllowedRequestTime = new Date(
          user.last_password_reset_request_at.getTime() + COOLDOWN_MINUTES * 60000
        );

        if (new Date() < nextAllowedRequestTime) {
          const remainingMinutes = Math.ceil(
            (nextAllowedRequestTime.getTime() - new Date().getTime()) / 60000
          );

          console.log('⏰ Cooldown active:', remainingMinutes, 'minutes');
          console.error({
            success: false,
            error: 'cooldown',
            message: `You need to wait ${remainingMinutes} minute(s) before requesting again`
          });
        }
      }

      // หาชื่อผู้ใช้
      const profile = await novaPlatform.profile.findUnique({
        where: { user_id: user.id },
        select: {
          first_name: true,
          last_name: true,
        }
      });

      console.log('👤 Profile found:', !!profile);

      // Generate codes
      const verificationCode = generateVerificationCode();
      console.log('🔐 Generated verification code:', verificationCode);

      const expiryDate = new Date();
      expiryDate.setMinutes(expiryDate.getMinutes() + 5);

      // Update database
      console.log('💾 Updating database...');
      await novaPlatform.users.update({
        where: { id: user.id },
        data: {
          password_reset_code: verificationCode,
          password_reset_expiry: expiryDate,
          last_password_reset_request_at: new Date(),
        }
      });

      console.log('✅ Database updated successfully');

      // Helper function
      const getDisplayName = (profile: any, username: string): string => {
        if (profile?.first_name || profile?.last_name) {
          return `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim();
        }
        return username;
      };

      // ตรวจสอบสถานะ email service
      const emailStatus = getEmailStatus();
      await getEmailStatus();
      if (!emailStatus.isAvailable) {
        console.error('❌ Email service is not available');
        return {
          success: true,
          message: 'Verification code sent successfully',
          debug: 'Email service unavailable'
        };
      }

      const displayName = getDisplayName(profile, user.username);
      console.log('📝 Display name:', displayName);

      // ส่งอีเมลผ่าน EmailManager
      try {
        console.log('📨 Sending verification email...');
        const emailResult = await EmailManager.sendVerificationCode(user.email, verificationCode);

        if (emailResult) {
          console.log('✅ Email sent successfully');
        } else {
          console.error('❌ Email send failed');
          return {
            success: true,
            message: 'Verification code sent successfully',
          };
        }
      } catch (emailError) {
        console.error('❌ Email send error:', emailError);
        return {
          success: true,
          message: 'Verification code sent successfully',
          debug: 'Email configuration issue - check logs'
        };
      }

      return {
        success: true,
        message: 'Verification code sent successfully',
      };

    } catch (error) {
      console.error('🔥 Error in requestResetPassword:', error);

      // ใช้ instanceof ตรวจสอบ error type โดยตรง
      if (error instanceof Error && error.message.includes('cooldown')) {
        throw new Error('Please wait before requesting another password reset');
      }

      throw new Error('Failed to process password reset request. Please try again later.');
    }
  }

  static async verifyResetPassword(body: any) {
    try {
      const { code, email } = body;

      // Find user
      const user = await novaPlatform.users.findUnique({
        where: {
          email,
        }
      });

      if (!user) {
        return {
          success: false,
          error: 'USER_NOT_FOUND',
          message: 'ไม่พบบัญชีผู้ใช้ดังกล่าว'
        };
      }

      if (!user.password_reset_expiry || !user.password_reset_code) {
        return {
          success: false,
          error: 'NO_RESET_REQUEST',
          message: 'ไม่มีคำขอรีเซ็ตรหัสผ่านที่ใช้งานได้'
        };
      }

      // Check if reset token is expired
      if (new Date() > user.password_reset_expiry) {
        return {
          success: false,
          error: 'CODE_EXPIRED',
          message: 'รหัสยืนยันหมดอายุแล้ว กรุณาขอรหัสใหม่'
        };
      }

      // Verify the code
      if (user.password_reset_code !== code) {
        return {
          success: false,
          error: 'INVALID_CODE',
          message: 'รหัสยืนยันไม่ถูกต้อง'
        };
      }

      // Generate a new secure token for password reset
      const resetToken = crypto.randomBytes(32).toString('hex');

      // Update user with the new reset token (keep the same expiry)
      await novaPlatform.users.update({
        where: { id: user.id },
        data: {
          password_reset_token: resetToken,
          // Clear the code after successful verification
          password_reset_code: null,
          updated_at: new Date()
        }
      });

      // Return token for the next step (actually resetting the password)
      return {
        success: true,
        message: 'ยืนยันรหัสเรียบร้อยแล้ว',
        resetToken: resetToken,
        expiresAt: user.password_reset_expiry
      };

    } catch (error) {
      console.error('Code verification error:', error);
      return {
        success: false,
        error: 'SERVER_ERROR',
        message: 'เกิดข้อผิดพลาดระหว่างการตรวจสอบรหัส'
      };
    }
  }

  static async ResetPasswordFinal(body: any, ClientInfo: ClientInfo, clientInfo: any) {
    try {
      const { passwordResetToken, newPassword } = body;

      // Find user by reset token
      const user = await novaPlatform.users.findFirst({
        where: {
          password_reset_token: passwordResetToken,
          password_reset_expiry: { gt: new Date() },
          is_active: true,
          is_deleted: false
        }
      });

      if (!user) {
        return {
          success: false,
          error: 'INVALID_TOKEN',
          message: 'Token ไม่ถูกต้องหรือหมดอายุแล้ว'
        };
      }

      // 1. ตรวจสอบว่า newPassword ไม่ตรงกับรหัสผ่านปัจจุบัน
      const isSameAsCurrent = await bcrypt.compare(newPassword, user.password_hash);
      if (isSameAsCurrent) {
        return {
          success: false,
          error: 'SAME_AS_CURRENT',
          message: 'ไม่สามารถใช้รหัสผ่านเดิมได้ กรุณาตั้งรหัสผ่านใหม่'
        };
      }

      // 2. ตรวจสอบในประวัติรหัสผ่าน (ทุกประวัติไม่จำกัดจำนวน)
      const passwordHistory = await novaPlatform.password_history.findMany({
        where: {
          user_id: user.id,
          change_reason: { in: ['RESET', 'CHANGE'] }
        },
        orderBy: { created_at: 'desc' }
        // ลบ take ออก เพื่อดึงทุกรายการ
      });

      // ตรวจสอบว่า newPassword ตรงกับรหัสผ่านในประวัติหรือไม่
      for (const history of passwordHistory) {
        const isMatch = await bcrypt.compare(newPassword, history.password_hash);
        if (isMatch) {
          return {
            success: false,
            error: 'PASSWORD_USED_BEFORE',
            message: 'ไม่สามารถใช้รหัสผ่านที่เคยใช้ก่อนหน้านี้ได้ กรุณาตั้งรหัสผ่านใหม่'
          };
        }
      }

      // ตรวจสอบว่า newPassword ตรงกับรหัสผ่านในประวัติหรือไม่
      for (const history of passwordHistory) {
        const isMatch = await bcrypt.compare(newPassword, history.password_hash);
        if (isMatch) {
          return {
            success: false,
            error: 'PASSWORD_USED_BEFORE',
            message: 'ไม่สามารถใช้รหัสผ่านที่เคยใช้ก่อนหน้านี้ได้ กรุณาตั้งรหัสผ่านใหม่'
          };
        }
      }

      // Hash the new password
      const salt = await bcrypt.genSalt(12);
      const passwordHash = await bcrypt.hash(newPassword, salt);

      // Save current password to history
      await novaPlatform.password_history.create({
        data: {
          user_id: user.id,
          password_hash: user.password_hash,
          change_reason: 'RESET',
          ip_address: clientInfo.ip_address,
          user_agent: clientInfo.user_agent,
          changed_by_user_id: user.id,
          created_at: new Date()
        }
      });

      // Update user with new password and clear reset tokens
      await novaPlatform.users.update({
        where: { id: user.id },
        data: {
          password_hash: passwordHash,
          password_reset_token: null,
          password_reset_code: null,
          password_reset_expiry: null,
          password_changed_at: new Date(),
          failed_login_attempts: 0,
          locked_until: null,
          updated_at: new Date()
        }
      });

      return {
        success: true,
        message: 'รีเซ็ตรหัสผ่านสำเร็จ'
      };

    } catch (error) {
      console.error('Password reset error:', error);
      return {
        success: false,
        error: 'SERVER_ERROR',
        message: 'เกิดข้อผิดพลาดขณะรีเซ็ตรหัสผ่าน กรุณาลองใหม่อีกครั้ง'
      };
    }
  }

  
}
