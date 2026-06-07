import { Elysia } from "elysia";
import { getCurrentUserFromHeaders } from "@/utils/get-current-user";

export type BackendLanguage = "EN" | "TH";

const EN_TO_TH: Record<string, string> = {
  "Authentication required": "กรุณาเข้าสู่ระบบ",
  "Unauthorized": "ไม่ได้รับอนุญาต",
  "Forbidden": "ไม่มีสิทธิ์เข้าถึง",
  "Access denied": "ปฏิเสธการเข้าถึง",
  "Insufficient role": "สิทธิ์บทบาทไม่เพียงพอ",
  "Insufficient permission": "สิทธิ์ไม่เพียงพอ",
  "Authentication token is required": "กรุณาเข้าสู่ระบบ",
  "Invalid or expired personal access token": "Personal access token ไม่ถูกต้องหรือหมดอายุ",
  "Bearer token must be a Personal Access Token (pat_...)": "Bearer token ต้องเป็น Personal Access Token (pat_...)",
  "Invalid token payload": "ข้อมูล token ไม่ถูกต้อง",
  "Session expired": "เซสชันหมดอายุ",
  "Session expired due to inactivity": "เซสชันหมดอายุเนื่องจากไม่มีการใช้งาน",
  "User not found": "ไม่พบผู้ใช้",
  "User account is suspended": "บัญชีผู้ใช้ถูกระงับ",
  "User not found or inactive": "ไม่พบผู้ใช้หรือบัญชีถูกปิดใช้งาน",
  "User not found or not deleted": "ไม่พบผู้ใช้หรือผู้ใช้นี้ไม่ได้ถูกลบ",
  "Invalid language": "ภาษาไม่ถูกต้อง",
  "Registration is currently disabled": "ระบบปิดรับสมัครสมาชิกชั่วคราว",
  "Username, email, and password are required": "กรุณากรอกชื่อผู้ใช้ อีเมล และรหัสผ่าน",
  "Default registration role is not configured": "ยังไม่ได้ตั้งค่า role เริ่มต้นสำหรับการสมัครสมาชิก",
  "Registration successful. You can sign in now.": "สมัครสมาชิกสำเร็จ สามารถเข้าสู่ระบบได้แล้ว",
  "Registration successful. Please wait for admin approval.": "สมัครสมาชิกสำเร็จ กรุณารอผู้ดูแลระบบอนุมัติ",
  "Invalid credentials": "ข้อมูลเข้าสู่ระบบไม่ถูกต้อง",
  "Invalid username or password": "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง",
  "This account has been suspended": "บัญชีนี้ถูกระงับการใช้งาน",
  "This account has not been approved yet": "บัญชีนี้ยังไม่ได้รับการอนุมัติ",
  "This account does not exist in the system or has been deleted": "ไม่พบบัญชีนี้ในระบบหรือบัญชีถูกลบแล้ว",
  "This account has expired. Please contact the system administrator": "บัญชีนี้หมดอายุแล้ว กรุณาติดต่อผู้ดูแลระบบ",
  "Please verify two-factor authentication": "กรุณายืนยันตัวตนสองขั้นตอน",
  "Login successful": "เข้าสู่ระบบสำเร็จ",
  "Internal server error": "เกิดข้อผิดพลาดภายในระบบ",
  "No refresh token found": "ไม่พบ refresh token",
  "Invalid refresh token payload": "ข้อมูล refresh token ไม่ถูกต้อง",
  "Invalid refresh token": "Refresh token ไม่ถูกต้อง",
  "Logout successful": "ออกจากระบบสำเร็จ",
  "Invalid gender": "เพศไม่ถูกต้อง",
  "Country must use a 2-letter code": "ประเทศต้องใช้รหัส 2 ตัวอักษร",
  "Invalid date of birth": "วันเกิดไม่ถูกต้อง",
  "Avatar must be PNG, JPG, or WEBP": "รูปโปรไฟล์ต้องเป็น PNG, JPG หรือ WEBP",
  "Avatar must be 3MB or smaller": "รูปโปรไฟล์ต้องมีขนาดไม่เกิน 3MB",
  "Invalid session id": "รหัสเซสชันไม่ถูกต้อง",
  "Session not found": "ไม่พบเซสชัน",
  "Session already inactive": "เซสชันนี้ไม่ได้ใช้งานแล้ว",
  "Session revoked": "ยกเลิกเซสชันแล้ว",
  "Notification not found": "ไม่พบการแจ้งเตือน",
  "Menu not found": "ไม่พบเมนู",
  "Parent menu not found": "ไม่พบเมนูหลัก",
  "Permission not found": "ไม่พบ permission",
  "Menu cannot be its own parent": "เมนูไม่สามารถเป็นเมนูหลักของตัวเองได้",
  "Cannot delete a menu that has sub-items. Remove sub-items first.": "ไม่สามารถลบเมนูที่มีเมนูย่อยได้ กรุณาลบเมนูย่อยก่อน",
  "Cannot delete your own account": "ไม่สามารถลบบัญชีของตัวเองได้",
  "Cannot change your own account status": "ไม่สามารถเปลี่ยนสถานะบัญชีของตัวเองได้",
  "Password must be at least 8 characters": "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร",
  "Invalid IP address format": "รูปแบบ IP address ไม่ถูกต้อง",
  "IP address is required": "กรุณาระบุ IP address",
  "IP blocklist entry not found": "ไม่พบรายการ IP blocklist",
  "Redis is disabled": "Redis ถูกปิดใช้งาน",
  "Redis disabled or unavailable": "Redis ถูกปิดใช้งานหรือไม่พร้อมใช้งาน",
  "Redis unavailable": "Redis ไม่พร้อมใช้งาน",
  "SMTP is disabled": "SMTP ถูกปิดใช้งาน",
  "SMTP host and port are required": "กรุณาระบุ SMTP host และ port",
  "SMTP connection verified": "ตรวจสอบการเชื่อมต่อ SMTP สำเร็จ",
  "SMTP connection failed": "เชื่อมต่อ SMTP ไม่สำเร็จ",
  "Recipient email is required": "กรุณาระบุอีเมลผู้รับ",
  "Failed to send test email": "ส่งอีเมลทดสอบไม่สำเร็จ",
};

