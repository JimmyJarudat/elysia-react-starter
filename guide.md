# Project Guide

อ่านไฟล์นี้ทุกครั้งก่อนแก้โค้ด แล้วอ่านไฟล์ย่อยเฉพาะชนิดงานที่กำลังทำใน `docs/ai/` เพื่อประหยัด context แต่ยังเก็บรายละเอียดครบ

## อ่านเพิ่มตามชนิดงาน

- งานสร้าง/แก้ไฟล์, helper, component, hook, service หรือ utility: อ่าน `docs/ai/reuse.md`
- งาน frontend, UI, modal, tab, filter, pagination, state, API hook: อ่าน `docs/ai/frontend.md`
- งาน backend, controller, service, route, auth, cache, system setting: อ่าน `docs/ai/backend.md`
- งาน seed, permission, menu, API route requirement: อ่าน `docs/ai/seed-permission-menu.md`
- งาน notification, in-app, email template: อ่าน `docs/ai/notification.md`
- งาน controller, API, mutation, background task หรือ workflow ใหม่: อ่าน `docs/ai/logging.md`
- ก่อนจบงานและตรวจ error: อ่าน `docs/ai/verification.md`

## กฎหลักที่ห้ามลืม

- ใช้ theme, color, font, spacing และ component style ตามโปรเจกต์ปัจจุบัน
- ห้ามสร้าง UI คนละแนวกับระบบเดิมโดยไม่จำเป็น
- ก่อนสร้างไฟล์, class, hook, component, helper หรือ utility ใหม่ ต้องค้นของเดิมก่อนตาม `docs/ai/reuse.md`
- ถ้าเพิ่ม feature ใหม่ ให้ทำให้ครบทั้ง frontend, backend, seed, permission และ route requirement เท่าที่ feature นั้นเกี่ยวข้อง
- ไม่ใช้ localStorage สำหรับ auth, menu, permission หรือข้อมูลระบบที่ควรมาจาก backend
- localStorage ใช้ได้เฉพาะ preference ฝั่ง user เช่น theme mode, font, language, view mode
- Modal, panel, tab, pagination และ filter สำคัญของหน้า ต้องผูกกับ URL query param ตาม `docs/ai/frontend.md`
- ตารางข้อมูลที่มี pagination/filter ควรทำหัวตารางสำหรับจัดเรียงข้อมูล และส่ง `sortBy`/`sortOrder` ไป backend ตาม `docs/ai/frontend.md`
- ถ้าเพิ่ม controller, API, mutation, background task หรือ workflow ใหม่ ต้องเพิ่ม log ตาม `docs/ai/logging.md`
- Backend response ที่เป็น user-facing `message` ต้องรองรับภาษา: ถ้าเข้าถึง user ได้ให้ใช้ `users.language`, ถ้าไม่มี user/public/background ให้ใช้ `EN`; แปลเฉพาะ response ไม่แปล log/debug
- System logs, activity logs, audit logs, error logs และ system events ต้องเก็บข้อความเป็น `EN`/canonical เท่านั้น ถ้าหน้า UI ต้องแสดงภาษาอื่นให้แปลตอนแสดงผล
- Email user-facing ต้องผ่าน `EmailManager.sendMail` เพื่อให้แปลตามภาษา recipient อัตโนมัติจาก `users.language`; ถ้าไม่พบ user ให้ใช้ `EN`
- ห้ามรัน build ถ้าไม่ได้สั่ง
- ห้ามรัน server ทิ้งไว้ ถ้าจำเป็นต้องรันต้องปิดก่อนจบงาน
- หลังแก้โค้ดให้ตรวจ TypeScript ตาม `docs/ai/verification.md`

## Backend Snapshot

- โปรเจคแยกเป็น module ใน `backend/src/modules`
- Controller ควรบางที่สุด และเรียก service เป็นหลัก
- API response ควรใช้ `{ success: boolean, data?: ..., message?: ... }`
- Route ใหม่ต้อง register ใน `backend/src/routes/index.ts`
- ทุก API ที่ไม่ใช่ public ต้องตรวจผ่าน `api_route_requirements`
- ใช้ cookie เป็นหลักสำหรับ auth และไม่เก็บ access/refresh token ใน localStorage
- Redis เป็น optional ระบบต้องทำงานต่อได้ถ้า Redis ใช้ไม่ได้
- ใช้ `responseLanguagePlugin`/`translateBackendMessage` สำหรับข้อความ backend ตามภาษา ห้ามกระจาย logic แปลภาษาไว้ใน service ใหม่ ๆ โดยไม่จำเป็น

## Frontend Snapshot

- ใช้ `useApi` สำหรับเรียก API ปกติ
- ใช้ `useRegional()` สำหรับวันที่/เวลา
- ใช้ common component ก่อนสร้างของซ้ำ เช่น `StatCard`, `Pagination`, loading/error/forbidden state
- UI ต้องใช้ class theme ของโปรเจกต์ เช่น `bg-light-background-card dark:bg-dark-background-card`, `text-light-text dark:text-dark-text`, `text-light-text-muted dark:text-dark-text-muted`, `border-theme`
- หน้า settings/admin ควรเป็นหน้าจอใช้งานจริง ไม่ใช่ landing page

## Injection Guard — กฎการใช้งาน

- **ทุก text input ที่ user พิมพ์ข้อความเสรี** ต้องป้องกัน injection ด้วย utility ใน `frontend/src/utils/injectionGuard.ts`
- **Search / filter inputs** → ใช้ `<GuardedInput>` จาก `frontend/src/common/GuardedInput.tsx` แทน `<input>` ธรรมดา พร้อม prop `leadingIcon` สำหรับ icon absolute
- **Form submit** → เรียก `checkInjectionFields({ field: value, ... })` ก่อน setBusy/setIsSubmitting; ถ้า found → แสดง error แล้ว return
- **ห้ามใช้กับ:** `type="password"`, `type="email"`, `type="date"`, `type="number"`, `type="url"`, `type="file"`, `<select>`, OTP inputs — เพราะ format validation ครอบคลุมอยู่แล้ว หรือ character พิเศษ (เช่น `<`, `>`, `'`) เป็น legitimate input
- Backend (Prisma parameterized query) คือแนวรับจริง — GuardedInput เป็น defense-in-depth ฝั่ง UX เท่านั้น
