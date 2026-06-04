// src/services/account-locked-email.service.ts
import { EmailManager } from '@/config/smtp.config';
import { formatSystemDateSync } from '@/utils/date-formatter';
import { getEmailTemplateConfig } from '@/utils/email-template-config';
import type { EmailTemplateConfig } from '@/utils/email-template-config';

export interface AccountLockedEmailData {
  username: string;
  email: string;
  locked_until: Date;
  failed_attempts: number;
  locked_duration_minutes: number;
  last_attempt_ip?: string;
  last_attempt_device?: string;
  last_attempt_time: string;
}

export class AccountLockedEmailService {
  
  // ส่งอีเมลแจ้งเตือนบัญชีถูกล็อค
  static async sendAccountLockedEmail(data: AccountLockedEmailData): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
  }> {
    try {
      console.log('🔒 [ACCOUNT_LOCKED] Sending account locked email to:', data.email);
      const templateConfig = await getEmailTemplateConfig();
      
      const emailSubject = `⚠️ แจ้งเตือนความปลอดภัย: บัญชีของคุณถูกล็อคชั่วคราว - ${data.username}`;
      const emailBody = this.generateAccountLockedEmailTemplate(data, templateConfig);
      
      const result = await this.sendEmail(
        data.email,
        data.username,
        emailSubject,
        emailBody
      );
      
      if (result.success) {
        console.log('✅ [ACCOUNT_LOCKED] Account locked email sent successfully');
      } else {
        console.error('❌ [ACCOUNT_LOCKED] Failed to send email:', result.error);
      }
      
      return result;
      
    } catch (error) {
      console.error('❌ [ACCOUNT_LOCKED] Failed to send account locked email:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // สร้าง HTML template สำหรับอีเมลแจ้งเตือน
  private static generateAccountLockedEmailTemplate(data: AccountLockedEmailData, config: EmailTemplateConfig): string {
    const supportUrl = `${config.appUrl}/support`;
    const unlockTime = formatSystemDateSync(data.locked_until);
    
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>แจ้งเตือนความปลอดภัย</title>
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
                        <td style="background-color: #dc3545; padding: 40px 30px; text-align: center;">
                            <h1 style="margin: 0; font-size: 28px; color: #ffffff;">⚠️ แจ้งเตือนความปลอดภัย</h1>
                            <p style="margin: 15px 0 0 0; color: #ffffff; font-size: 16px;">บัญชีของคุณถูกล็อคชั่วคราว</p>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px 30px;">
                            <p style="margin: 0 0 20px 0; color: #333333; font-size: 15px; line-height: 1.8;">
                                สวัสดีครับ/ค่ะ คุณ <strong>${data.username}</strong>
                            </p>
                            <p style="margin: 0 0 25px 0; color: #333333; font-size: 15px; line-height: 1.8;">
                                บัญชีของคุณใน <strong>${config.appName}</strong> ถูกล็อคชั่วคราวเนื่องจากมีการพยายามเข้าสู่ระบบด้วยรหัสผ่านที่ผิดหลายครั้ง
                            </p>
                            
                            <!-- Alert Box -->
                            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #fff3cd; border: 2px solid #ffc107; margin: 25px 0;">
                                <tr>
                                    <td style="padding: 20px;">
                                        <p style="margin: 0; color: #856404; font-size: 14px; line-height: 1.8; text-align: center;">
                                            <strong style="font-size: 16px;">🔒 บัญชีถูกล็อคชั่วคราว</strong><br><br>
                                            <span style="font-size: 18px; font-weight: bold; color: #dc3545;">${data.locked_duration_minutes} นาที</span>
                                        </p>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Account Info Box -->
                            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8f9fa; border: 2px solid #dc3545; margin: 25px 0;">
                                <tr>
                                    <td style="padding: 25px;">
                                        <h3 style="margin: 0 0 20px 0; color: #dc3545; font-size: 18px; text-align: center;">📋 รายละเอียดการล็อคบัญชี</h3>
                                        
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
                                                    <strong>❌ จำนวนครั้งที่ผิดพลาด:</strong>
                                                </td>
                                                <td style="color: #212529; font-size: 14px; text-align: right; padding: 12px 0;">
                                                    <strong style="background-color: #f8d7da; padding: 6px 12px; border-radius: 6px; color: #dc3545;">${data.failed_attempts} ครั้ง</strong>
                                                </td>
                                            </tr>
                                            <tr style="border-bottom: 1px solid #e9ecef;">
                                                <td style="color: #495057; font-size: 14px; padding: 12px 0;">
                                                    <strong>🕐 ล็อคจนถึง:</strong>
                                                </td>
                                                <td style="color: #212529; font-size: 14px; text-align: right; padding: 12px 0;">
                                                    <span style="background-color: #fff3cd; padding: 6px 12px; border-radius: 6px; color: #856404;">${unlockTime}</span>
                                                </td>
                                            </tr>
                                            <tr style="border-bottom: 1px solid #e9ecef;">
                                                <td style="color: #495057; font-size: 14px; padding: 12px 0;">
                                                    <strong>⏰ เวลาความพยายามล่าสุด:</strong>
                                                </td>
                                                <td style="color: #212529; font-size: 14px; text-align: right; padding: 12px 0;">
                                                    ${data.last_attempt_time}
                                                </td>
                                            </tr>
                                            ${data.last_attempt_ip ? `
                                            <tr style="border-bottom: 1px solid #e9ecef;">
                                                <td style="color: #495057; font-size: 14px; padding: 12px 0;">
                                                    <strong>🌐 IP Address:</strong>
                                                </td>
                                                <td style="color: #212529; font-size: 14px; text-align: right; padding: 12px 0;">
                                                    <code style="background-color: #e9ecef; padding: 4px 8px; border-radius: 4px;">${data.last_attempt_ip}</code>
                                                </td>
                                            </tr>
                                            ` : ''}
                                            ${data.last_attempt_device ? `
                                            <tr>
                                                <td style="color: #495057; font-size: 14px; padding: 12px 0;">
                                                    <strong>📱 อุปกรณ์:</strong>
                                                </td>
                                                <td style="color: #212529; font-size: 14px; text-align: right; padding: 12px 0;">
                                                    ${data.last_attempt_device}
                                                </td>
                                            </tr>
                                            ` : ''}
                                        </table>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Important Notice -->
                            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #d1ecf1; border: 2px solid #0dcaf0; margin: 25px 0;">
                                <tr>
                                    <td style="padding: 20px;">
                                        <p style="margin: 0; color: #0c5460; font-size: 14px; line-height: 1.8;">
                                            <strong>ℹ️ ข้อมูลสำคัญ:</strong><br><br>
                                            • บัญชีจะถูกปลดล็อคอัตโนมัติหลังจาก <strong>${data.locked_duration_minutes} นาที</strong><br>
                                            • หากนี่ไม่ใช่คุณ กรุณาเปลี่ยนรหัสผ่านทันที<br>
                                            • อย่าแชร์รหัสผ่านกับผู้อื่นเด็ดขาด<br>
                                            • ใช้รหัสผ่านที่แข็งแกร่งและไม่ซ้ำกับเว็บไซต์อื่น
                                        </p>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Action Required -->
                            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8d7da; border: 2px solid #dc3545; margin: 25px 0;">
                                <tr>
                                    <td style="padding: 20px;">
                                        <p style="margin: 0; color: #842029; font-size: 14px; line-height: 1.8;">
                                            <strong>⚠️ หากคุณไม่ได้พยายามเข้าสู่ระบบ:</strong><br><br>
                                            • อาจมีผู้อื่นพยายามเข้าถึงบัญชีของคุณ<br>
                                            • กรุณาเปลี่ยนรหัสผ่านทันทีหลังบัญชีปลดล็อค<br>
                                            • ตรวจสอบกิจกรรมบัญชีของคุณ<br>
                                            • ติดต่อทีม IT Support หากพบความผิดปกติ
                                        </p>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Support Button -->
                            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 30px 0;">
                                <tr>
                                    <td align="center">
                                        <a href="${supportUrl}" 
                                           style="display: inline-block; background-color: #0dcaf0; color: #ffffff; padding: 16px 40px; text-decoration: none; border-radius: 30px; font-weight: bold; font-size: 16px;">
                                            📞 ติดต่อฝ่ายสนับสนุน
                                        </a>
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
                                                    <strong>ใช้รหัสผ่านที่แข็งแกร่ง</strong> อย่างน้อย 8 ตัวอักษร ผสมตัวพิมพ์ใหญ่ เล็ก ตัวเลข และอักขระพิเศษ
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="vertical-align: top; color: #667eea; font-weight: bold; font-size: 16px;">
                                                    2.
                                                </td>
                                                <td style="color: #495057; font-size: 13px; line-height: 1.6;">
                                                    <strong>อย่าใช้รหัสผ่านซ้ำ</strong> กับเว็บไซต์หรือบริการอื่น
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="vertical-align: top; color: #667eea; font-weight: bold; font-size: 16px;">
                                                    3.
                                                </td>
                                                <td style="color: #495057; font-size: 13px; line-height: 1.6;">
                                                    <strong>เปลี่ยนรหัสผ่านเป็นระยะ</strong> เพื่อความปลอดภัยสูงสุด
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="vertical-align: top; color: #667eea; font-weight: bold; font-size: 16px;">
                                                    4.
                                                </td>
                                                <td style="color: #495057; font-size: 13px; line-height: 1.6;">
                                                    <strong>อย่าแชร์รหัสผ่าน</strong> ให้ผู้อื่นหรือบันทึกไว้ในที่ที่ไม่ปลอดภัย
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
                                หากมีคำถามหรือต้องการความช่วยเหลือ<br>
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
      console.log(`📧 [ACCOUNT_LOCKED_EMAIL] Preparing to send email to: ${to}`);

      const mailOptions = {
        to: to,
        subject: subject,
        html: htmlContent,
        text: `แจ้งเตือนความปลอดภัย: บัญชี ${recipientName} ถูกล็อคชั่วคราว`
      };

      console.log('📤 [ACCOUNT_LOCKED_EMAIL] Sending via EmailManager...');
      const success = await EmailManager.sendMail(mailOptions);
      
      if (success) {
        console.log(`✅ [ACCOUNT_LOCKED_EMAIL] Email sent successfully to ${to}`);
        return {
          success: true,
          messageId: 'sent-via-email-manager'
        };
      } else {
        console.error(`❌ [ACCOUNT_LOCKED_EMAIL] Failed to send email to ${to}`);
        return {
          success: false,
          error: 'EmailManager.sendMail returned false'
        };
      }
      
    } catch (error: any) {
      console.error(`❌ [ACCOUNT_LOCKED_EMAIL] Failed to send email to ${to}`);
      console.error(`❌ [ACCOUNT_LOCKED_EMAIL] Error:`, error);
      
      return {
        success: false,
        error: error.message
      };
    }
  }
}
