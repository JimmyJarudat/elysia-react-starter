import nodemailer from "nodemailer";
import prisma from "@/config/prisma.config";
import { decryptText } from "@/utils/encryption";
import { getRedisClient } from "@/config/redis.config";

const SMTP_CACHE_KEY = "smtp:config";
const SMTP_CACHE_TTL = 300; // 5 min

interface SmtpConfig {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  fromName: string;
  fromEmail: string;
  requireTLS: boolean;
}

let transporter: nodemailer.Transporter | null = null;
let isSmtpAvailable = false;

async function getSmtpConfig(): Promise<SmtpConfig | null> {
  const redis = await getRedisClient();

  if (redis) {
    try {
      const cached = await redis.get(SMTP_CACHE_KEY);
      if (cached) return JSON.parse(cached) as SmtpConfig;
    } catch { /* fall through */ }
  }

  const configs = await prisma.system_config.findMany({
    where: { category: "SMTP", is_active: true },
  });

  if (configs.length === 0) return null;

  const raw = new Map(
    configs.map((c) => {
      let value: string | boolean | number = c.value;

      switch (c.data_type) {
        case "BOOLEAN":
          value = c.value.toLowerCase() === "true";
          break;
        case "NUMBER":
          value = parseInt(c.value, 10) || 0;
          break;
        default:
          if (c.is_encrypted && c.value) {
            try {
              value = decryptText(c.value);
            } catch {
              value = c.value;
            }
          }
      }

      return [c.id, value];
    }),
  );

  const config: SmtpConfig = {
    enabled: (raw.get("smtp_enabled") as boolean) ?? false,
    host: (raw.get("smtp_host") as string) ?? "",
    port: (raw.get("smtp_port") as number) ?? 587,
    secure: (raw.get("smtp_secure") as boolean) ?? false,
    user: (raw.get("smtp_user") as string) ?? "",
    password: (raw.get("smtp_password") as string) ?? "",
    fromName: (raw.get("smtp_from_name") as string) ?? "System",
    fromEmail: (raw.get("smtp_from_email") as string) ?? "",
    requireTLS: (raw.get("smtp_require_tls") as boolean) ?? true,
  };

  if (!config.host || !config.port || !config.user) return null;

  if (redis) {
    try {
      await redis.set(SMTP_CACHE_KEY, JSON.stringify(config), "EX", SMTP_CACHE_TTL);
    } catch { /* non-critical */ }
  }

  return config;
}

async function initializeSmtp(): Promise<void> {
  try {
    const config = await getSmtpConfig();

    if (!config || !config.enabled) {
      isSmtpAvailable = false;
      console.log("[SMTP] Disabled via system_config");
      return;
    }

    transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: { user: config.user, pass: config.password },
      requireTLS: config.requireTLS,
      tls: { rejectUnauthorized: false },
    });

    await transporter.verify();
    isSmtpAvailable = true;
    console.log(`[SMTP] Connected — ${config.host}:${config.port} (${config.fromEmail})`);
  } catch (error) {
    isSmtpAvailable = false;
    transporter = null;
    console.error("[SMTP] Failed to connect:", error instanceof Error ? error.message : error);
  }
}

export async function reloadSmtp(): Promise<void> {
  if (transporter) {
    try { transporter.close(); } catch { /* ignore */ }
    transporter = null;
    isSmtpAvailable = false;
  }

  const redis = await getRedisClient();
  if (redis) {
    try { await redis.del(SMTP_CACHE_KEY); } catch { /* ignore */ }
  }

  await initializeSmtp();
}

export async function pingSmtp(): Promise<{ connected: boolean; error?: string }> {
  if (!isSmtpAvailable || !transporter) {
    return { connected: false, error: "SMTP not initialized" };
  }
  try {
    await transporter.verify();
    return { connected: true };
  } catch (error) {
    return { connected: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export class EmailManager {
  static async sendMail(mailOptions: nodemailer.SendMailOptions): Promise<boolean> {
    if (!isSmtpAvailable || !transporter) {
      console.error("[SMTP] Transporter not available");
      return false;
    }

    try {
      const config = await getSmtpConfig();
      if (!mailOptions.from && config) {
        mailOptions.from = `"${config.fromName}" <${config.fromEmail}>`;
      }
      await transporter.sendMail(mailOptions);
      return true;
    } catch (error) {
      console.error("[SMTP] Send failed:", error instanceof Error ? error.message : error);
      return false;
    }
  }

  static async sendVerificationCode(email: string, code: string): Promise<boolean> {
    return this.sendMail({
      to: email,
      subject: "รหัสยืนยันอีเมล - Email Verification Code",
      html: `
<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background-color:#f5f7fa;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f5f7fa;padding:40px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="background-color:#ffffff;border-radius:16px;box-shadow:0 4px 6px rgba(0,0,0,0.1);overflow:hidden;max-width:600px;width:100%;">
        <tr>
          <td style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:40px 30px;text-align:center;">
            <h1 style="color:#ffffff;font-size:28px;font-weight:700;margin:0;">ยืนยันอีเมลของคุณ</h1>
            <p style="color:rgba(255,255,255,0.9);font-size:16px;margin:10px 0 0 0;">Verify Your Email Address</p>
          </td>
        </tr>
        <tr>
          <td style="padding:40px 30px;">
            <p style="color:#666666;font-size:15px;line-height:1.6;margin:0 0 30px 0;">
              เราได้รับคำขอยืนยันอีเมลของคุณ กรุณาใช้รหัสยืนยันด้านล่างเพื่อดำเนินการต่อ
            </p>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:30px 0;">
              <tr><td align="center">
                <div style="background-color:#f8f9ff;border:2px solid #667eea;border-radius:12px;padding:24px 40px;display:inline-block;">
                  <p style="color:#999999;font-size:12px;margin:0 0 8px 0;text-transform:uppercase;letter-spacing:1px;font-weight:600;">รหัสยืนยัน</p>
                  <p style="color:#667eea;font-size:36px;font-weight:700;margin:0;letter-spacing:8px;font-family:'Courier New',monospace;">${code}</p>
                </div>
              </td></tr>
            </table>
            <div style="background-color:#fef3c7;border-radius:8px;padding:16px;margin:20px 0;">
              <p style="color:#92400e;font-size:13px;margin:0;line-height:1.5;">
                ⏰ <strong>รหัสนี้จะหมดอายุใน 10 นาที</strong><br>
                🔒 อย่าแชร์รหัสนี้กับผู้อื่น หากคุณไม่ได้ขอรหัสยืนยัน กรุณาเพิกเฉยอีเมลนี้
              </p>
            </div>
          </td>
        </tr>
        <tr>
          <td style="background-color:#f8f9fa;padding:24px 30px;text-align:center;border-top:1px solid #e5e7eb;">
            <p style="color:#999999;font-size:12px;margin:0;">อีเมลนี้ถูกส่งโดยระบบอัตโนมัติ กรุณาอย่าตอบกลับ</p>
            <p style="color:#cccccc;font-size:11px;margin:8px 0 0 0;">© ${new Date().getFullYear()} IT Utilities System. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    });
  }
}

export function getSmtpStatus() {
  return { isAvailable: isSmtpAvailable, hasTransporter: !!transporter };
}

// Initialize on startup
initializeSmtp();
