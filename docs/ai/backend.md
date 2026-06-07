# Backend Rules

อ่านไฟล์นี้เมื่องานเกี่ยวกับ backend, controller, service, route, auth, cache หรือ system setting

## Backend

- โปรเจคแยกเป็น module ใน `backend/src/modules`
- Controller ควรบางที่สุด และเรียก service เป็นหลัก
- Logic ที่ใช้ซ้ำหรือแยกความรับผิดชอบได้ ให้ย้ายไป service หรือ utils
- ใน service ให้จัดโค้ดแบบอ่าน method เดียวจบก่อน: key, default, validation, mapping และ helper เฉพาะงานควรอยู่ใน method หรือใกล้กลุ่ม method นั้น
- หลีกเลี่ยงการกอง type/interface/constants/helper เฉพาะ feature ไว้หัวไฟล์ ถ้าไม่ได้ถูกใช้ซ้ำหลายจุดจริง
- Helper ที่อยู่หัวไฟล์ควรเป็น helper กลางที่หลาย method ใช้ร่วมกันจริงเท่านั้น เช่น database config helper หรือ crypto/config access helper
- ก่อนเพิ่ม helper ใหม่ใน service ให้ค้น `backend/src/utils` และ `backend/src/config` ก่อน ถ้ามี utility กลางอยู่แล้วให้ import มาใช้หรือขยาย utility นั้นแทนการเขียนซ้ำ
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

## Date & Time Formatting

- ใน backend ให้ใช้ `formatSystemDate()` (async) หรือ `formatSystemDateSync()` จาก `@/utils/date-formatter`
- ห้าม hardcode `'th-TH'` หรือ `toLocaleString('th-TH')`
- Regional settings (timezone, dateFormat, timeFormat, yearEra) เก็บใน `system_config` category `REGIONAL`
- yearEra รองรับ `"CE"` (ค.ศ.) และ `"BE"` (พ.ศ. = ค.ศ. + 543)

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

## Cache

- Redis เป็น optional
- ถ้า Redis ใช้ไม่ได้ ระบบต้องยังทำงานต่อได้
- เมื่อแก้ menu หรือ API route requirement ต้อง clear cache ที่เกี่ยวข้อง
- ถ้าเจอข้อมูลยังไม่เปลี่ยนหลัง update ให้ตรวจ Redis cache และ frontend context refresh

