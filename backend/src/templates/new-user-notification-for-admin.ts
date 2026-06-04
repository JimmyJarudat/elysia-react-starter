// src/services/user-registration-email.service.ts
import { EmailManager } from '@/config/smtp.config';
import prisma from '@/config/prisma.config';
import { formatSystemDateSync } from '@/utils/date-formatter';
import { EmailTemplateConfig, getEmailTemplateConfig } from '@/utils/email-template-config';

export interface EmailTemplateData {
  username: string;
  email: string;
  role: string;
  created_at: string;
  registration_ip?: string;
  registration_device?: string;
}

interface AdminUserInfo {
  user_id: number; // เพิ่ม user_id
  email: string;
  display_name: string;
  roles: string[];
}

export class UserRegistrationEmailService {

  // ส่งอีเมลแจ้งเตือนการสร้าง user ใหม่ให้ admin
  static async notifyNewUserRegistration(userData: EmailTemplateData): Promise<{
    emailsSent: number;
    notificationsCreated: number;
    recipients: { email: string; display_name: string; roles: string[]; }[];
  }> {
    try {
      // 1. ดึงรายชื่อ admin ที่ต้องแจ้งเตือน
      const adminUsers = await this.getAdminUsers();

      if (adminUsers.length === 0) {
        console.warn('No admin users found to notify');
        return {
          emailsSent: 0,
          notificationsCreated: 0,
          recipients: []
        };
      }

      // 2. สร้างเนื้อหาอีเมล
      const templateConfig = await getEmailTemplateConfig();
      const emailSubject = `🔔 มีผู้ใช้ใหม่ลงทะเบียนในระบบ - ${userData.username}`;
      const emailBody = this.generateNewUserEmailTemplate(userData, templateConfig);

      // 3. ส่งอีเมลให้ admin แต่ละคน
      const emailPromises = adminUsers.map(admin =>
        this.sendEmail(admin.email, admin.display_name, emailSubject, emailBody)
      );

      await Promise.all(emailPromises);

      // 4. บันทึกการแจ้งเตือนลงฐานข้อมูลสำหรับแต่ละ admin
      const notificationPromises = adminUsers.map(admin =>
        prisma.notifications.create({
          data: {
            user_id: admin.user_id,
            title: `มีผู้ใช้ใหม่ลงทะเบียน: ${userData.username}`,
            message: `ผู้ใช้ ${userData.username} (${userData.email}) ลงทะเบียนเข้าสู่ระบบด้วยบทบาท ${userData.role} เมื่อ ${userData.created_at}`,
            type: 'SYSTEM',
            priority: 'NORMAL',
            is_read: false,
            created_at: new Date()
          }
        })
      );

      await Promise.all(notificationPromises);

      console.log(`New user notification sent to ${adminUsers.length} admins (email + in-app)`);

      return {
        emailsSent: adminUsers.length,
        notificationsCreated: adminUsers.length,
        recipients: adminUsers.map(admin => ({
          email: admin.email,
          display_name: admin.display_name,
          roles: admin.roles
        }))
      };

    } catch (error) {
      console.error('Failed to send new user notification:', error);
      return {
        emailsSent: 0,
        notificationsCreated: 0,
        recipients: []
      };
    }
  }

