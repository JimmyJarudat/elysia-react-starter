# Storage Tasks

สถานะไฟล์นี้: handoff note สำหรับงาน storage integration ให้ AI/คนที่มาทำต่ออ่านก่อนลงมือ

## ทำแล้ว

- เพิ่ม UI สำหรับ Storage ในหน้า `settings/integrations`
  - ไฟล์หลัก: `frontend/src/pages/system-setting/integrations/components/StorageIntegration.tsx`
  - ผูก accordion ด้วย query `?integration=storage`
  - ตัวเลือกที่มี: Local Storage, SMB / Network Share, SFTP, FTP, S3 Compatible
  - S3 Compatible มี provider ย่อย: Amazon S3, MinIO, Cloudflare R2
  - Local Storage ถูกแสดงเป็น backend default ปัจจุบัน ไม่ต้องกรอก path เพิ่ม
  - SMB `Domain` เป็น optional ไม่ใช่ required field

- แยกโครงหน้า integrations เป็น component ตามงาน
  - `frontend/src/pages/system-setting/integrations/index.tsx`
  - `frontend/src/pages/system-setting/integrations/types.ts`
  - `frontend/src/pages/system-setting/integrations/constants.ts`
  - `frontend/src/pages/system-setting/integrations/components/RedisIntegration.tsx`
  - `frontend/src/pages/system-setting/integrations/components/SmtpIntegration.tsx`
  - `frontend/src/pages/system-setting/integrations/components/StorageIntegration.tsx`
  - `frontend/src/pages/system-setting/integrations/components/IntegrationRow.tsx`
  - `frontend/src/pages/system-setting/integrations/components/Toggle.tsx`

- เพิ่ม backend storage abstraction แบบ Local adapter เงียบ ๆ
  - ไฟล์หลัก: `backend/src/utils/storage.ts`
  - adapter ปัจจุบัน: `LocalStorageAdapter`
  - methods ปัจจุบัน:
    - `writePublicFile`
    - `deletePublicFile`
    - `getPublicFile`
  - exported entrypoint: `getDefaultStorage()`

- ครอบ upload/read/delete เดิมผ่าน local adapter โดยไม่เปลี่ยน URL เดิม
  - Public read route: `backend/src/index.ts` route `GET /uploads/*`
  - Profile avatar upload/delete: `backend/src/modules/profile/profile.service.ts`
  - System logo/favicon upload/delete: `backend/src/modules/system-setting/system-setting.service.ts`
  - Notification sound upload/delete: `backend/src/modules/system-setting/system-setting.service.ts`
  - Organization logo upload/delete: `backend/src/modules/system-setting/system-setting.service.ts`

- เพิ่ม SMB / Network Share ตัวแรกที่ใช้งานจริง
  - Dependency: `smb2`
  - Type declaration: `backend/src/types/smb2.d.ts`
  - Adapter อยู่ใน `backend/src/utils/storage.ts`
  - `getDefaultStorage()` เลือก provider จาก `system_config`
  - ถ้า provider ยังเป็น `local` หรือ SMB config ไม่ครบ จะใช้ local adapter ต่อไป
  - ถ้า provider เป็น `smb` และ config ครบ upload/read/delete จะวิ่งผ่าน SMB adapter
  - SMB test connection เขียน/อ่าน/ลบ temp file ใน `_storage-test`

- เพิ่ม Storage settings API จริง
  - `GET /system-setting/storage`
  - `PUT /system-setting/storage`
  - `POST /system-setting/storage/test`
  - เพิ่ม Activity/Audit/SystemEvent logs สำหรับ update/test
  - เพิ่ม seed permission/API route/system config แล้ว

- ต่อ frontend Storage UI กับ API จริงสำหรับ Local, SMB และ SFTP
  - `StorageIntegration.tsx` โหลดค่า storage จาก backend
  - Test/Save ยิง API จริง
  - FTP/S3 ยังแสดงเป็นยังไม่พร้อมใช้งานและ disabled

- เพิ่ม SFTP provider ที่ใช้งานจริง
  - Dependency: `ssh2-sftp-client`
  - Type declaration: `backend/src/types/ssh2-sftp-client.d.ts`
  - Adapter อยู่ใน `backend/src/utils/storage.ts`
  - ใช้ storage abstraction เดียวกับ Local/SMB
  - รองรับ upload/read/delete/list/exists สำหรับ migration
  - SFTP test connection เขียน/อ่าน/ลบ temp file ใน `_storage-test`

- เพิ่ม migration ข้าม provider ได้ทุกทิศทางของ provider ที่พร้อมใช้
  - Local ↔ SMB
  - Local ↔ SFTP
  - SMB ↔ SFTP
  - มี conflict policy: skip, overwrite, fail
  - cleanup หลัง migration ลบเฉพาะไฟล์ที่ migrate สำเร็จจริง

## สิ่งที่ต้องรักษา

- Upload/read เดิมต้องทำงานเหมือนเดิม 100%
- Public file URL เดิมต้องไม่เปลี่ยน:
  - `/uploads/profiles/...`
  - `/uploads/system/...`
- Local Storage เป็น default/fallback ของ backend ปัจจุบัน
- ห้ามผูก setting ใหม่กับ upload/read เดิมแบบทำให้ของเดิมพัง
- Redis optional ฉันใด storage provider ภายนอกก็ควร optional ฉันนั้น
- ถ้าเพิ่ม controller/API/mutation/background workflow ใหม่ ต้องอ่าน `docs/ai/logging.md` และเพิ่ม log ตาม rule ใน `guide.md`
- ห้ามรัน build/server ถ้าไม่ได้สั่ง

