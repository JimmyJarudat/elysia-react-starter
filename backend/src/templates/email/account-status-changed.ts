import { EmailManager } from '@/config/smtp.config';
import { formatSystemDateSync } from '@/utils/date-formatter';
import { getEmailTemplateConfig } from '@/utils/email-template-config';
import type { EmailTemplateConfig } from '@/utils/email-template-config';

export interface AccountStatusChangedEmailData {
  username: string;
  email: string;
  is_active: boolean;
  changed_at: string;
}

export class AccountStatusChangedEmailService {
  static async sendAccountStatusChangedEmail(data: AccountStatusChangedEmailData): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
  }> {
    try {
      console.log('👤 [ACCOUNT_STATUS] Sending email to:', data.email);
      const templateConfig = await getEmailTemplateConfig();
      const statusLabel = data.is_active ? 'เปิดใช้งาน' : 'ปิดใช้งาน';
      const emailSubject = `👤 บัญชีของคุณถูก${statusLabel} - ${data.username}`;
      const emailBody = this.generateTemplate(data, templateConfig);
      const result = await this.sendEmail(data.email, data.username, emailSubject, emailBody);
      if (result.success) {
        console.log('✅ [ACCOUNT_STATUS] Email sent successfully');
      } else {
        console.error('❌ [ACCOUNT_STATUS] Failed to send:', result.error);
      }
      return result;
    } catch (error) {
      console.error('❌ [ACCOUNT_STATUS] Failed to send email:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  private static generateTemplate(data: AccountStatusChangedEmailData, config: EmailTemplateConfig): string {
    const supportUrl = `${config.appUrl}/support`;
    const loginUrl = `${config.appUrl}/login`;
    const headerColor = data.is_active ? '#28a745' : '#6c757d';
    const statusLabel = data.is_active ? 'เปิดใช้งาน' : 'ปิดใช้งาน';
    const statusBadgeStyle = data.is_active
      ? 'background-color: #d4edda; color: #155724; border: 2px solid #28a745;'
      : 'background-color: #e2e3e5; color: #383d41; border: 2px solid #6c757d;';
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>สถานะบัญชีถูกเปลี่ยน</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f4f4; padding: 20px 0;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; max-width: 600px;">
                    <tr>
                        <td style="background-color: ${headerColor}; padding: 40px 30px; text-align: center;">
                            <h1 style="margin: 0; font-size: 28px; color: #ffffff;">👤 สถานะบัญชีถูกเปลี่ยน</h1>
                            <p style="margin: 15px 0 0 0; color: #ffffff; font-size: 16px;">บัญชีของคุณถูก${statusLabel}โดยผู้ดูแลระบบ</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 40px 30px;">
                            <p style="margin: 0 0 20px 0; color: #333333; font-size: 15px; line-height: 1.8;">
                                สวัสดีครับ/ค่ะ คุณ <strong>${data.username}</strong>
                            </p>
                            <p style="margin: 0 0 25px 0; color: #333333; font-size: 15px; line-height: 1.8;">
                                สถานะบัญชีของคุณใน <strong>${config.appName}</strong> ได้รับการอัปเดตโดยผู้ดูแลระบบ
                            </p>

                            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="${statusBadgeStyle} margin: 25px 0;">
                                <tr>
                                    <td style="padding: 20px; text-align: center;">
                                        <p style="margin: 0; font-size: 18px; font-weight: bold;">
                                            ${data.is_active ? '✅ บัญชีถูกเปิดใช้งาน' : '🚫 บัญชีถูกปิดใช้งาน'}
                                        </p>
                                    </td>
                                </tr>
                            </table>

                            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8f9fa; border: 2px solid ${headerColor}; margin: 25px 0;">
                                <tr>
                                    <td style="padding: 25px;">
                                        <h3 style="margin: 0 0 20px 0; color: ${headerColor}; font-size: 18px; text-align: center;">📋 รายละเอียด</h3>
                                        <table width="100%" cellpadding="10" cellspacing="0" border="0">
                                            <tr style="border-bottom: 1px solid #e9ecef;">
                                                <td style="color: #495057; font-size: 14px; padding: 12px 0;"><strong>👤 ชื่อผู้ใช้:</strong></td>
                                                <td style="color: #212529; font-size: 14px; text-align: right; padding: 12px 0;">
                                                    <strong style="background-color: #e9ecef; padding: 6px 12px; border-radius: 6px; font-family: 'Courier New', monospace;">${data.username}</strong>
                                                </td>
                                            </tr>
                                            <tr style="border-bottom: 1px solid #e9ecef;">
                                                <td style="color: #495057; font-size: 14px; padding: 12px 0;"><strong>📊 สถานะใหม่:</strong></td>
                                                <td style="color: #212529; font-size: 14px; text-align: right; padding: 12px 0;">
                                                    <strong>${statusLabel}</strong>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="color: #495057; font-size: 14px; padding: 12px 0;"><strong>🕐 เวลา:</strong></td>
                                                <td style="color: #212529; font-size: 14px; text-align: right; padding: 12px 0;">${data.changed_at}</td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>

                            ${data.is_active ? `
                            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #d4edda; border: 2px solid #28a745; margin: 25px 0;">
                                <tr>
                                    <td style="padding: 20px;">
                                        <p style="margin: 0; color: #155724; font-size: 14px; line-height: 1.8;">
                                            <strong>✅ บัญชีพร้อมใช้งาน:</strong><br><br>
                                            • คุณสามารถเข้าสู่ระบบได้แล้วตามปกติ
                                        </p>
                                    </td>
                                </tr>
                            </table>
                            ` : `
                            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #e2e3e5; border: 2px solid #6c757d; margin: 25px 0;">
                                <tr>
                                    <td style="padding: 20px;">
                                        <p style="margin: 0; color: #383d41; font-size: 14px; line-height: 1.8;">
                                            <strong>🚫 บัญชีถูกระงับ:</strong><br><br>
                                            • คุณไม่สามารถเข้าสู่ระบบได้ในขณะนี้<br>
                                            • กรุณาติดต่อผู้ดูแลระบบหากต้องการข้อมูลเพิ่มเติม
                                        </p>
                                    </td>
                                </tr>
                            </table>
                            `}

                            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 30px 0;">
                                <tr>
                                    <td align="center">
                                        <table cellpadding="0" cellspacing="0" border="0">
                                            <tr>
                                                ${data.is_active ? `
                                                <td style="padding: 0 5px;">
                                                    <a href="${loginUrl}" style="display: inline-block; background-color: #28a745; color: #ffffff; padding: 14px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; font-size: 14px;">
                                                        🔑 เข้าสู่ระบบ
                                                    </a>
                                                </td>
                                                ` : ''}
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
      console.log(`📧 [ACCOUNT_STATUS_EMAIL] Preparing to send email to: ${to}`);
      const mailOptions = {
        to,
        subject,
        html: htmlContent,
        text: `สถานะบัญชี ${recipientName} ถูกเปลี่ยนโดยผู้ดูแลระบบ`,
      };
      const success = await EmailManager.sendMail(mailOptions);
      if (success) {
        console.log(`✅ [ACCOUNT_STATUS_EMAIL] Email sent successfully to ${to}`);
        return { success: true, messageId: 'sent-via-email-manager' };
      } else {
        console.error(`❌ [ACCOUNT_STATUS_EMAIL] Failed to send email to ${to}`);
        return { success: false, error: 'EmailManager.sendMail returned false' };
      }
    } catch (error: any) {
      console.error(`❌ [ACCOUNT_STATUS_EMAIL] Error:`, error);
      return { success: false, error: error.message };
    }
  }
}