  // ดึงรายชื่อ admin users ที่เปิดรับการแจ้งเตือน
  private static async getAdminUsers(): Promise<AdminUserInfo[]> {
    try {
      const adminRoles = ['SUPERADMIN', 'ADMIN'];

      // ค้นหา users ที่มี admin roles ผ่าน users table
      const usersWithAdminRoles = await prisma.users.findMany({
        where: {
          is_active: true,
          is_approved: true,
          user_roles_user_roles_user_idTousers: {
            some: {
              role_id: {
                in: adminRoles
              }
            }
          }
        },
        include: {
          profile: {
            select: {
              display_name: true,
              first_name: true,
              last_name: true
            }
          },
          notification_settings: true,
          user_roles_user_roles_user_idTousers: {
            include: {
              roles: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          }
        }
      });

      // แปลงข้อมูลและกรองเฉพาะที่เปิดรับการแจ้งเตือน
      const adminUsers: AdminUserInfo[] = [];

      for (const user of usersWithAdminRoles) {

        // ถ้าไม่มี settings หรือ email_notifications ไม่ได้ถูกปิดไว้ชัดเจน → ส่งได้
        const settings = user.notification_settings;
        const shouldReceiveEmail = settings === null || settings.email_notifications !== false;

        if (!shouldReceiveEmail) continue;

        // สร้างข้อมูล user
        const displayName = user.profile?.display_name ||
          `${user.profile?.first_name || ''} ${user.profile?.last_name || ''}`.trim() ||
          user.username;

        // รวม roles ของ user
        const userRoles = user.user_roles_user_roles_user_idTousers.map(ur => ur.roles.name);

        adminUsers.push({
          user_id: user.id, // เพิ่ม user_id
          email: user.email,
          display_name: displayName,
          roles: userRoles
        });
      }

      return adminUsers;

    } catch (error) {
      console.error('Error fetching admin users:', error);
      return [];
    }
  }

  // สร้าง HTML template สำหรับอีเมลแจ้งเตือน
  private static generateNewUserEmailTemplate(userData: EmailTemplateData, config: EmailTemplateConfig): string {
  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>การแจ้งเตือนผู้ใช้ใหม่</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
    <!-- Container -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f4f4; padding: 20px 0;">
        <tr>
            <td align="center">
                <!-- Main Content Table -->
                <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; max-width: 600px;">
                    
                    <!-- Header -->
                    <tr>
                        <td style="background-color: #667eea; padding: 30px; text-align: center;">
                            <h1 style="margin: 0; font-size: 24px; color: #ffffff;">🔔 การแจ้งเตือนผู้ใช้ใหม่</h1>
                            <p style="margin: 10px 0 0 0; color: #ffffff; font-size: 14px;">มีผู้ใช้ใหม่ลงทะเบียนในระบบ ${config.appName}</p>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 30px;">
                            <p style="margin: 0 0 15px 0; color: #333333; font-size: 14px; line-height: 1.6;">สวัสดีครับ/ค่ะ</p>
                            <p style="margin: 0 0 20px 0; color: #333333; font-size: 14px; line-height: 1.6;">มีผู้ใช้ใหม่ลงทะเบียนเข้าสู่ระบบ <strong>${config.appName}</strong> กรุณาตรวจสอบและอนุมัติการใช้งาน</p>
                            
                            <!-- User Info Box -->
                            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8f9fa; border-left: 4px solid #667eea; margin: 20px 0;">
                                <tr>
                                    <td style="padding: 20px;">
                                        <h3 style="margin: 0 0 15px 0; color: #667eea; font-size: 16px;">📋 ข้อมูลผู้ใช้ใหม่</h3>
                                        
                                        <!-- Info Rows -->
                                        <table width="100%" cellpadding="8" cellspacing="0" border="0">
                                            <tr style="border-bottom: 1px solid #e9ecef;">
                                                <td style="font-weight: bold; color: #495057; font-size: 13px; width: 35%;">👤 ชื่อผู้ใช้:</td>
                                                <td style="color: #212529; font-size: 13px; text-align: right;"><strong>${userData.username}</strong></td>
                                            </tr>
                                            <tr style="border-bottom: 1px solid #e9ecef;">
                                                <td style="font-weight: bold; color: #495057; font-size: 13px;">📧 อีเมล:</td>
                                                <td style="color: #212529; font-size: 13px; text-align: right;">${userData.email}</td>
                                            </tr>
                                            <tr style="border-bottom: 1px solid #e9ecef;">
                                                <td style="font-weight: bold; color: #495057; font-size: 13px;">🎭 บทบาท:</td>
                                                <td style="color: #212529; font-size: 13px; text-align: right;">
                                                    <span style="background-color: #e9ecef; padding: 4px 8px; border-radius: 12px; font-size: 12px;">${userData.role}</span>
                                                </td>
                                            </tr>
                                            <tr style="border-bottom: 1px solid #e9ecef;">
                                                <td style="font-weight: bold; color: #495057; font-size: 13px;">🕐 วันที่ลงทะเบียน:</td>
                                                <td style="color: #212529; font-size: 13px; text-align: right;">${userData.created_at}</td>
                                            </tr>
                                            ${userData.registration_ip ? `
                                            <tr style="border-bottom: 1px solid #e9ecef;">
                                                <td style="font-weight: bold; color: #495057; font-size: 13px;">🌐 IP Address:</td>
                                                <td style="color: #212529; font-size: 13px; text-align: right;">${userData.registration_ip}</td>
                                            </tr>
                                            ` : ''}
                                            ${userData.registration_device ? `
                                            <tr>
                                                <td style="font-weight: bold; color: #495057; font-size: 13px;">📱 อุปกรณ์:</td>
                                                <td style="color: #212529; font-size: 13px; text-align: right;">${userData.registration_device}</td>
                                            </tr>
                                            ` : ''}
                                        </table>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Alert Box -->
                            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #fff3cd; border: 1px solid #ffeaa7; margin: 20px 0;">
                                <tr>
                                    <td style="padding: 15px;">
                                        <p style="margin: 0; color: #856404; font-size: 13px; line-height: 1.6;">
                                            <strong>⚠️ ต้องการดำเนินการ:</strong><br>
                                            ผู้ใช้นี้ยังไม่ได้รับการอนุมัติ กรุณาเข้าสู่ระบบ ${config.appName} เพื่อตรวจสอบและอนุมัติการใช้งาน
                                        </p>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Button -->
                            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 20px 0;">
                                <tr>
                                    <td align="center">
                                        <a href="${config.appUrl}/admin-console/users"
                                           style="display: inline-block; background-color: #667eea; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; font-size: 14px;">
                                            🔗 เข้าสู่ระบบจัดการ
                                        </a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f8f9fa; padding: 20px; text-align: center;">
                            <p style="margin: 0 0 10px 0; color: #6c757d; font-size: 13px;">อีเมลนี้ส่งอัตโนมัติจาก ${config.appName} กรุณาอย่าตอบกลับ</p>
                            <p style="margin: 0 0 15px 0; color: #6c757d; font-size: 13px;">หากมีปัญหา กรุณาติดต่อทีม IT</p>
                            <hr style="border: none; border-top: 1px solid #dee2e6; margin: 15px 0;">
                            <p style="margin: 0; color: #999999; font-size: 11px;">
                                © ${new Date().getFullYear()} ${config.appName} | ส่งเมื่อ ${formatSystemDateSync()}
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
  `;
}

  // ฟังก์ชันส่งอีเมล
  private static async sendEmail(
    to: string,
    recipientName: string,
    subject: string,
    htmlContent: string
  ): Promise<{ success: boolean; messageId?: string; error?: string; recipient: string }> {
    try {
      const success = await EmailManager.sendMail({
        to,
        subject,
        html: htmlContent,
        text: `มีผู้ใช้ใหม่ลงทะเบียน: ${subject}`,
      });

      if (success) {
        console.log(`Email sent successfully to ${to}`);
        return { success: true, recipient: to };
      } else {
        return { success: false, error: 'EmailManager.sendMail returned false', recipient: to };
      }

    } catch (error: any) {
      console.error(`Failed to send email to ${to}:`, error);
      return { success: false, error: error.message, recipient: to };
    }
  }

  // ส่งอีเมลทดสอบ
  static async sendTestEmail(testEmail: string): Promise<{ success: boolean; messageId?: string; error?: string; recipient: string }> {
    const testData: EmailTemplateData = {
      username: 'test_user',
      email: 'test@example.com',
      role: 'REGULAR-USER',
      created_at: formatSystemDateSync(),
      registration_ip: '127.0.0.1',
      registration_device: 'Desktop'
    };

    const subject = '🧪 [TEST] การแจ้งเตือนผู้ใช้ใหม่ - ทดสอบระบบ';
    const templateConfig = await getEmailTemplateConfig();
    const htmlContent = this.generateNewUserEmailTemplate(testData, templateConfig);

    return await this.sendEmail(testEmail, 'ผู้ทดสอบ', subject, htmlContent);
  }

  // ตรวจสอบการเชื่อมต่อ SMTP
  static async verifyConnection(): Promise<{ success: boolean; message?: string; error?: string }> {
    const { pingSmtp } = await import('@/config/smtp.config');
    const result = await pingSmtp();
    if (result.connected) {
      return { success: true, message: 'SMTP connection verified' };
    }
    return { success: false, error: result.error };
  }

  // ตรวจสอบว่า user ควรได้รับการแจ้งเตือนหรือไม่
  private static async shouldReceiveEmailNotification(userId: number): Promise<boolean> {
    try {
      const settings = await prisma.notification_settings.findUnique({
        where: { user_id: userId }
      });

      // ถ้าไม่มี settings ให้ถือว่าไม่ต้องการรับ
      if (!settings) {
        return false;
      }

      return settings.email_notifications && settings.system_notifications;
    } catch (error) {
      console.error('Error checking notification settings:', error);
      return false;
    }
  }
}

// ===== INTEGRATION EXAMPLE =====
/*
เพิ่มในไฟล์ auth.service.ts ใน register function:

import { UserRegistrationEmailService } from '@/services/user-registration-email.service';

// หลังจาก Create user profile (ขั้นตอนที่ 8)
// 9. Create default notification settings (ปิดก่อน ให้ user เลือกเอง)
await prisma.notification_settings.create({
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
await AuthHistoryUtil.logRegisterSuccess(newUser.id, username, {
  additional_data: { role: assignedRoleId }
});

// 11. ส่งอีเมลแจ้งเตือน admin (ทั้งอีเมลและในแอป)
const notificationResult = await UserRegistrationEmailService.notifyNewUserRegistration({
  username: newUser.username,
  email: newUser.email,
  role: assignedRoleId,
  created_at: formatSystemDateSync(),
  registration_ip: ctx?.request?.headers?.get('x-forwarded-for') ||
                   ctx?.request?.headers?.get('cf-connecting-ip') ||
                   ctx?.request?.headers?.get('x-real-ip') ||
                   '127.0.0.1',
  registration_device: ctx?.request?.headers?.get('user-agent')?.includes('Mobile') ? 'Mobile' : 'Desktop'
});

console.log('Registration notifications sent:', notificationResult);
*/