const TH_TO_EN: Record<string, string> = {
  "กรุณาเข้าสู่ระบบ": "Authentication required",
  "ไม่ได้รับอนุญาต": "Unauthorized",
  "ไม่มีสิทธิ์เข้าถึง": "Forbidden",
  "ปฏิเสธการเข้าถึง": "Access denied",
  "ไม่พบผู้ใช้": "User not found",
  "ภาษาไม่ถูกต้อง": "Invalid language",
  "รูปแบบอีเมลไม่ถูกต้อง": "Invalid email format",
  "กรุณายืนยันอีเมลหลักเดิมก่อนเปลี่ยนอีเมล": "Please verify your current primary email before changing it",
  "อีเมลนี้ถูกใช้งานแล้ว": "This email is already in use",
  "กรุณาระบุอีเมลใหม่": "Please enter a new email address",
  "ยังไม่มีอีเมลสำรองให้ยืนยัน": "No recovery email is available to verify",
  "กรุณายืนยันอีเมลสำรองเดิมก่อนเปลี่ยนอีเมล": "Please verify your current recovery email before changing it",
  "อีเมลสำรองต้องไม่ซ้ำกับอีเมลหลัก": "Recovery email must be different from primary email",
  "ไม่สามารถส่งอีเมลยืนยันได้": "Unable to send verification email",
  "ส่งรหัสยืนยันแล้ว": "Verification code sent",
  "รหัสหมดอายุหรือยังไม่ได้ขอรหัส": "Code expired or was not requested",
  "กรอกรหัสผิดเกินจำนวนที่กำหนด กรุณาขอรหัสใหม่": "Too many incorrect attempts. Please request a new code",
  "อีเมลหลักถูกเปลี่ยนแล้ว กรุณาขอรหัสใหม่": "Primary email has changed. Please request a new code",
  "อีเมลสำรองถูกเปลี่ยนแล้ว กรุณาขอรหัสใหม่": "Recovery email has changed. Please request a new code",
  "ยืนยันอีเมลเรียบร้อยแล้ว": "Email verified",
  "รหัสผ่านปัจจุบันไม่ถูกต้อง": "Current password is incorrect",
  "รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านปัจจุบัน": "New password must be different from the current password",
  "เปลี่ยนรหัสผ่านเรียบร้อยแล้ว": "Password changed successfully",
  "2FA เปิดใช้งานอยู่แล้ว กรุณาปิดก่อนตั้งค่าใหม่": "2FA is already enabled. Disable it before setting it up again",
  "กรุณาเริ่มต้นตั้งค่า 2FA ก่อน": "Please start 2FA setup first",
  "2FA เปิดใช้งานอยู่แล้ว": "2FA is already enabled",
  "พยายามยืนยันเกินจำนวนที่กำหนด กรุณาตั้งค่า 2FA ใหม่อีกครั้ง": "Too many verification attempts. Please set up 2FA again",
  "รหัส OTP ไม่ถูกต้อง กรุณาตรวจสอบนาฬิกาของอุปกรณ์แล้วลองใหม่": "Invalid OTP. Check your device clock and try again",
  "2FA ยังไม่ได้เปิดใช้งาน": "2FA is not enabled",
  "ไม่พบข้อมูล 2FA": "2FA data not found",
  "พยายามยืนยันเกินจำนวนที่กำหนด กรุณาลองใหม่ภายหลัง": "Too many verification attempts. Please try again later",
  "รหัส OTP ไม่ถูกต้อง": "Invalid OTP",
  "ปิดใช้งาน 2FA เรียบร้อยแล้ว": "2FA disabled successfully",
  "ไม่สามารถจัดการ session ปัจจุบันได้": "Cannot manage the current session",
  "ไม่สามารถปิด session ปัจจุบันของตัวเองได้": "Cannot revoke your current session",
  "ไม่พบอีเมลหรือชื่อผู้ใช้นี้ในระบบ": "Email or username was not found",
  "บัญชีนี้ยังไม่ได้ตั้งค่าอีเมลสำรอง": "This account has no recovery email configured",
  "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง": "Something went wrong. Please try again",
  "กรุณากรอกข้อมูลให้ครบถ้วน": "Please fill in all required fields",
  "ลิงก์รีเซ็ตรหัสผ่านไม่ถูกต้องหรือหมดอายุแล้ว": "Password reset link is invalid or expired",
  "บัญชีนี้ถูกปิดใช้งาน": "This account is disabled",
  "ลิงก์รีเซ็ตรหัสผ่านหมดอายุแล้ว กรุณาขอใหม่อีกครั้ง": "Password reset link has expired. Please request a new one",
  "รีเซ็ตรหัสผ่านสำเร็จ กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่": "Password reset successful. Please sign in with your new password",
  "บัญชีไม่พบหรือถูกปิดใช้งาน": "Account not found or disabled",
  "2FA ไม่ได้เปิดใช้งานบนบัญชีนี้": "2FA is not enabled for this account",
  "ลิงก์ยืนยันไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่": "Verification link is invalid. Please sign in again",
  "พยายามยืนยันเกินจำนวน กรุณาเข้าสู่ระบบใหม่อีกครั้ง": "Too many verification attempts. Please sign in again",
  "เกิดข้อผิดพลาด กรุณาเข้าสู่ระบบใหม่": "Something went wrong. Please sign in again",
};

