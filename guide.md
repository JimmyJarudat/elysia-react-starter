# Project Direction

เอกสารนี้เป็นแนวทางหลักของโปรเจกต์ ให้ทุกครั้งที่แก้โค้ดยึดทิศทางเดียวกัน

## หลักการรวม

- ใช้ theme, color, font, spacing และ component style ตามโปรเจกต์ปัจจุบัน
- ห้ามสร้าง UI คนละแนวกับระบบเดิมโดยไม่จำเป็น
- แยกงาน backend เป็น controller, service, utils ตามรูปแบบที่มีอยู่แล้ว
- ก่อนสร้างไฟล์, class, hook, component, helper หรือ utility ใหม่ ต้องค้นของเดิมทั้งโปรเจกต์ก่อนเสมอ
- ถ้าเพิ่ม feature ใหม่ ให้ทำให้ครบทั้ง frontend, backend, seed, permission และ route requirement เท่าที่ feature นั้นเกี่ยวข้อง
- ไม่ใช้ localStorage สำหรับ auth, menu, permission หรือข้อมูลระบบที่ควรมาจาก backend
- localStorage ใช้ได้เฉพาะ preference ฝั่ง user เช่น theme mode, font, language, view mode

## ค้นก่อนสร้าง (สำคัญสำหรับ AI)

โปรเจกต์นี้ให้ความสำคัญกับการใช้ของเดิมและลดโค้ดซ้ำ ก่อนสร้างอะไรใหม่ AI ต้องตรวจโครงสร้างและค้นชื่อหรือพฤติกรรมที่ใกล้เคียงก่อนทุกครั้ง ห้ามสรุปจากชื่อไฟล์ที่เปิดอยู่เพียงอย่างเดียวว่าโปรเจกต์ยังไม่มีสิ่งนั้น

### ขั้นตอนบังคับก่อนสร้างไฟล์ใหม่

1. ค้นชื่อที่ต้องการสร้าง รวมถึงชื่อเอกพจน์ พหูพจน์ และคำใกล้เคียงทั้งโปรเจกต์
   - ตัวอย่าง: ก่อนสร้าง `notifications.service.ts` ต้องค้น `notification`, `notifications`, `NotificationService`
   - ตัวอย่าง: ก่อนสร้าง `date-helper.ts` ต้องค้น `date`, `formatDate`, `formatSystemDate`
2. ค้นจากพฤติกรรมหรือ function ที่กำลังจะเขียน ไม่ค้นเฉพาะชื่อไฟล์
   - ตัวอย่าง: ก่อนเขียน JSON parser ให้ค้น `JSON.parse`, `parseJson`
   - ตัวอย่าง: ก่อนเขียน cache clear ให้ค้น `invalidate`, `clearCache`, `redis.del`
3. เปิดอ่านไฟล์ที่พบเพื่อดูความรับผิดชอบจริงก่อนตัดสินใจ
4. ถ้าของเดิมทำงานใกล้เคียง ให้ขยายหรือ reuse ของเดิมก่อน
5. สร้างไฟล์ใหม่ได้เมื่อความรับผิดชอบต่างจากของเดิมชัดเจน และต้องตั้งชื่อให้สื่อความต่างนั้น
6. หลังแก้เสร็จ ต้องค้นซ้ำเพื่อยืนยันว่าไม่มี import เก่า, class ชื่อซ้ำ หรือ helper ซ้ำหลงเหลือ

### กฎตัดสินใจ Reuse, Extend หรือ Create

- **Reuse**: ของเดิมทำงานตรงความต้องการอยู่แล้ว ให้ import มาใช้ ห้าม copy implementation
- **Extend**: ของเดิมเป็นเจ้าของ responsibility เดียวกัน แต่ยังขาด option หรือ method ให้ขยายของเดิม
- **Create**: สร้างใหม่เมื่อเป็น responsibility ใหม่จริง หรือของเดิมไม่ควรถูกขยายเพราะจะทำให้ไฟล์รับผิดชอบหลายเรื่อง
- ถ้ามี logic เหมือนกันตั้งแต่ 2 จุดขึ้นไป ให้พิจารณาย้ายเป็น utility/common กลาง
- ถ้า logic ใช้เพียง method เดียวและสั้น ให้อยู่ใน method นั้นก่อน ไม่ต้องรีบแตก helper
- ห้ามสร้าง wrapper ที่เพียงเรียก utility เดิมโดยไม่ได้เพิ่ม business meaning, validation หรือ behavior

