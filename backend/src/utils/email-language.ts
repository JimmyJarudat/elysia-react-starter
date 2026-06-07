import type { SendMailOptions } from "nodemailer";
import prisma from "@/config/prisma.config";
import { normalizeBackendLanguage, type BackendLanguage } from "@/utils/response-language";

const TH_TO_EN_PHRASES: Array<[string, string]> = [
  ["ยืนยันอีเมลของคุณ", "Verify your email"],
  ["Verify Your Email Address", "Verify Your Email Address"],
  ["รหัสยืนยันอีเมล", "Email verification code"],
  ["รหัสยืนยัน", "Verification code"],
  ["รหัสสำหรับ", "Code for "],
  ["ยืนยันอีเมลหลัก", "Verify primary email"],
  ["ยืนยันการเปลี่ยนอีเมลหลัก", "Verify primary email change"],
  ["ยืนยันอีเมลสำรอง", "Verify recovery email"],
  ["ยืนยันการเพิ่มหรือเปลี่ยนอีเมลสำรอง", "Verify recovery email change"],
  ["ระบบได้รับคำขอยืนยันอีเมลหลักสำหรับบัญชีของคุณ", "We received a request to verify the primary email for your account"],
  ["ระบบได้รับคำขอเปลี่ยนอีเมลหลักสำหรับบัญชีของคุณ", "We received a request to change the primary email for your account"],
  ["ระบบได้รับคำขอยืนยันอีเมลสำรองสำหรับบัญชีของคุณ", "We received a request to verify the recovery email for your account"],
  ["ระบบได้รับคำขอเพิ่มหรือเปลี่ยนอีเมลสำรองสำหรับบัญชีของคุณ", "We received a request to add or change the recovery email for your account"],
  ["รหัสยืนยัน 6 หลัก", "6-digit verification code"],
  ["รหัสหมดอายุภายใน", "Code expires in"],
  ["รหัสนี้มีอายุ", "This code expires in"],
  ["นาที", "minutes"],
  ["กลับไปยังหน้าตั้งค่าบัญชี แล้วกรอกรหัสด้านบนเพื่อดำเนินการต่อ", "Return to account settings and enter the code above to continue"],
  ["เปิดหน้าตั้งค่าบัญชี", "Open account settings"],
  ["คำแนะนำด้านความปลอดภัย", "Security advice"],
  ["เจ้าหน้าที่จะไม่ขอรหัสนี้จากคุณ หากคุณไม่ได้เป็นผู้ดำเนินการ ไม่ต้องกรอกรหัสและสามารถเพิกเฉยต่ออีเมลนี้ได้", "Staff will never ask for this code. If you did not request this, do not enter the code and ignore this email."],
  ["อีเมลฉบับนี้ส่งโดยอัตโนมัติจาก", "This email was sent automatically by"],
  ["อีเมลนี้ถูกส่งโดยระบบอัตโนมัติ กรุณาอย่าตอบกลับ", "This email was sent automatically. Please do not reply."],
  ["กรุณาอย่าตอบกลับอีเมลฉบับนี้", "Please do not reply to this email"],
  ["รีเซ็ตรหัสผ่าน", "Reset password"],
  ["คุณได้ร้องขอการรีเซ็ตรหัสผ่าน", "You requested a password reset"],
  ["สวัสดีครับ/ค่ะ คุณ", "Hello"],
  ["เราได้รับคำขอรีเซ็ตรหัสผ่านสำหรับบัญชีของคุณใน", "We received a password reset request for your account in"],
  ["กรุณาคลิกปุ่มด้านล่างเพื่อตั้งรหัสผ่านใหม่", "Click the button below to set a new password"],
  ["ตั้งรหัสผ่านใหม่", "Set new password"],
  ["หมายเหตุสำคัญ", "Important note"],
  ["ลิงก์นี้จะหมดอายุใน", "This link expires in"],
  ["หากคุณไม่ได้ร้องขอการรีเซ็ตรหัสผ่าน กรุณาละเว้นอีเมลนี้", "If you did not request a password reset, please ignore this email"],
  ["บัญชีของคุณจะยังคงปลอดภัย", "Your account remains secure"],
  ["หากปุ่มด้านบนไม่ทำงาน คุณสามารถคัดลอกลิงก์ด้านล่างนี้ไปวางในเบราว์เซอร์:", "If the button does not work, copy the link below into your browser:"],
  ["หากมีคำถามหรือต้องการความช่วยเหลือ กรุณาติดต่อทีม IT Support", "If you have questions or need help, please contact IT Support"],
  ["อีเมลนี้ส่งอัตโนมัติจากระบบ กรุณาอย่าตอบกลับ", "This email was sent automatically. Please do not reply."],
  ["ส่งเมื่อ", "Sent at"],
  ["ยินดีต้อนรับสู่", "Welcome to"],
  ["ข้อมูลสำหรับเข้าสู่ระบบ", "Sign-in information"],
  ["ชื่อผู้ใช้", "Username"],
  ["รหัสผ่านชั่วคราว", "Temporary password"],
  ["บทบาท", "Role"],
  ["เข้าสู่ระบบ", "Sign in"],
  ["มีผู้ใช้ใหม่ลงทะเบียนในระบบ", "New user registered"],
  ["การแจ้งเตือนผู้ใช้ใหม่", "New user notification"],
  ["ผู้ใช้ใหม่ลงทะเบียน", "New user registration"],
  ["อีเมล", "Email"],
  ["วันที่สร้าง", "Created at"],
  ["เปิดใช้งานบัญชี", "Open account"],
  ["แจ้งเตือนการเข้าสู่ระบบ", "Sign-in notification"],
  ["เข้าสู่ระบบบัญชี", "Account sign-in"],
  ["รายละเอียดการเข้าสู่ระบบ", "Sign-in details"],
  ["เวลาเข้าสู่ระบบ", "Sign-in time"],
  ["ที่อยู่ IP", "IP address"],
  ["อุปกรณ์", "Device"],
  ["เบราว์เซอร์", "Browser"],
  ["ระบบปฏิบัติการ", "Operating system"],
  ["หากนี่ไม่ใช่คุณ", "If this was not you"],
  ["บัญชีถูกล็อคชั่วคราว", "Account temporarily locked"],
  ["บัญชีถูกล็อกชั่วคราว", "Account temporarily locked"],
  ["แจ้งเตือนความปลอดภัย", "Security alert"],
  ["จำนวนครั้งที่พยายาม", "Attempt count"],
  ["ถูกล็อกจนถึง", "Locked until"],
  ["รหัสผ่านของบัญชี", "Password for account"],
  ["ถูกเปลี่ยนเมื่อ", "was changed at"],
  ["รหัสผ่านถูกรีเซ็ตโดยผู้ดูแลระบบ", "Password was reset by an administrator"],
  ["เปลี่ยนรหัสผ่านแล้ว", "Password changed"],
  ["การเปลี่ยนแปลงอีเมลบัญชี", "Account email change"],
  ["อีเมลหลัก", "Primary email"],
  ["อีเมลสำรอง", "Recovery email"],
  ["เซสชันของคุณถูกยกเลิกโดยผู้ดูแล", "Your session was revoked by an administrator"],
  ["เซสชันบัญชี", "Account session"],
  ["ถูกยกเลิกโดยผู้ดูแลระบบ", "was revoked by an administrator"],
  ["ออกจากระบบโดยผู้ดูแล", "Signed out by administrator"],
  ["บัญชี", "Account"],
  ["ถูกออกจากระบบโดยผู้ดูแล", "was signed out by an administrator"],
  ["บัญชีถูกปลดล็อกโดยผู้ดูแลระบบ", "Account unlocked by an administrator"],
  ["สถานะบัญชี", "Account status"],
  ["ถูกเปลี่ยนโดยผู้ดูแลระบบ", "was changed by an administrator"],
  ["ถูกเปิดใช้งาน", "enabled"],
  ["ถูกปิดใช้งาน", "disabled"],
  ["รายละเอียด", "Details"],
  ["กลับไปเข้าสู่ระบบ", "Back to sign in"],
  ["ติดต่อฝ่ายสนับสนุน", "Contact support"],
];

