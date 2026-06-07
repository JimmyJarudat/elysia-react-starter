# Logging Rules

อ่านไฟล์นี้เมื่อเพิ่ม controller, API, mutation, background task หรือ workflow ใหม่

## Logs Pages

| หน้า | คำอธิบาย |
|---|---|
| Logs | ภาพรวมข้อมูลบันทึกเหตุการณ์ทั้งหมดภายในระบบ พร้อมสถิติและแนวโน้มการใช้งาน |
| Request Logs | บันทึกการเรียกใช้งาน API, Status Code, Response Time, IP Address และรายละเอียด Request/Response |
| Authentication Logs | บันทึก Login, Logout, Failed Login, Password Reset, Email Verification และเหตุการณ์ด้านความปลอดภัย |
| Activity Logs | บันทึกกิจกรรมที่ผู้ใช้งานดำเนินการ เช่น Create, Update, Delete, Approve, Reject, Import, Export |
| Audit Logs | บันทึกการเปลี่ยนแปลงข้อมูลสำคัญ พร้อมข้อมูลก่อนและหลังแก้ไข (Before/After) |
| Error Logs | บันทึก Exception, Validation Error, Database Error และข้อผิดพลาดที่เกิดขึ้นภายในระบบ |
| System Events | บันทึกเหตุการณ์ระดับระบบ เช่น Scheduler, Queue Jobs, Cache Events, Email Jobs และ Background Tasks |
| Live Console | แสดง Log และ Event ของ Backend แบบ Real-time สำหรับติดตามการทำงานของระบบขณะใช้งาน |

## เมื่อเพิ่ม Feature ใหม่

Backend logging ทำครบทุกจุดแล้ว ใช้ของเดิมเท่านั้น ห้ามสร้างระบบ log ใหม่หรือเขียนซ้ำ

- ถ้าเพิ่ม controller, API, mutation, background task หรือ workflow ใหม่ ต้องเพิ่ม log ให้ครบตามกฎนี้
- เลือกตาราง log ให้ตรงเจ้าของเหตุการณ์ และไม่เขียนซ้ำหลายตารางโดยไม่มีเหตุผล
- ข้อความที่เก็บใน log (`description`, `message`, `source`, `eventName`) ต้องเป็น `EN`/canonical เท่านั้น ห้ามเก็บข้อความตามภาษา user; ถ้าหน้า UI ต้องแสดงภาษาอื่นให้แปลตอน render
- Mutation ที่ user/admin สั่ง ใช้ `ActivityLogUtil` และส่ง `actorId` เสมอ
- ถ้าข้อมูลสำคัญถูกเปลี่ยน ให้เพิ่ม `AuditLogUtil` พร้อม before/after และห้ามเก็บ password/token/secret/OTP
- Auth event เช่น login, logout, password, 2FA ใช้ `AuthHistoryUtil`
- Exception/error ที่ catch แล้วผิดปกติ หรือคืน `500` ใช้ `ErrorLogUtil`
- ไม่ใช้ `ErrorLogUtil` กับ validation/401/403/404 ที่เป็น flow ปกติ
- Background/cron/infra event สำคัญ ใช้ `SystemEventUtil`
- Cron สำเร็จเขียนแค่ `cron_run_history`; cron ล้มเหลวค่อยเพิ่ม `system_events` + `error_logs`
- ห้ามเขียน Activity ซ้ำกับสิ่งที่ `request_logs` บันทึกอยู่แล้ว (ทุก API call) หรือกับการอ่านข้อมูล/preference ทั่วไป

```typescript
ActivityLogUtil.log({ userId, action: "CREATE", resourceType: "users", resourceId: id, description: "..." });
AuditLogUtil.log({ userId, action: "UPDATE", tableName: "users", recordId: id, beforeData, afterData });
ErrorLogUtil.log(error, { source: "service-name", userId });
SystemEventUtil.failed("CRON", "job-name", errorMessage);
```

Path: `@/utils/activity-log`, `@/utils/audit-log`, `@/utils/error-log`, `@/utils/system-event` ทุกตัวเป็น fire-and-forget (`void`, ไม่ await)
