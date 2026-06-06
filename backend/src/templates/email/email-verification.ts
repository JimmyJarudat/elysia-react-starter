import { EmailManager } from "@/config/smtp.config";
import { getEmailTemplateConfig } from "@/utils/email-template-config";

export type EmailVerificationPurpose =
  | "PRIMARY_VERIFY"
  | "PRIMARY_CHANGE"
  | "RECOVERY_VERIFY"
  | "RECOVERY_CHANGE";

export type EmailVerificationData = {
  email: string;
  code: string;
  purpose: EmailVerificationPurpose;
  expiresInMinutes: number;
};

const purposeLabels: Record<EmailVerificationPurpose, string> = {
  PRIMARY_VERIFY: "ยืนยันอีเมลหลัก",
  PRIMARY_CHANGE: "ยืนยันการเปลี่ยนอีเมลหลัก",
  RECOVERY_VERIFY: "ยืนยันอีเมลสำรอง",
  RECOVERY_CHANGE: "ยืนยันการเพิ่มหรือเปลี่ยนอีเมลสำรอง",
};

const purposeDescriptions: Record<EmailVerificationPurpose, string> = {
  PRIMARY_VERIFY: "ระบบได้รับคำขอยืนยันอีเมลหลักสำหรับบัญชีของคุณ",
  PRIMARY_CHANGE: "ระบบได้รับคำขอเปลี่ยนอีเมลหลักสำหรับบัญชีของคุณ",
  RECOVERY_VERIFY: "ระบบได้รับคำขอยืนยันอีเมลสำรองสำหรับบัญชีของคุณ",
  RECOVERY_CHANGE: "ระบบได้รับคำขอเพิ่มหรือเปลี่ยนอีเมลสำรองสำหรับบัญชีของคุณ",
};

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

export class EmailVerificationEmailService {
  static async send(data: EmailVerificationData) {
    try {
      const config = await getEmailTemplateConfig();
      const purposeLabel = purposeLabels[data.purpose];
      const success = await EmailManager.sendMail({
        to: data.email,
        subject: `${data.code} - รหัสสำหรับ${purposeLabel}`,
        text: this.generateText(data, config.appName, purposeLabel),
        html: this.generateHtml(data, config.appName, config.appUrl, purposeLabel),
      });

      return success
        ? { success: true }
        : { success: false, error: "EmailManager.sendMail returned false" };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown email error",
      };
    }
  }

  private static generateText(data: EmailVerificationData, appName: string, purposeLabel: string) {
    return [
      `${purposeLabel}สำหรับ ${appName}`,
      `รหัสยืนยัน: ${data.code}`,
      `รหัสนี้มีอายุ ${data.expiresInMinutes} นาที`,
      "หากคุณไม่ได้เป็นผู้ดำเนินการ กรุณาเพิกเฉยต่ออีเมลนี้",
    ].join("\n");
  }

  private static generateHtml(data: EmailVerificationData, appName: string, appUrl: string, purposeLabel: string) {
    const safeAppName = escapeHtml(appName);
    const safePurpose = escapeHtml(purposeLabel);
    const safeCode = escapeHtml(data.code);
    const safeDescription = escapeHtml(purposeDescriptions[data.purpose]);
    const securityUrl = escapeHtml(
      `${appUrl.replace(/\/+$/, "")}/my-security?tab=recovery&modal=email-verification&emailAction=${data.purpose}`,
    );

    return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safePurpose}</title>
</head>
<body style="margin:0;padding:0;background-color:#eef2f7;font-family:'Segoe UI',Tahoma,Arial,sans-serif;color:#172033">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#eef2f7;padding:28px 12px">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:#ffffff;border:1px solid #dfe6ef">
          <tr>
            <td style="padding:34px 32px;background-color:#2563eb;text-align:center;color:#ffffff">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
                <tr>
                  <td style="width:52px;height:52px;background-color:#ffffff;border-radius:26px;text-align:center;vertical-align:middle;color:#2563eb;font-size:25px;font-weight:700">
                    ✓
                  </td>
                </tr>
              </table>
              <p style="margin:18px 0 5px;font-size:13px;font-weight:600;letter-spacing:.8px;text-transform:uppercase;color:#dbeafe">${safeAppName}</p>
              <h1 style="margin:0;font-size:25px;line-height:1.35;color:#ffffff">${safePurpose}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 34px">
              <p style="margin:0;color:#344054;font-size:15px;line-height:1.75">
                ${safeDescription}
              </p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0">
                <tr>
                  <td style="padding:22px 18px;border:1px solid #bfdbfe;background-color:#eff6ff;text-align:center">
                    <p style="margin:0 0 10px;color:#475569;font-size:12px;font-weight:600;letter-spacing:.6px;text-transform:uppercase">
                      รหัสยืนยัน 6 หลัก
                    </p>
                    <div style="font-family:Consolas,'Courier New',monospace;font-size:35px;line-height:1.2;font-weight:700;letter-spacing:12px;color:#1d4ed8">
                      ${safeCode}
                    </div>
                    <p style="margin:12px 0 0;color:#64748b;font-size:12px">
                      รหัสหมดอายุภายใน ${data.expiresInMinutes} นาที
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin:0;color:#475569;font-size:14px;line-height:1.7">
                กลับไปยังหน้าตั้งค่าบัญชี แล้วกรอกรหัสด้านบนเพื่อดำเนินการต่อ
              </p>

              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:24px auto">
                <tr>
                  <td style="background-color:#2563eb">
                    <a href="${securityUrl}" style="display:inline-block;padding:12px 22px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600">
                      เปิดหน้าตั้งค่าบัญชี
                    </a>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:22px">
                <tr>
                  <td style="padding:15px 16px;border-left:4px solid #f59e0b;background-color:#fffbeb">
                    <p style="margin:0 0 5px;color:#92400e;font-size:13px;font-weight:700">คำแนะนำด้านความปลอดภัย</p>
                    <p style="margin:0;color:#78350f;font-size:12px;line-height:1.65">
                      เจ้าหน้าที่จะไม่ขอรหัสนี้จากคุณ หากคุณไม่ได้เป็นผู้ดำเนินการ ไม่ต้องกรอกรหัสและสามารถเพิกเฉยต่ออีเมลนี้ได้
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:22px 30px;background-color:#f8fafc;border-top:1px solid #e2e8f0;text-align:center">
              <p style="margin:0;color:#64748b;font-size:12px;line-height:1.65">
                อีเมลฉบับนี้ส่งโดยอัตโนมัติจาก ${safeAppName}<br>
                กรุณาอย่าตอบกลับอีเมลฉบับนี้
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