### กฎการตั้งชื่อเพื่อป้องกันไฟล์ซ้ำ

- ห้ามแยกความต่างด้วยการเติม `s`, `helper`, `utils`, `manager`, `common`, `new`, `v2` เพียงอย่างเดียว
- ชื่อต้องบอก responsibility โดยตรง เช่น:
  - `notification.service.ts` ใช้ส่ง In-App/Email notification
  - `notification-inbox.service.ts` ใช้อ่านและจัดการกล่องแจ้งเตือน
  - `session-creation.service.ts` ใช้สร้าง session ตอน login
  - `sessions.service.ts` ใช้จัดการรายการ session ฝั่ง admin
- ถ้าพบไฟล์ชื่อคล้ายกัน ต้องตรวจว่าซ้ำจริงหรือทำคนละหน้าที่ก่อนรวม ลบ หรือเปลี่ยนชื่อ
- ห้ามสร้าง class/function ชื่อใหม่ที่ทำงานเหมือนของเดิมเพียงเพราะต้องการ API รูปแบบอื่น ให้ปรับของเดิมหรือเปลี่ยน caller

### ของเดิมที่ต้องตรวจดูก่อน Backend

ก่อนสร้าง utility หรือเขียน logic ซ้ำ ให้ค้นใน `backend/src/utils`, `backend/src/config`, `backend/src/services` โดยเฉพาะ:

- Cache invalidation: `@/utils/cache-invalidation`
- อ่าน system config: `@/utils/get-setting-value`
- Password hashing และ comparison: `@/utils/password`
- Password policy และ password history: `@/utils/password-policy`
- วันที่และเวลาระบบ: `@/utils/date-formatter`
- แปลง location จาก session: `@/utils/format-location`
- Parse JSON object อย่างปลอดภัย: `@/utils/parse-json-object`
- Email verification challenge และ Redis fallback: `@/utils/email-challenge`
- Auth history logging: `@/utils/auth-history`
- Client IP, browser, OS และ device: `@/utils/clientInfo`
- Online presence: `@/utils/online-presence`
- In-App notification ระดับล่าง: `@/utils/inapp-notification` ซึ่งเรียกผ่าน `NotificationService` เท่านั้น
- Current user จาก request headers: `@/utils/get-current-user`
- Email template config: `@/utils/email-template-config`

รายการนี้เป็นจุดเริ่มต้น ไม่ใช่รายการทั้งหมด ก่อนสร้างใหม่ยังต้องค้น directory จริงเสมอ เพราะ utility อาจถูกเพิ่มภายหลัง

### ของเดิมที่ต้องตรวจดูก่อน Frontend

ก่อนสร้าง component, hook, context หรือ formatter ใหม่ ให้ค้นใน `frontend/src/common`, `frontend/src/hooks`, `frontend/src/contexts`, `frontend/src/utils` และ feature ที่เกี่ยวข้องก่อน โดยเฉพาะ:

- เรียก API: `useApi`
- วันที่และเวลา: `useRegional()` และ date utility ที่มีอยู่
- URL ของไฟล์อัปโหลด/asset: utility ใน `frontend/src/utils/assetUrl.ts`
- State/summary card: `frontend/src/common/StatCard.tsx`
- Loading, pagination, forbidden และ common state: component ใน `frontend/src/common`
- Session, menu, appearance และ system identity: context ที่มีอยู่ใน `frontend/src/contexts`
- Modal หลักของหน้า: ใช้ URL query param ตามแนวทาง Modal ในเอกสารนี้

ถ้า common component รองรับไม่ครบ ให้ขยาย props/variant ของ component เดิมก่อนสร้าง component หน้าตาและหน้าที่ซ้ำกันอีกตัว

### สิ่งที่ AI ห้ามทำ