## งานที่เหลือ

### 1. ตรวจจริงกับ SMB share ใน environment จริง

- ต้องทดสอบกับ SMB server จริงจากหน้า `settings/integrations`
- เคสที่ต้องลอง:
  - Local Storage เดิมยัง upload/read avatar/logo/sound ได้
  - SMB ที่มี domain
  - SMB ที่ไม่มี domain เช่น NAS/local account
  - base path ว่าง
  - base path เป็น folder ย่อย
  - password เว้นว่างตอน Save แล้วใช้ secret เดิม
  - SMB ปิด/ต่อไม่ได้ แล้ว Test ต้อง error โดยไม่ทำให้ local config เดิมพัง

### 2. Hardening SMB / Network Share adapter

- `Domain` ต้อง optional:
  - ถ้าใช้ AD domain ให้ส่ง domain
  - ถ้าใช้ NAS/local account/workgroup ให้เว้นว่างได้
- ต้องคง interface ให้ caller ใช้ผ่าน storage abstraction เดิม
- ห้ามเปลี่ยน caller ทีละจุดให้รู้จัก SMB โดยตรง
- public URL ยังเป็น `/uploads/...` ส่วน adapter ภายใน map ไปยัง SMB share/path เอง
- ต้องป้องกัน path traversal เหมือน Local adapter
- ยังควร harden เพิ่ม:
  - timeout/error message ให้เป็นมิตรขึ้น
  - cleanup temp file เมื่อ read fail หลัง write สำเร็จ
  - ทดสอบ compatibility ของ `smb2` บน Bun/Windows/Linux
  - พิจารณา cache adapter/config เพื่อลด DB read ต่อ static file request

### 3. ทำ provider selection

- ทำแล้วในระดับแรก: `getDefaultStorage()` คืน manager ที่อ่าน config และเลือก local/SMB
- สิ่งที่เหลือ:
  - เพิ่ม reload/cache strategy
  - เพิ่ม health status endpoint ถ้าต้องแสดง current connection status แบบ Redis
  - กำหนด fallback policy ที่ชัดเจนสำหรับ production upload failure

### 4. Frontend polish

- Local/SMB ต่อ API แล้ว
- สิ่งที่เหลือ:
  - แสดง current connection status อัตโนมัติหลังโหลด เหมือน Redis/SMTP
  - เพิ่มคำอธิบาย error จาก SMB ให้เข้าใจง่ายขึ้น
  - ปรับ UX ถ้าผู้ใช้เลือก SMB แล้วยังไม่ได้กด Test

### 5. Provider อื่นหลัง SMB/SFTP

#### S3 Compatible

- ทำหลัง SMB
- Adapter ควรรองรับ:
  - Amazon S3
  - MinIO
  - Cloudflare R2
- ต้องคง interface ให้ caller ใช้ผ่าน storage abstraction เดิม
- ห้ามเปลี่ยน caller ทีละจุดให้รู้จัก S3 โดยตรง
- ควรทำ test connection แบบไม่ทิ้งไฟล์ถาวร:
  - write temp object
  - read/head object
  - delete temp object

#### FTP

- FTP: ทำท้ายสุด หรือไม่ทำถ้าไม่จำเป็น เพราะความปลอดภัยต่ำกว่า SFTP

## ทดสอบ SFTP ที่ควรทำต่อ

- SFTP host/port/password ถูกต้องและ Test ผ่านจากหน้า `settings/integrations`
- base path ไม่มีอยู่ แล้วระบบสร้างให้ได้
- base path มีอยู่แล้ว และ upload/read/delete/list ได้
- migration Local ↔ SFTP
- migration SMB ↔ SFTP
- conflict policy:
  - skip ไม่ทับไฟล์เดิม
  - overwrite ทับไฟล์เดิม
  - fail หยุดเมื่อเจอไฟล์ซ้ำ

## จุดโครงสร้าง Frontend

- หน้า integrations:
  - `frontend/src/pages/system-setting/integrations/index.tsx`
- Types:
  - `frontend/src/pages/system-setting/integrations/types.ts`
- Defaults/style helpers:
  - `frontend/src/pages/system-setting/integrations/constants.ts`
- Storage UI:
  - `frontend/src/pages/system-setting/integrations/components/StorageIntegration.tsx`
- Shared row/toggle:
  - `frontend/src/pages/system-setting/integrations/components/IntegrationRow.tsx`
  - `frontend/src/pages/system-setting/integrations/components/Toggle.tsx`

## จุดโครงสร้าง Backend

- Storage abstraction:
  - `backend/src/utils/storage.ts`
- Public read:
  - `backend/src/index.ts`
  - route `GET /uploads/*`
- Current upload callers:
  - `backend/src/modules/profile/profile.service.ts`
  - `backend/src/modules/system-setting/system-setting.service.ts`
- System setting API pattern:
  - `backend/src/modules/system-setting/system-setting.controller.ts`
  - `backend/src/modules/system-setting/system-setting.service.ts`
- Route registration:
  - `backend/src/routes/index.ts`
- Seed permissions/API routes/system config:
  - `backend/prisma/seed.ts`

## Verification ที่ควรรันหลังแก้

- Backend changes:
  - `bunx tsc --noEmit --pretty false`
- Frontend changes:
  - `./node_modules/.bin/tsc -b --noEmit --pretty false`
- ห้ามรัน build ถ้า user ไม่ได้สั่ง
