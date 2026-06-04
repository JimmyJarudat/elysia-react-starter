# Project Direction

เอกสารนี้เป็นแนวทางหลักของโปรเจกต์ ให้ทุกครั้งที่แก้โค้ดยึดทิศทางเดียวกัน

## หลักการรวม

- ใช้ theme, color, font, spacing และ component style ตามโปรเจกต์ปัจจุบัน
- ห้ามสร้าง UI คนละแนวกับระบบเดิมโดยไม่จำเป็น
- แยกงาน backend เป็น controller, service, utils ตามรูปแบบที่มีอยู่แล้ว
- ถ้าเพิ่ม feature ใหม่ ให้ทำให้ครบทั้ง frontend, backend, seed, permission และ route requirement เท่าที่ feature นั้นเกี่ยวข้อง
- ไม่ใช้ localStorage สำหรับ auth, menu, permission หรือข้อมูลระบบที่ควรมาจาก backend
- localStorage ใช้ได้เฉพาะ preference ฝั่ง user เช่น theme mode, font, language, view mode

## Backend

- Controller อยู่ใน `backend/src/controllers`
- Service อยู่ใน `backend/src/services`
- Controller ควรบางที่สุด และเรียก service เป็นหลัก
- Logic ที่ใช้ซ้ำหรือแยกความรับผิดชอบได้ ให้ย้ายไป service หรือ utils
- API response ควรใช้รูปแบบ `{ success: boolean, data?: ..., message?: ... }`
- Route ใหม่ต้อง register ใน `backend/src/routes/index.ts`
- ถ้า route ต้องตรวจ permission ให้เพิ่มใน seed ของ `api_route_requirements`
- ถ้า route ยังไม่มีใน `api_route_requirements` middleware จะ auto register เป็น `is_active = false` และยังไม่ผูก permission

## Authentication

- ใช้ cookie เป็นหลักสำหรับ auth
- Frontend เรียก API ด้วย `withCredentials`
- Refresh token ทำผ่าน cookie และ endpoint refresh token
- ไม่เก็บ access token หรือ refresh token ใน localStorage
- Personal Access Token ใช้ได้เฉพาะ `Authorization: Bearer pat_...`
- Bearer token ที่ไม่ใช่ PAT ไม่ควรถูกใช้แทน cookie auth

## Permission

- ทุก API ที่ไม่ใช่ public ต้องตรวจผ่าน `api_route_requirements`
- Permission ต้องมีใน `permissions`
- Role ต้องได้ permission ผ่าน `role_permissions`
- Super Admin ต้องได้ permission ครบจาก seed
- Frontend ต้องใช้ permission จริงจาก session ไม่ hardcode เฉพาะ role เว้นแต่เป็นกรณีพิเศษจริง ๆ
- ปุ่ม action ใน frontend เช่น create, update, delete, revoke, impersonate ต้องซ่อนหรือ disable ตาม permission

## Seed

- เวลาเพิ่มหน้าใหม่หรือ API ใหม่ ให้พิจารณา seed ด้วยเสมอ
- ถ้าเพิ่ม permission ใหม่ ต้องเพิ่มใน `permissions`
- ถ้าเพิ่ม API ที่ต้องป้องกัน ต้องเพิ่มใน `apiRoutes`
- ถ้าเพิ่มเมนู sidebar ต้องเพิ่มใน `menus`
- Seed ควรไม่ทำลายค่าที่ผู้ใช้แก้ในฐานข้อมูลจริงโดยไม่จำเป็น
- Config ที่เป็น secret เช่น password/token/key ไม่ควร seed ค่าจริง
- Seed ไม่ควรพึ่ง Redis เพราะ environment เริ่มต้นอาจยังไม่มี Redis

## Menu

- Sidebar menu มาจากฐานข้อมูล ไม่ hardcode ใน frontend
- Menu ถูก filter ด้วย permission ของ user
- เมนูหลักที่สำคัญ เช่น `/admin-console` และ `/admin-console/menus` ต้องระวังไม่ให้ผู้ใช้ปิดพลาด
- หลัง create/update/delete menu ต้อง clear cache ที่เกี่ยวข้อง
- ถ้าเพิ่มหน้าใหม่ ต้องเพิ่ม menu seed เฉพาะเมื่อควรเข้าถึงผ่าน sidebar

## System Settings

- System setting ใช้ `system_config` เป็นแหล่งข้อมูลหลัก
- ค่า system identity ตอนนี้ประกอบด้วย:
  - `system_name`
  - `system_subtitle`
  - `system_logo_url`
  - `system_favicon_url`
- Logo และ favicon อัปโหลดไปที่ `backend/uploads/system`
- ไฟล์ใน `/uploads/...` ต้องเป็น public route
- Uploaded files จริงต้องไม่ติด git
- Theme, font, language เป็น preference ของ user ไม่ใช่ system default ในหน้านี้

## Frontend

- ใช้ `useApi` สำหรับเรียก API ปกติ
- API ที่เป็น upload ให้ใช้ `FormData` และ `multipart/form-data`
- ใช้ context เมื่อข้อมูลต้องใช้หลายจุด เช่น session, menu, appearance, system identity
- UI ต้องใช้ class theme ของโปรเจกต์ เช่น:
  - `bg-light-background-card dark:bg-dark-background-card`
  - `text-light-text dark:text-dark-text`
  - `text-light-text-muted dark:text-dark-text-muted`
  - `border-theme`
- หน้า settings/admin ควรเป็นหน้าจอใช้งานจริง ไม่ใช่ landing page
- ถ้าข้อมูลเยอะ ให้ใช้ dropdown, filter, grouping, collapse ตามความเหมาะสม

## Cache

- Redis เป็น optional
- ถ้า Redis ใช้ไม่ได้ ระบบต้องยังทำงานต่อได้
- เมื่อแก้ menu หรือ API route requirement ต้อง clear cache ที่เกี่ยวข้อง
- ถ้าเจอข้อมูลยังไม่เปลี่ยนหลัง update ให้ตรวจ Redis cache และ frontend context refresh

## Verification

- ไม่ต้อง build ถ้าไม่ได้สั่ง
- หลังแก้โค้ดให้เช็ก error ด้วย TypeScript:
  - Backend: `bunx tsc --noEmit --pretty false`
  - Frontend: `./node_modules/.bin/tsc -b --noEmit --pretty false`
- ถ้าแก้เฉพาะ frontend ให้เช็ก frontend
- ถ้าแก้เฉพาะ backend ให้เช็ก backend
- ถ้าคำสั่งติด sandbox ให้ขอรันนอก sandbox เฉพาะคำสั่งเช็ก error