- ห้ามสร้าง utility ใหม่ทันทีโดยไม่รายงานว่าค้นอะไรแล้วและเหตุผลที่ของเดิมใช้ไม่ได้
- ห้าม copy helper จาก service หนึ่งไปอีก service หนึ่ง
- ห้ามสร้าง service ชื่อเอกพจน์/พหูพจน์คู่กันโดยไม่มีชื่อที่บอกหน้าที่ชัดเจน
- ห้ามสร้าง abstraction เผื่ออนาคต หากยังมีผู้ใช้เพียงจุดเดียวและไม่ได้ลดความซับซ้อนจริง
- ห้ามย้าย business flow ออกจาก method จนต้องกระโดดหลายไฟล์เพื่อเข้าใจงานหนึ่งเรื่อง
- ห้ามสร้าง type/interface กลาง หากใช้เฉพาะ method เดียวและ TypeScript infer ได้ชัดเจน
- ห้ามเพิ่ม dependency ใหม่ หาก standard library หรือ utility เดิมทำได้อยู่แล้ว
- ห้ามลบหรือรวมไฟล์ชื่อคล้ายกันก่อนตรวจ caller และ responsibility ทั้งหมด

### Checklist ก่อนจบงาน

- ค้นแล้วว่าไม่มี utility/service/component เดิมที่ทำงานเดียวกัน
- ใช้หรือขยายของเดิมทุกจุดที่เหมาะสมแล้ว
- ไม่มี implementation เดียวกันถูก copy หลายไฟล์
- ชื่อไฟล์และ class บอก responsibility ชัด ไม่พึ่งแค่เอกพจน์/พหูพจน์
- ไม่มี import path หรือชื่อ class เก่าหลงเหลือหลัง rename
- Service ยังอ่าน business method เดียวจบ และ utility มีเฉพาะ logic ที่ใช้ร่วมกันจริง

## Backend

- โปรเจคแยกเป็น module  /backend/src/modules
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

## Date & Time Formatting

- ทุกการแสดงวันที่/เวลาใน frontend ต้องใช้ `useRegional()` จาก `@/contexts/RegionalContext`
- ใช้ `formatDate`, `formatDateTime`, หรือ `formatTime` จาก hook แทนการ hardcode locale หรือ `toLocaleString`
- ใน backend ให้ใช้ `formatSystemDate()` (async) หรือ `formatSystemDateSync()` จาก `@/utils/date-formatter`
- ห้าม hardcode `'th-TH'` หรือ `toLocaleString('th-TH')` ทั้ง frontend และ backend
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

## Frontend

- ใช้ `useApi` สำหรับเรียก API ปกติ
- Hook หรือ effect ที่เรียก API ผ่าน `useApi()` ต้องระวัง function identity ของ `get/post/put/patch/del` เพราะอาจเปลี่ยนทุก render ถ้า effect ควรยิงตาม query/filter/page เท่านั้น ให้เก็บ API function ไว้ใน `useRef` หรือจัด dependency ให้ผูกกับ state จริง ไม่ผูกกับ function จาก `useApi` เพื่อป้องกัน fetch -> setState -> render -> fetch ซ้ำวนลูป
- API ที่เป็น upload ให้ใช้ `FormData` และ `multipart/form-data`
- ใช้ context เมื่อข้อมูลต้องใช้หลายจุด เช่น session, menu, appearance, system identity
- Modal หรือ panel ที่เป็น state สำคัญของหน้า ต้องผูกกับ URL query param เช่น `?modal=edit&id=1`, `?panel=appearance`, `?submodal=reset-password`
- ห้ามใช้ `useState` อย่างเดียวในการเปิด/ปิด modal หลักของหน้า เพราะ refresh แล้วสถานะจะหาย
- การเปิด modal ให้ใช้ `useSearchParams()` จาก `react-router-dom` และปิด modal ด้วยการลบ query param ที่เกี่ยวข้อง
- Modal ที่ต้องรู้ target record ให้เก็บ `id` หรือ key ใน URL แล้ว sync target จากข้อมูลจริงของหน้า
- Sub-modal ซ้อน modal ใช้ param แยก เช่น `submodal` เพื่อไม่ชนกับ modal หลัก
- Tab, pagination (`?page=`), และ filter ที่เป็น state สำคัญของหน้า (search, status, date range ฯลฯ) ต้องผูกกับ URL query param ด้วย `useSearchParams()` เช่นกัน — ห้ามเก็บไว้ใน `useState` อย่างเดียว เพราะ refresh แล้วค่าจะหาย/รีเซ็ตกลับค่าเริ่มต้น
- อ่านค่าเริ่มต้นจาก URL ด้วย lazy initializer ของ `useState(() => ...)` และเขียนกลับ URL ผ่านฟังก์ชันกลาง (เช่น `changeTab`/`changePage`) ที่ทั้ง set state และ set/delete query param พร้อมกัน
- Effect ที่ใช้ reset page เมื่อ filter เปลี่ยน ห้ามใช้ ref flag แบบ `isFirstRender = useRef(true)` เพราะ React Strict Mode รัน effect ซ้ำตอน mount ทำให้ flag ถูกพลิกเป็น `false` ก่อนเวลาและยิง reset ทับค่าที่ restore มาจาก URL — ให้เทียบค่าฟิลเตอร์ก่อนหน้ากับปัจจุบันผ่าน ref แทน (`prevFiltersRef`)
- State ชั่วคราวที่ไม่ควร restore หลัง refresh เช่น password ที่กรอกอยู่ หรือ token ที่แสดงได้ครั้งเดียว ไม่ต้องเก็บใน URL
- Dropdown ธรรมดา เช่น user dropdown, select menu, tooltip ไม่จำเป็นต้อง persist ด้วย URL ยกเว้นเป็น panel สำคัญของ workflow
- State card, stat card, summary card หรือการ์ดตัวเลขภาพรวม ให้ใช้ common component ก่อน เช่น `frontend/src/common/StatCard.tsx`
- ถ้า common card ยังไม่รองรับรูปแบบที่ต้องการ ให้ขยาย common component แทนการ copy class card ใหม่กระจายหลายหน้า
- Empty/loading/error state ที่ใช้ซ้ำหลายหน้า ควรทำเป็น common component ก่อน ไม่ควรเขียน UI ซ้ำทุกหน้า
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

