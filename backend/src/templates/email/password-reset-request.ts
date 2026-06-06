import { EmailManager } from '@/config/smtp.config';
import { formatSystemDateSync } from '@/utils/date-formatter';
import { getEmailTemplateConfig } from '@/utils/email-template-config';

export interface PasswordResetRequestEmailData {
  username: string;
  email: string;
  resetUrl: string;
  expiryMinutes: number;
}

export class PasswordResetRequestEmailService {
  static async send(data: PasswordResetRequestEmailData): Promise<{ success: boolean; error?: string }> {
    try {
      const templateConfig = await getEmailTemplateConfig();
      const subject = `🔑 รีเซ็ตรหัสผ่าน - ${data.username}`;
      const html = this.buildHtml(data, templateConfig.appName);
      const success = await EmailManager.sendMail({
        to: data.email,
        subject,
        html,
        text: `รีเซ็ตรหัสผ่านของคุณได้ที่: ${data.resetUrl} (หมดอายุใน ${data.expiryMinutes} นาที)`,
      });
      return { success };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  private static buildHtml(data: PasswordResetRequestEmailData, appName: string): string {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>รีเซ็ตรหัสผ่าน</title>
</head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background-color:#f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f4;padding:20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff;max-width:600px;">
          <tr>
            <td style="background-color:#0ea5e9;padding:40px 30px;text-align:center;">
              <h1 style="margin:0;font-size:28px;color:#ffffff;">🔑 รีเซ็ตรหัสผ่าน</h1>
              <p style="margin:15px 0 0 0;color:#ffffff;font-size:16px;">คุณได้ร้องขอการรีเซ็ตรหัสผ่าน</p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px 30px;">
              <p style="margin:0 0 20px 0;color:#333333;font-size:15px;line-height:1.8;">
                สวัสดีครับ/ค่ะ คุณ <strong>${data.username}</strong>
              </p>
              <p style="margin:0 0 25px 0;color:#333333;font-size:15px;line-height:1.8;">
                เราได้รับคำขอรีเซ็ตรหัสผ่านสำหรับบัญชีของคุณใน <strong>${appName}</strong>
                กรุณาคลิกปุ่มด้านล่างเพื่อตั้งรหัสผ่านใหม่
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:30px 0;">
                <tr>
                  <td align="center">
                    <a href="${data.resetUrl}"
                       style="display:inline-block;background-color:#0ea5e9;color:#ffffff;padding:16px 40px;text-decoration:none;border-radius:8px;font-weight:bold;font-size:15px;">
                      🔑 ตั้งรหัสผ่านใหม่
                    </a>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fff3cd;border:2px solid #ffc107;margin:25px 0;">
                <tr>
                  <td style="padding:20px;">
                    <p style="margin:0;color:#856404;font-size:14px;line-height:1.8;">
                      <strong>⚠️ หมายเหตุสำคัญ:</strong><br><br>
                      • ลิงก์นี้จะหมดอายุใน <strong>${data.expiryMinutes} นาที</strong><br>
                      • หากคุณไม่ได้ร้องขอการรีเซ็ตรหัสผ่าน กรุณาละเว้นอีเมลนี้<br>
                      • บัญชีของคุณจะยังคงปลอดภัย
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin:25px 0 0 0;color:#6c757d;font-size:13px;line-height:1.6;">
                หากปุ่มด้านบนไม่ทำงาน คุณสามารถคัดลอกลิงก์ด้านล่างนี้ไปวางในเบราว์เซอร์:
              </p>
              <p style="margin:8px 0 0 0;color:#0ea5e9;font-size:12px;word-break:break-all;">
                ${data.resetUrl}
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#f8f9fa;padding:25px 30px;text-align:center;">
              <p style="margin:0 0 10px 0;color:#6c757d;font-size:13px;">
                หากมีคำถามหรือต้องการความช่วยเหลือ กรุณาติดต่อทีม IT Support
              </p>
              <hr style="border:none;border-top:1px solid #dee2e6;margin:20px 0;">
              <p style="margin:0;color:#999999;font-size:11px;">
                © ${new Date().getFullYear()} ${appName}<br>
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
</html>`;
  }
}