const getPrimaryRecipient = (to: SendMailOptions["to"]) => {
  if (!to) return null;
  if (typeof to === "string") return to.split(/[;,]/)[0]?.trim() || null;
  if (Array.isArray(to)) {
    const first = to[0];
    return typeof first === "string" ? first : first?.address ?? null;
  }
  return typeof to === "object" && "address" in to ? to.address ?? null : null;
};

const extractEmail = (value: string) => {
  const match = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match?.[0]?.toLowerCase() ?? null;
};

export async function getEmailRecipientLanguage(to: SendMailOptions["to"]): Promise<BackendLanguage> {
  const email = extractEmail(getPrimaryRecipient(to) ?? "");
  if (!email) return "EN";

  try {
    const rows = await prisma.$queryRaw<Array<{ language: string | null }>>`
      SELECT TOP 1 language FROM users WHERE LOWER(email) = ${email} AND is_deleted = 0
    `;
    return normalizeBackendLanguage(rows[0]?.language);
  } catch {
    return "EN";
  }
}

const localizeString = (value: string, language: BackendLanguage) => {
  if (language !== "EN") return value;

  return TH_TO_EN_PHRASES.reduce(
    (next, [thai, english]) => next.replaceAll(thai, english),
    value,
  ).replace(/<html lang="th">/g, '<html lang="en">');
};

export async function localizeMailOptions(mailOptions: SendMailOptions): Promise<SendMailOptions> {
  const language = await getEmailRecipientLanguage(mailOptions.to);
  if (language !== "EN") return mailOptions;

  return {
    ...mailOptions,
    subject: typeof mailOptions.subject === "string" ? localizeString(mailOptions.subject, language) : mailOptions.subject,
    text: typeof mailOptions.text === "string" ? localizeString(mailOptions.text, language) : mailOptions.text,
    html: typeof mailOptions.html === "string" ? localizeString(mailOptions.html, language) : mailOptions.html,
  };
}
