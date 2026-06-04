// src/services/login-notification-email.service.ts
import { EmailManager } from '@/config/smtp.config';
import prisma from '@/config/prisma.config';
import { formatSystemDateSync } from '@/utils/date-formatter';
import { EmailTemplateConfig, getEmailTemplateConfig } from '@/utils/email-template-config';
export interface LoginNotificationEmailData {
  username: string;
  email: string;
  login_time: string;
  ip_address: string;
  device_type: string;
  browser: string;
  os: string;
  platform: string;
  location?: string;
}

export class LoginNotificationEmailService {
  
  // ตรวจสอบว่า user เปิดการแจ้งเตือน login หรือไม่
  static async shouldSendLoginNotification(userId: number): Promise<boolean> {
    try {
      const settings = await prisma.notification_settings.findUnique({
        where: { user_id: userId },
        select: { 
          login_notifications: true,
          email_notifications: true 
        }
      });
      
      // ต้องเปิดทั้ง login_notifications และ email_notifications
      return settings?.login_notifications === true && settings?.email_notifications === true;
    } catch (error) {
      console.error('❌ [LOGIN_NOTIFICATION] Error checking settings:', error);
      return false;
    }
  }
  
  // ส่งอีเมลแจ้งเตือนการเข้าสู่ระบบ
  static async sendLoginNotificationEmail(data: LoginNotificationEmailData): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
  }> {
    try {
      console.log('🔔 [LOGIN_NOTIFICATION] Sending login notification to:', data.email);
      const templateConfig = await getEmailTemplateConfig();
      
      const emailSubject = `🔐 แจ้งเตือนการเข้าสู่ระบบ - ${data.username}`;
      const emailBody = this.generateLoginNotificationEmailTemplate(data, templateConfig);
      
      const result = await this.sendEmail(
        data.email,
        data.username,
        emailSubject,
        emailBody
      );
      
      if (result.success) {
        console.log('✅ [LOGIN_NOTIFICATION] Login notification sent successfully');
      } else {
        console.error('❌ [LOGIN_NOTIFICATION] Failed to send:', result.error);
      }
      
      return result;
      
    } catch (error) {
      console.error('❌ [LOGIN_NOTIFICATION] Failed to send login notification:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // สร้าง HTML template สำหรับอีเมลแจ้งเตือน
  private static generateLoginNotificationEmailTemplate(data: LoginNotificationEmailData, config: EmailTemplateConfig): string {
    const securityUrl = `${config.appUrl}/my-security`;
    const supportUrl = `${config.appUrl}/support`;
    
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>แจ้งเตือนการเข้าสู่ระบบ</title>
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
                        <td style="background-color: #28a745; padding: 40px 30px; text-align: center;">
                            <h1 style="margin: 0; font-size: 28px; color: #ffffff;">🔐 แจ้งเตือนการเข้าสู่ระบบ</h1>
                            <p style="margin: 15px 0 0 0; color: #ffffff; font-size: 16px;">มีการเข้าสู่ระบบบัญชีของคุณ</p>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px 30px;">
                            <p style="margin: 0 0 20px 0; color: #333333; font-size: 15px; line-height: 1.8;">
                                สวัสดีครับ/ค่ะ คุณ <strong>${data.username}</strong>
                            </p>
                            <p style="margin: 0 0 25px 0; color: #333333; font-size: 15px; line-height: 1.8;">
                                เราตรวจพบการเข้าสู่ระบบบัญชีของคุณใน <strong>${config.appName}</strong> หากเป็นคุณที่เข้าสู่ระบบ ไม่จำเป็นต้องทำอะไร
                            </p>
                            
                            <!-- Success Badge -->
                            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #d4edda; border: 2px solid #28a745; margin: 25px 0;">
                                <tr>
                                    <td style="padding: 20px; text-align: center;">
                                        <p style="margin: 0; color: #155724; font-size: 16px;">
                                            <strong>✅ เข้าสู่ระบบสำเร็จ</strong>
                                        </p>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Login Info Box -->
                            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8f9fa; border: 2px solid #28a745; margin: 25px 0;">
                                <tr>
                                    <td style="padding: 25px;">
                                        <h3 style="margin: 0 0 20px 0; color: #28a745; font-size: 18px; text-align: center;">📋 รายละเอียดการเข้าสู่ระบบ</h3>
                                        
                                        <!-- Info Rows -->
                                        <table width="100%" cellpadding="10" cellspacing="0" border="0">
                                            <tr style="border-bottom: 1px solid #e9ecef;">
                                                <td style="color: #495057; font-size: 14px; padding: 12px 0;">
                                                    <strong>👤 ชื่อผู้ใช้:</strong>
                                                </td>
                                                <td style="color: #212529; font-size: 14px; text-align: right; padding: 12px 0;">
                                                    <strong style="background-color: #e9ecef; padding: 6px 12px; border-radius: 6px; font-family: 'Courier New', monospace;">${data.username}</strong>
                                                </td>
                                            </tr>
                                            <tr style="border-bottom: 1px solid #e9ecef;">
                                                <td style="color: #495057; font-size: 14px; padding: 12px 0;">
                                                    <strong>🕐 เวลา:</strong>
                                                </td>
                                                <td style="color: #212529; font-size: 14px; text-align: right; padding: 12px 0;">
                                                    ${data.login_time}
                                                </td>
                                            </tr>
                                            <tr style="border-bottom: 1px solid #e9ecef;">
                                                <td style="color: #495057; font-size: 14px; padding: 12px 0;">
                                                    <strong>🌐 IP Address:</strong>
                                                </td>
                                                <td style="color: #212529; font-size: 14px; text-align: right; padding: 12px 0;">
                                                    <code style="background-color: #e9ecef; padding: 4px 8px; border-radius: 4px; font-size: 13px;">${data.ip_address}</code>
                                                </td>
                                            </tr>
                                            ${data.location ? `
                                            <tr style="border-bottom: 1px solid #e9ecef;">
                                                <td style="color: #495057; font-size: 14px; padding: 12px 0;">
                                                    <strong>📍 สถานที่:</strong>
                                                </td>
                                                <td style="color: #212529; font-size: 14px; text-align: right; padding: 12px 0;">
                                                    ${data.location}
                                                </td>
                                            </tr>
                                            ` : ''}
                                            <tr style="border-bottom: 1px solid #e9ecef;">
                                                <td style="color: #495057; font-size: 14px; padding: 12px 0;">
                                                    <strong>💻 เบราว์เซอร์:</strong>
                                                </td>
                                                <td style="color: #212529; font-size: 14px; text-align: right; padding: 12px 0;">
                                                    ${data.browser}
                                                </td>
                                            </tr>
                                            <tr style="border-bottom: 1px solid #e9ecef;">
                                                <td style="color: #495057; font-size: 14px; padding: 12px 0;">
                                                    <strong>🖥️ ระบบปฏิบัติการ:</strong>
                                                </td>
                                                <td style="color: #212529; font-size: 14px; text-align: right; padding: 12px 0;">
                                                    ${data.os}
                                                </td>
                                            </tr>
                                            <tr style="border-bottom: 1px solid #e9ecef;">
                                                <td style="color: #495057; font-size: 14px; padding: 12px 0;">
                                                    <strong>📱 อุปกรณ์:</strong>
                                                </td>
                                                <td style="color: #212529; font-size: 14px; text-align: right; padding: 12px 0;">
                                                    ${data.device_type}
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="color: #495057; font-size: 14px; padding: 12px 0;">
                                                    <strong>🔧 Platform:</strong>
                                                </td>
                                                <td style="color: #212529; font-size: 14px; text-align: right; padding: 12px 0;">
                                                    ${data.platform}
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Warning Notice -->
                            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #fff3cd; border: 2px solid #ffc107; margin: 25px 0;">
                                <tr>
                                    <td style="padding: 20px;">
                                        <p style="margin: 0; color: #856404; font-size: 14px; line-height: 1.8;">
                                            <strong>⚠️ หากนี่ไม่ใช่คุณ:</strong><br><br>
                                            • อาจมีผู้อื่นเข้าถึงบัญชีของคุณ<br>
                                            • กรุณา<strong>เปลี่ยนรหัสผ่านทันที</strong><br>
                                            • ตรวจสอบกิจกรรมบัญชีของคุณ<br>
                                            • ติดต่อทีม IT Support ทันที
                                        </p>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Action Buttons -->
                            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 30px 0;">
                                <tr>
                                    <td align="center">
                                        <table cellpadding="0" cellspacing="0" border="0">
                                            <tr>
                                                <td style="padding: 0 5px;">
                                                    <a href="${securityUrl}" 
                                                       style="display: inline-block; background-color: #dc3545; color: #ffffff; padding: 14px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; font-size: 14px;">
                                                        🔒 เปลี่ยนรหัสผ่าน
                                                    </a>
                                                </td>
                                                <td style="padding: 0 5px;">
                                                    <a href="${supportUrl}" 
                                                       style="display: inline-block; background-color: #6c757d; color: #ffffff; padding: 14px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; font-size: 14px;">
                                                        📞 ติดต่อ Support
                                                    </a>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Info Notice -->
                            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #d1ecf1; border: 2px solid #0dcaf0; margin: 25px 0;">
                                <tr>
                                    <td style="padding: 20px;">
                                        <p style="margin: 0; color: #0c5460; font-size: 14px; line-height: 1.8;">
                                            <strong>ℹ️ เกี่ยวกับการแจ้งเตือนนี้:</strong><br><br>
                                            • การแจ้งเตือนนี้ส่งมาเพราะคุณเปิดการแจ้งเตือนการเข้าสู่ระบบ<br>
                                            • คุณสามารถปิดการแจ้งเตือนได้ที่หน้าตั้งค่า<br>
                                            • การแจ้งเตือนช่วยเพิ่มความปลอดภัยให้บัญชีของคุณ
                                        </p>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Security Tips -->
                            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 30px 0 0 0;">
                                <tr>
                                    <td style="border-top: 2px solid #e9ecef; padding-top: 25px;">
                                        <h4 style="margin: 0 0 15px 0; color: #667eea; font-size: 16px;">🛡️ เคล็ดลับความปลอดภัย</h4>
                                        <table width="100%" cellpadding="8" cellspacing="0" border="0">
                                            <tr>
                                                <td style="vertical-align: top; width: 30px; color: #667eea; font-weight: bold; font-size: 16px;">
                                                    1.
                                                </td>
                                                <td style="color: #495057; font-size: 13px; line-height: 1.6;">
                                                    <strong>ตรวจสอบอีเมลแจ้งเตือนเสมอ</strong> เพื่อทราบการเข้าถึงบัญชีที่ผิดปกติ
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="vertical-align: top; color: #667eea; font-weight: bold; font-size: 16px;">
                                                    2.
                                                </td>
                                                <td style="color: #495057; font-size: 13px; line-height: 1.6;">
                                                    <strong>ใช้รหัสผ่านที่แข็งแกร่ง</strong> และเปลี่ยนเป็นระยะ
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="vertical-align: top; color: #667eea; font-weight: bold; font-size: 16px;">
                                                    3.
                                                </td>
                                                <td style="color: #495057; font-size: 13px; line-height: 1.6;">
                                                    <strong>เปิดใช้งาน Two-Factor Authentication</strong> เพื่อความปลอดภัยเพิ่มเติม
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="vertical-align: top; color: #667eea; font-weight: bold; font-size: 16px;">
                                                    4.
                                                </td>
                                                <td style="color: #495057; font-size: 13px; line-height: 1.6;">
                                                    <strong>ออกจากระบบ</strong>เมื่อใช้งานเสร็จ โดยเฉพาะบนอุปกรณ์สาธารณะ
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f8f9fa; padding: 25px 30px; text-align: center;">
                            <p style="margin: 0 0 10px 0; color: #6c757d; font-size: 13px;">
                                หากมีคำถามเกี่ยวกับความปลอดภัยของบัญชี<br>
                                กรุณาติดต่อทีม IT Support
                            </p>
                            <hr style="border: none; border-top: 1px solid #dee2e6; margin: 20px 0;">
                            <p style="margin: 0; color: #999999; font-size: 11px;">
                                © ${new Date().getFullYear()} ${config.appName}<br>
                                อีเมลนี้ส่งอัตโนมัติจากระบบ กรุณาอย่าตอบกลับ<br>
                                ส่งเมื่อ ${formatSystemDateSync()}
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
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      console.log(`📧 [LOGIN_NOTIFICATION_EMAIL] Preparing to send email to: ${to}`);

      const mailOptions = {
        to: to,
        subject: subject,
        html: htmlContent,
        text: `แจ้งเตือนการเข้าสู่ระบบบัญชี ${recipientName} เมื่อ ${formatSystemDateSync()}`
      };

      console.log('📤 [LOGIN_NOTIFICATION_EMAIL] Sending via EmailManager...');
      const success = await EmailManager.sendMail(mailOptions);
      
      if (success) {
        console.log(`✅ [LOGIN_NOTIFICATION_EMAIL] Email sent successfully to ${to}`);
        return {
          success: true,
          messageId: 'sent-via-email-manager'
        };
      } else {
        console.error(`❌ [LOGIN_NOTIFICATION_EMAIL] Failed to send email to ${to}`);
        return {
          success: false,
          error: 'EmailManager.sendMail returned false'
        };
      }
      
    } catch (error: any) {
      console.error(`❌ [LOGIN_NOTIFICATION_EMAIL] Failed to send email to ${to}`);
      console.error(`❌ [LOGIN_NOTIFICATION_EMAIL] Error:`, error);
      
      return {
        success: false,
        error: error.message
      };
    }
  }
}
