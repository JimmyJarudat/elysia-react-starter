import { EmailManager } from '@/config/smtp.config';
import { formatSystemDateSync } from '@/utils/date-formatter';
import { getEmailTemplateConfig } from '@/utils/email-template-config';
import type { EmailTemplateConfig } from '@/utils/email-template-config';

export interface PasswordResetByAdminEmailData {
  username: string;
  email: string;
  must_change_password: boolean;
  reset_at: string;
}

export class PasswordResetByAdminEmailService {
  static async sendPasswordResetByAdminEmail(data: PasswordResetByAdminEmailData): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
  }> {
    try {
      console.log('🔐 [PASSWORD_RESET_ADMIN] Sending email to:', data.email);
      const templateConfig = await getEmailTemplateConfig();
      const emailSubject = `🔐 รหัสผ่านของคุณถูกรีเซ็ตโดยผู้ดูแลระบบ - ${data.username}`;
      const emailBody = this.generateTemplate(data, templateConfig);
      const result = await this.sendEmail(data.email, data.username, emailSubject, emailBody);
      if (result.success) {
        console.log('✅ [PASSWORD_RESET_ADMIN] Email sent successfully');
      } else {
        console.error('❌ [PASSWORD_RESET_ADMIN] Failed to send:', result.error);
      }
      return result;
    } catch (error) {
      console.error('❌ [PASSWORD_RESET_ADMIN] Failed to send email:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  private static generateTemplate(data: PasswordResetByAdminEmailData, config: EmailTemplateConfig): string {
    const securityUrl = `${config.appUrl}/my-security`;
    const supportUrl = `${config.appUrl}/support`;
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>รหัสผ่านถูกรีเซ็ต</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f4f4; padding: 20px 0;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; max-width: 600px;">
                    <tr>
                        <td style="background-color: #fd7e14; padding: 40px 30px; text-align: center;">
                            <h1 style="margin: 0; font-size: 28px; color: #ffffff;">🔐 รหัสผ่านถูกรีเซ็ต</h1>
                            <p style="margin: 15px 0 0 0; color: #ffffff; font-size: 16px;">ผู้ดูแลระบบได้รีเซ็ตรหัสผ่านของคุณ</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 40px 30px;">
                            <p style="margin: 0 0 20px 0; color: #333333; font-size: 15px; line-height: 1.8;">
                                สวัสดีครับ/ค่ะ คุณ <strong>${data.username}</strong>
                            </p>
                            <p style="margin: 0 0 25px 0; color: #333333; font-size: 15px; line-height: 1.8;">
                                ผู้ดูแลระบบได้รีเซ็ตรหัสผ่านของบัญชีคุณใน <strong>${config.appName}</strong>
                            </p>

                            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8f9fa; border: 2px solid #fd7e14; margin: 25px 0;">
                                <tr>
                                    <td style="padding: 25px;">
                                        <h3 style="margin: 0 0 20px 0; color: #fd7e14; font-size: 18px; text-align: center;">📋 รายละเอียด</h3>
                                        <table width="100%" cellpadding="10" cellspacing="0" border="0">
                                            <tr style="border-bottom: 1px solid #e9ecef;">
                                                <td style="color: #495057; font-size: 14px; padding: 12px 0;"><strong>👤 ชื่อผู้ใช้:</strong></td>
                                                <td style="color: #212529; font-size: 14px; text-align: right; padding: 12px 0;">
                                                    <strong style="background-color: #e9ecef; padding: 6px 12px; border-radius: 6px; font-family: 'Courier New', monospace;">${data.username}</strong>
                                                </td>
                                            </tr>
                                            <tr style="border-bottom: 1px solid #e9ecef;">
                                                <td style="color: #495057; font-size: 14px; padding: 12px 0;"><strong>🕐 เวลาที่รีเซ็ต:</strong></td>
                                                <td style="color: #212529; font-size: 14px; text-align: right; padding: 12px 0;">${data.reset_at}</td>
                                            </tr>
                                            <tr>
                                                <td style="color: #495057; font-size: 14px; padding: 12px 0;"><strong>🔑 ต้องเปลี่ยนรหัสผ่าน:</strong></td>
                                                <td style="color: #212529; font-size: 14px; text-align: right; padding: 12px 0;">
                                                    ${data.must_change_password
                                                      ? '<span style="background-color: #fff3cd; color: #856404; padding: 4px 10px; border-radius: 4px; font-weight: bold;">ใช่ — ต้องเปลี่ยนหลังเข้าสู่ระบบ</span>'
                                                      : '<span style="background-color: #d4edda; color: #155724; padding: 4px 10px; border-radius: 4px;">ไม่บังคับ</span>'}
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>

                            ${data.must_change_password ? `
                            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #fff3cd; border: 2px solid #ffc107; margin: 25px 0;">
                                <tr>
                                    <td style="padding: 20px;">
                                        <p style="margin: 0; color: #856404; font-size: 14px; line-height: 1.8;">
                                            <strong>⚠️ กรุณาเปลี่ยนรหัสผ่านใหม่ทันที:</strong><br><br>
                                            • เข้าสู่ระบบด้วยรหัสผ่านที่ได้รับจากผู้ดูแลระบบ<br>
                                            • ระบบจะบังคับให้เปลี่ยนรหัสผ่านก่อนใช้งาน<br>
                                            • เลือกรหัสผ่านที่แข็งแกร่งและจำไม่ยาก
                                        </p>
                                    </td>
                                </tr>
                            </table>
                            ` : ''}

                            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #d1ecf1; border: 2px solid #0dcaf0; margin: 25px 0;">
                                <tr>
                                    <td style="padding: 20px;">
                                        <p style="margin: 0; color: #0c5460; font-size: 14px; line-height: 1.8;">
                                            <strong>ℹ️ หากไม่ทราบรหัสผ่านใหม่:</strong><br><br>
                                            • กรุณาติดต่อผู้ดูแลระบบที่ดำเนินการรีเซ็ต<br>
                                            • หรือติดต่อทีม IT Support เพื่อขอความช่วยเหลือ
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
                                                    <a href="${securityUrl}" style="display: inline-block; background-color: #fd7e14; color: #ffffff; padding: 14px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; font-size: 14px;">
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
                                หากมีคำถามหรือต้องการความช่วยเหลือ กรุณาติดต่อทีม IT Support
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
      console.log(`📧 [PASSWORD_RESET_ADMIN_EMAIL] Preparing to send email to: ${to}`);
      const mailOptions = {
        to,
        subject,
        html: htmlContent,
        text: `รหัสผ่านบัญชี ${recipientName} ถูกรีเซ็ตโดยผู้ดูแลระบบ`,
      };
      const success = await EmailManager.sendMail(mailOptions);
      if (success) {
        console.log(`✅ [PASSWORD_RESET_ADMIN_EMAIL] Email sent successfully to ${to}`);
        return { success: true, messageId: 'sent-via-email-manager' };
      } else {
        console.error(`❌ [PASSWORD_RESET_ADMIN_EMAIL] Failed to send email to ${to}`);
        return { success: false, error: 'EmailManager.sendMail returned false' };
      }
    } catch (error: any) {
      console.error(`❌ [PASSWORD_RESET_ADMIN_EMAIL] Error:`, error);
      return { success: false, error: error.message };
    }
  }
}