## Notification (In-App & Email)

- ทุก notification ต้องผ่าน `NotificationService` (`backend/src/services/notification.service.ts`) เท่านั้น — ห้ามเรียก `createInAppNotification()` (`@/utils/inapp-notification`) หรือ EmailService ตรงจาก service อื่น
- Email template อยู่ใน `backend/src/templates/email/` — เปิดไฟล์ที่มีอยู่ดูเป็นตัวอย่างก่อนสร้างใหม่ (เช่น `login-notification.ts`) แล้วเพิ่ม method `notifyXxx` ใน `NotificationService` ตามแบบ method เดิม
- ทุก call เป็น fire-and-forget เสมอ: `void NotificationService.notifyXxx(...)` — ไม่ await, แจ้งเตือนพังไม่กระทบ flow หลัก
- เลือก `type`: `LOGIN`/`SECURITY`/`SYSTEM`/`INFO`/`WARNING` ตาม gate setting ของผู้ใช้ (`login_notifications`/`security_notifications`/`system_notifications`) — `priority` `HIGH`/`CRITICAL` เฉพาะ action ที่กระทบความปลอดภัยทันที เช่น lock, force logout, JWT secret เปลี่ยน
- แจ้งเตือนถึง **ตัว user เอง** เมื่อ: security action บนบัญชีตัวเอง, admin แก้ข้อมูลสำคัญของ user (role/status/password/session), หรือ user ทำ action สำคัญกับบัญชีตัวเอง (เปลี่ยนรหัส/อีเมล/2FA) — ไม่ต้องมีกับ CRUD ทั่วไป, อ่านข้อมูล หรือเปลี่ยน preference
- แจ้งเตือนถึง **admin/superadmin** ด้วย `notifyUsersWithRoles()` (`@/utils/inapp-notification`) หรือ `NotificationService.notifyAdminsXxx()` เมื่อ: เปลี่ยน infrastructure setting (SMTP/Redis/CORS/JWT), action ที่ irreversible (permanent delete), security event ที่ admin ควรรู้ (IP block, role delete), หรือมี user รออนุมัติ — ดูตัวอย่าง method ใน `notification.service.ts`, ผู้กระทำ (`actorId`) ถูก exclude อัตโนมัติ

## Verification

- ไม่ต้อง build ถ้าไม่ได้สั่ง
- หลังแก้โค้ดให้เช็ก error ด้วย TypeScript:
  - Backend: `bunx tsc --noEmit --pretty false`
  - Frontend: `./node_modules/.bin/tsc -b --noEmit --pretty false`
