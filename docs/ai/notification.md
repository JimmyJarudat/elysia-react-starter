# Notification Rules

อ่านไฟล์นี้เมื่องานเกี่ยวกับ in-app notification, email notification หรือ email template

- ทุก notification ต้องผ่าน `NotificationService` (`backend/src/services/notification.service.ts`) เท่านั้น ห้ามเรียก `createInAppNotification()` (`@/utils/inapp-notification`) หรือ EmailService ตรงจาก service อื่น
- Email template อยู่ใน `backend/src/templates/email/` เปิดไฟล์ที่มีอยู่ดูเป็นตัวอย่างก่อนสร้างใหม่ เช่น `login-notification.ts` แล้วเพิ่ม method `notifyXxx` ใน `NotificationService` ตามแบบ method เดิม
- ทุก call เป็น fire-and-forget เสมอ: `void NotificationService.notifyXxx(...)` ไม่ await, แจ้งเตือนพังไม่กระทบ flow หลัก
- เลือก `type`: `LOGIN`/`SECURITY`/`SYSTEM`/`INFO`/`WARNING` ตาม gate setting ของผู้ใช้ (`login_notifications`/`security_notifications`/`system_notifications`)
- ใช้ `priority` `HIGH`/`CRITICAL` เฉพาะ action ที่กระทบความปลอดภัยทันที เช่น lock, force logout, JWT secret เปลี่ยน
- แจ้งเตือนถึงตัว user เองเมื่อ: security action บนบัญชีตัวเอง, admin แก้ข้อมูลสำคัญของ user (role/status/password/session), หรือ user ทำ action สำคัญกับบัญชีตัวเอง (เปลี่ยนรหัส/อีเมล/2FA)
- ไม่ต้อง notification กับ CRUD ทั่วไป, อ่านข้อมูล หรือเปลี่ยน preference
- แจ้งเตือนถึง admin/superadmin ด้วย `notifyUsersWithRoles()` (`@/utils/inapp-notification`) หรือ `NotificationService.notifyAdminsXxx()` เมื่อ: เปลี่ยน infrastructure setting (SMTP/Redis/CORS/JWT), action ที่ irreversible (permanent delete), security event ที่ admin ควรรู้ (IP block, role delete), หรือมี user รออนุมัติ
- ดูตัวอย่าง method ใน `notification.service.ts`; ผู้กระทำ (`actorId`) ถูก exclude อัตโนมัติ