const dynamicRules: Array<{
  from: BackendLanguage;
  pattern: RegExp;
  to: (match: RegExpMatchArray) => string;
}> = [
  { from: "TH", pattern: /^(.+) already exists$/, to: ([, field]) => `${field} ถูกใช้งานแล้ว` },
  { from: "TH", pattern: /^Account temporarily suspended\. Please try again in (\d+) minutes$/, to: ([, minutes]) => `บัญชีถูกระงับชั่วคราว กรุณาลองใหม่ใน ${minutes} นาที` },
  { from: "TH", pattern: /^Cannot delete role "(.+)" — it is assigned to (\d+) user\(s\)$/, to: ([, role, count]) => `ไม่สามารถลบ role "${role}" ได้ เพราะถูกใช้งานโดยผู้ใช้ ${count} คน` },
  { from: "TH", pattern: /^Role "(.+)" not found$/, to: ([, role]) => `ไม่พบ role "${role}"` },
  { from: "TH", pattern: /^Permission ID "(.+)" already exists$/, to: ([, id]) => `Permission ID "${id}" ถูกใช้งานแล้ว` },
  { from: "TH", pattern: /^Role ID "(.+)" already exists$/, to: ([, id]) => `Role ID "${id}" ถูกใช้งานแล้ว` },
  { from: "TH", pattern: /^IP (.+) is already in the blocklist$/, to: ([, ip]) => `IP ${ip} อยู่ใน blocklist แล้ว` },
  { from: "TH", pattern: /^Redis connection verified \((.+)ms\)$/, to: ([, ms]) => `ตรวจสอบการเชื่อมต่อ Redis สำเร็จ (${ms}ms)` },
  { from: "TH", pattern: /^Redis connected \((.+)ms\)$/, to: ([, ms]) => `เชื่อมต่อ Redis สำเร็จ (${ms}ms)` },
  { from: "TH", pattern: /^Deleted (.+)$/, to: ([, key]) => `ลบ ${key} แล้ว` },
  { from: "TH", pattern: /^Key not found: (.+)$/, to: ([, key]) => `ไม่พบ key: ${key}` },
  { from: "TH", pattern: /^Cleared (\d+) Redis key\(s\)$/, to: ([, count]) => `ล้าง Redis ${count} key แล้ว` },
  { from: "TH", pattern: /^Cleared (\d+) Redis key\(s\) in (.+)$/, to: ([, count, group]) => `ล้าง Redis ${count} key ใน ${group} แล้ว` },
  { from: "TH", pattern: /^Test email sent to (.+)$/, to: ([, email]) => `ส่งอีเมลทดสอบไปยัง ${email} แล้ว` },
  { from: "EN", pattern: /^กรุณารอ (\d+) นาทีก่อนขอลิงก์ใหม่$/, to: ([, minutes]) => `Please wait ${minutes} minutes before requesting a new link` },
  { from: "EN", pattern: /^ส่งลิงก์รีเซ็ตรหัสผ่านไปยัง (.+) เรียบร้อยแล้ว ลิงก์มีอายุ (\d+) นาที$/, to: ([, email, minutes]) => `Password reset link sent to ${email}. The link expires in ${minutes} minutes` },
  { from: "EN", pattern: /^ไม่สามารถใช้รหัสผ่านซ้ำกับ (\d+) รหัสล่าสุดได้$/, to: ([, count]) => `Cannot reuse any of your last ${count} passwords` },
  { from: "EN", pattern: /^รหัสไม่ถูกต้อง เหลืออีก (\d+) ครั้ง$/, to: ([, count]) => `Invalid code. ${count} attempt(s) remaining` },
  { from: "EN", pattern: /^รหัส OTP ไม่ถูกต้อง \(เหลืออีก (\d+) ครั้ง\)$/, to: ([, count]) => `Invalid OTP. ${count} attempt(s) remaining` },
  { from: "EN", pattern: /^รหัส OTP ไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่$/, to: () => "Invalid OTP. Please sign in again" },
  { from: "EN", pattern: /^บัญชีถูกระงับชั่วคราว (\d+) นาที เนื่องจากพยายามเข้าสู่ระบบผิดหลายครั้ง.*$/, to: ([, minutes]) => `Account temporarily suspended for ${minutes} minutes because of too many failed sign-in attempts` },
];

export const normalizeBackendLanguage = (language?: string | null): BackendLanguage => {
  return language?.trim().toUpperCase() === "TH" ? "TH" : "EN";
};

export const translateBackendMessage = (message: string, language?: string | null) => {
  const target = normalizeBackendLanguage(language);
  const exact = target === "TH" ? EN_TO_TH[message] : TH_TO_EN[message];
  if (exact) return exact;

  for (const rule of dynamicRules) {
    if (rule.from !== target) continue;
    const match = message.match(rule.pattern);
    if (match) return rule.to(match);
  }

  return message;
};

export const getRequestLanguage = (request: Request) => {
  try {
    return normalizeBackendLanguage(getCurrentUserFromHeaders(request)?.language);
  } catch {
    return "EN";
  }
};

const translateResponseMessage = (response: unknown, language: BackendLanguage) => {
  if (!response || typeof response !== "object" || response instanceof Response) return response;
  if (!("message" in response) || typeof response.message !== "string") return response;

  return {
    ...response,
    message: translateBackendMessage(response.message, language),
  };
};

export const responseLanguagePlugin = new Elysia({ name: "response-language" })
  .onAfterHandle({ as: "global" }, ({ request, response }) => {
    return translateResponseMessage(response, getRequestLanguage(request));
  });
