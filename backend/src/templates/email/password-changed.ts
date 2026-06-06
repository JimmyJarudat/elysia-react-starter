import { EmailManager } from '@/config/smtp.config';
import { formatSystemDateSync } from '@/utils/date-formatter';
import { getEmailTemplateConfig } from '@/utils/email-template-config';
import type { EmailTemplateConfig } from '@/utils/email-template-config';

export interface PasswordChangedEmailData {
  username: string;
  email: string;
  changed_at: string;
}

export class PasswordChangedEmailService {
  static async sendPasswordChangedEmail(data: PasswordChangedEmailData): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
  }> {
    try {
      console.log('🔑 [PASSWORD_CHANGED] Sending email to:', data.email);
      const templateConfig = await getEmailTemplateConfig();
      const emailSubject = `🔑 รหัสผ่านของคุณถูกเปลี่ยนแล้ว - ${data.username}`;
      const emailBody = this.generateTemplate(data, templateConfig);
      const result = await this.sendEmail(data.email, data.username, emailSubject, emailBody);
      if (result.success) {
        console.log('✅ [PASSWORD_CHANGED] Email sent successfully');
      } else {
        console.error('❌ [PASSWORD_CHANGED] Failed to send:', result.error);
      }
      return result;
    } catch (error) {
      console.error('❌ [PASSWORD_CHANGED] Failed to send email:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  private static generateTemplate(data: PasswordChangedEmailData, config: EmailTemplateConfig): string {
    const securityUrl = `${config.appUrl}/my-security`;
    const supportUrl = `${config.appUrl}/support`;
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>รหัสผ่านถูกเปลี่ยน</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f4f4; padding: 20px 0;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; max-width: 600px;">
                    <tr>
                        <td style="background-color: #dc3545; padding: 40px 30px; text-align: center;">
                            <h1 style="margin: 0; font-size: 28px; color: #ffffff;">🔑 รหัสผ่านถูกเปลี่ยนแล้ว</h1>
                            <p style="margin: 15px 0 0 0; color: #ffffff; font-size: 16px;">มีการเปลี่ยนรหัสผ่านบัญชีของคุณ</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 40px 30px;">
                            <p style="margin: 0 0 20px 0; color: #333333; font-size: 15px; line-height: 1.8;">
                                สวัสดีครับ/ค่ะ คุณ <strong>${data.username}</strong>
                            </p>
                            <p style="margin: 0 0 25px 0; color: #333333; font-size: 15px; line-height: 1.8;">
                                รหัสผ่านของบัญชีคุณใน <strong>${config.appName}</strong> ถูกเปลี่ยนเรียบร้อยแล้ว
                            </p>

                            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8f9fa; border: 2px solid #dc3545; margin: 25px 0;">
                                <tr>
                                    <td style="padding: 25px;">
                                        <h3 style="margin: 0 0 20px 0; color: #dc3545; font-size: 18px; text-align: center;">📋 รายละเอียด</h3>
                                        <table width="100%" cellpadding="10" cellspacing="0" border="0">
                                            <tr style="border-bottom: 1px solid #e9ecef;">
                                                <td style="color: #495057; font-size: 14px; padding: 12px 0;"><strong>👤 ชื่อผู้ใช้:</strong></td>
                                                <td style="color: #212529; font-size: 14px; text-align: right; padding: 12px 0;">
                                                    <strong style="background-color: #e9ecef; padding: 6px 12px; border-radius: 6px; font-family: 'Courier New', monospace;">${data.username}</strong>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="color: #495057; font-size: 14px; padding: 12px 0;"><strong>🕐 เวลาที่เปลี่ยน:</strong></td>
                                                <td style="color: #212529; font-size: 14px; text-align: right; padding: 12px 0;">${data.changed_at}</td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>

                            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8d7da; border: 2px solid #dc3545; margin: 25px 0;">
                                <tr>
                                    <td style="padding: 20px;">
                                        <p style="margin: 0; color: #842029; font-size: 14px; line-height: 1.8;">
                                            <strong>⚠️ หากไม่ใช่คุณดำเนินการ:</strong><br><br>
                                            • อาจมีผู้อื่นเข้าถึงบัญชีของคุณ<br>
                                            • กรุณาติดต่อทีม IT Support ทันที<br>
                                            • ตรวจสอบกิจกรรมบัญชีของคุณ
                                        </p>
                                    </td>
                                </tr>
                            </table>

                            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 30px 0;">
                                <tr>
                                    <td align="center">
                                        <table cellpadding="0" cellspacing="0" border="0">
                                            <tr>
                                                <td style="padding: 0 5px;">
                                                    <a href="${securityUrl}" style="display: inline-block; background-color: #dc3545; color: #ffffff; padding: 14px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; font-size: 14px;">
                                                        🔒 ตั้งค่าความปลอดภัย
                                                    </a>
                                                </td>
                                                <td style="padding: 0 5px;">
                                                    <a href="${supportUrl}" style="display: inline-block; background-color: #6c757d; color: #ffffff; padding: 14px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; font-size: 14px;">
                                                        📞 ติดต่อ Support
                                                    </a>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="background-color: #f8f9fa; padding: 25px 30px; text-align: center;">
                            <p style="margin: 0 0 10px 0; color: #6c757d; font-size: 13px;">
                                หากมีคำถามเกี่ยวกับความปลอดภัยของบัญชี กรุณาติดต่อทีม IT Support
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

  private static async sendEmail(
    to: string,
    recipientName: string,
    subject: string,
    htmlContent: string,
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      console.log(`📧 [PASSWORD_CHANGED_EMAIL] Preparing to send email to: ${to}`);
      const mailOptions = {
        to,
        subject,
        html: htmlContent,
        text: `รหัสผ่านของบัญชี ${recipientName} ถูกเปลี่ยนเมื่อ ${formatSystemDateSync()}`,
      };
      const success = await EmailManager.sendMail(mailOptions);
      if (success) {
        console.log(`✅ [PASSWORD_CHANGED_EMAIL] Email sent successfully to ${to}`);
        return { success: true, messageId: 'sent-via-email-manager' };
      } else {
        console.error(`❌ [PASSWORD_CHANGED_EMAIL] Failed to send email to ${to}`);
        return { success: false, error: 'EmailManager.sendMail returned false' };
      }
    } catch (error: any) {
      console.error(`❌ [PASSWORD_CHANGED_EMAIL] Error:`, error);
      return { success: false, error: error.message };
    }
  }
}
