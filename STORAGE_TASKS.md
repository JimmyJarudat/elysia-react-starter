# Storage Tasks

สถานะไฟล์นี้: handoff note สำหรับงาน storage integration ให้ AI/คนที่มาทำต่ออ่านก่อนลงมือ

## ทำแล้ว

- เพิ่ม mock UI สำหรับ Storage ในหน้า `settings/integrations`
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

### 1. ทำ Storage settings backend จริง

- เพิ่ม system config keys สำหรับ storage provider
  - `storage_provider`
  - `storage_s3_provider`
  - `storage_s3_endpoint`
  - `storage_s3_region`
  - `storage_s3_bucket`
  - `storage_s3_access_key`
  - `storage_s3_secret_key` เป็น secret
  - `storage_s3_path_prefix`
  - `storage_s3_force_path_style`
- เพิ่ม API ใน system setting module
  - `GET /system-setting/storage`
  - `PUT /system-setting/storage`
  - `POST /system-setting/storage/test`
- เพิ่ม seed permission/menu/API route requirement ตาม pattern Redis/SMTP
- เพิ่ม logging เพราะเป็น API/mutation ใหม่

### 2. ทำ S3 Compatible adapter จริง

- เริ่มจาก S3 Compatible ก่อน SMB/SFTP/FTP
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

### 3. ทำ provider selection

- `getDefaultStorage()` ตอนนี้คืน local เสมอ
- ระยะต่อไปควรเปลี่ยนเป็น factory ที่อ่าน config และเลือก adapter
- ถ้า config ผิดหรือ external provider ต่อไม่ได้ ต้อง fallback/รายงานอย่างระวัง ไม่ทำให้ upload/read เดิมพังทันที

### 4. ต่อ frontend Storage UI กับ API

- เปลี่ยน `StorageIntegration.tsx` จาก mock state เป็น API จริง
- ใช้ `useApi`
- ใช้ permission ตาม pattern เดิม:
  - `settings.integrations.storage.read`
  - `settings.integrations.storage.update`
- Test/Save ต้องยิง backend จริง
- Secret field ต้องใช้แนวเดียวกับ SMTP/Redis password: ถ้าไม่กรอกให้ใช้ค่าเดิม

### 5. Provider อื่นหลัง S3

- SFTP: ทำหลัง S3
- SMB / Network Share: ทำหลัง SFTP เพราะ auth/domain/platform จุกจิกกว่า
- FTP: ทำท้ายสุด หรือไม่ทำถ้าไม่จำเป็น เพราะความปลอดภัยต่ำกว่า SFTP

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