- ถ้าแก้เฉพาะ frontend ให้เช็ก frontend
- ถ้าแก้เฉพาะ backend ให้เช็ก backend
- ถ้าคำสั่งติด sandbox ให้ขอรันนอก sandbox เฉพาะคำสั่งเช็ก error


ที่สำคัญ ห้ามรัน server ทิ้งไว  ถ้าจำเป็นต้องรัน  สามารถรันได้  และจบงานปิดให้ด้วย  ไม่งั้น server ที่ฉันรันไว้ พอตชน และไม่อัปเดท

### Logs (ระบบบันทึกเหตุการณ์)

| หน้า | คำอธิบาย |
|---|---|
| Logs | ภาพรวมข้อมูลบันทึกเหตุการณ์ทั้งหมดภายในระบบ พร้อมสถิติและแนวโน้มการใช้งาน |
| ├─ Request Logs | บันทึกการเรียกใช้งาน API, Status Code, Response Time, IP Address และรายละเอียด Request/Response |
| ├─ Authentication Logs | บันทึก Login, Logout, Failed Login, Password Reset, Email Verification และเหตุการณ์ด้านความปลอดภัย |
| ├─ Activity Logs | บันทึกกิจกรรมที่ผู้ใช้งานดำเนินการ เช่น Create, Update, Delete, Approve, Reject, Import, Export |
| ├─ Audit Logs | บันทึกการเปลี่ยนแปลงข้อมูลสำคัญ พร้อมข้อมูลก่อนและหลังแก้ไข (Before/After) |
| ├─ Error Logs | บันทึก Exception, Validation Error, Database Error และข้อผิดพลาดที่เกิดขึ้นภายในระบบ |
| ├─ System Events | บันทึกเหตุการณ์ระดับระบบ เช่น Scheduler, Queue Jobs, Cache Events, Email Jobs และ Background Tasks |
| └─ Live Console | แสดง Log และ Event ของ Backend แบบ Real-time สำหรับติดตามการทำงานของระบบขณะใช้งาน |

- [ ] สร้างหน้า Frontend สำหรับดู/ค้นหา/กรอง/resolve Logs แต่ละประเภท (Backend logging coverage ครบทุกจุดหลักแล้ว)
- [ ] เพิ่ม retention/cleanup policy สำหรับตาราง Log เมื่อปริมาณข้อมูลจริงชัดเจน

## Logging — เมื่อเพิ่ม Feature ใหม่

Backend logging ทำครบทุกจุดแล้ว ใช้ของเดิมเท่านั้น ห้ามสร้างระบบ log ใหม่หรือเขียนซ้ำ:

- Mutation ที่ user/admin สั่ง → `ActivityLogUtil` (ส่ง `actorId` เสมอ) + `AuditLogUtil` ถ้าข้อมูลสำคัญถูกเปลี่ยน (before/after, ห้ามเก็บ password/token/secret/OTP)
- Auth event (login, logout, password, 2FA) → `AuthHistoryUtil`
- Exception/error ที่ catch แล้วผิดปกติ หรือคืน `500` → `ErrorLogUtil` (ไม่ใช้กับ validation/401/403/404 ที่เป็น flow ปกติ)
- Background/cron/infra event สำคัญ → `SystemEventUtil` — cron สำเร็จเขียนแค่ `cron_run_history`, ล้มเหลวค่อยเพิ่ม `system_events` + `error_logs`
- ห้ามเขียน Activity ซ้ำกับสิ่งที่ `request_logs` บันทึกอยู่แล้ว (ทุก API call) หรือกับการอ่านข้อมูล/preference ทั่วไป

```typescript
ActivityLogUtil.log({ userId, action: 'CREATE', resourceType: 'users', resourceId: id, description: '...' });
AuditLogUtil.log({ userId, action: 'UPDATE', tableName: 'users', recordId: id, beforeData, afterData });
ErrorLogUtil.log(error, { source: 'service-name', userId });
SystemEventUtil.failed('CRON', 'job-name', errorMessage);
```

Path: `@/utils/activity-log`, `@/utils/audit-log`, `@/utils/error-log`, `@/utils/system-event` — ทุกตัวเป็น fire-and-forget (`void`, ไม่ await)
