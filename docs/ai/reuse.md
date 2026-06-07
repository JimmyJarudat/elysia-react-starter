# Reuse And Creation Rules

โปรเจกต์นี้ให้ความสำคัญกับการใช้ของเดิมและลดโค้ดซ้ำ ก่อนสร้างอะไรใหม่ต้องตรวจโครงสร้างและค้นชื่อหรือพฤติกรรมที่ใกล้เคียงก่อนทุกครั้ง ห้ามสรุปจากชื่อไฟล์ที่เปิดอยู่เพียงอย่างเดียวว่าโปรเจกต์ยังไม่มีสิ่งนั้น

## ขั้นตอนบังคับก่อนสร้างไฟล์ใหม่

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

## Reuse, Extend, Create

- **Reuse**: ของเดิมทำงานตรงความต้องการอยู่แล้ว ให้ import มาใช้ ห้าม copy implementation
- **Extend**: ของเดิมเป็นเจ้าของ responsibility เดียวกัน แต่ยังขาด option หรือ method ให้ขยายของเดิม
- **Create**: สร้างใหม่เมื่อเป็น responsibility ใหม่จริง หรือของเดิมไม่ควรถูกขยายเพราะจะทำให้ไฟล์รับผิดชอบหลายเรื่อง
- ถ้ามี logic เหมือนกันตั้งแต่ 2 จุดขึ้นไป ให้พิจารณาย้ายเป็น utility/common กลาง
- ถ้า logic ใช้เพียง method เดียวและสั้น ให้อยู่ใน method นั้นก่อน ไม่ต้องรีบแตก helper
- ห้ามสร้าง wrapper ที่เพียงเรียก utility เดิมโดยไม่ได้เพิ่ม business meaning, validation หรือ behavior

## Naming

- ห้ามแยกความต่างด้วยการเติม `s`, `helper`, `utils`, `manager`, `common`, `new`, `v2` เพียงอย่างเดียว
- ชื่อต้องบอก responsibility โดยตรง เช่น:
  - `notification.service.ts` ใช้ส่ง In-App/Email notification
  - `notification-inbox.service.ts` ใช้อ่านและจัดการกล่องแจ้งเตือน
  - `session-creation.service.ts` ใช้สร้าง session ตอน login
  - `sessions.service.ts` ใช้จัดการรายการ session ฝั่ง admin
- ถ้าพบไฟล์ชื่อคล้ายกัน ต้องตรวจว่าซ้ำจริงหรือทำคนละหน้าที่ก่อนรวม ลบ หรือเปลี่ยนชื่อ
- ห้ามสร้าง class/function ชื่อใหม่ที่ทำงานเหมือนของเดิมเพียงเพราะต้องการ API รูปแบบอื่น ให้ปรับของเดิมหรือเปลี่ยน caller

## Backend ของเดิมที่ต้องตรวจ

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

## Frontend ของเดิมที่ต้องตรวจ

ก่อนสร้าง component, hook, context หรือ formatter ใหม่ ให้ค้นใน `frontend/src/common`, `frontend/src/hooks`, `frontend/src/contexts`, `frontend/src/utils` และ feature ที่เกี่ยวข้องก่อน โดยเฉพาะ:

- เรียก API: `useApi`
- วันที่และเวลา: `useRegional()` และ date utility ที่มีอยู่
- URL ของไฟล์อัปโหลด/asset: utility ใน `frontend/src/utils/assetUrl.ts`
- State/summary card: `frontend/src/common/StatCard.tsx`
- Loading, pagination, forbidden และ common state: component ใน `frontend/src/common`
- Session, menu, appearance และ system identity: context ที่มีอยู่ใน `frontend/src/contexts`
- Modal หลักของหน้า: ใช้ URL query param ตามแนวทาง Modal ใน `docs/ai/frontend.md`

ถ้า common component รองรับไม่ครบ ให้ขยาย props/variant ของ component เดิมก่อนสร้าง component หน้าตาและหน้าที่ซ้ำกันอีกตัว

## ห้ามทำ

- ห้ามสร้าง utility ใหม่ทันทีโดยไม่รายงานว่าค้นอะไรแล้วและเหตุผลที่ของเดิมใช้ไม่ได้
- ห้าม copy helper จาก service หนึ่งไปอีก service หนึ่ง
- ห้ามสร้าง service ชื่อเอกพจน์/พหูพจน์คู่กันโดยไม่มีชื่อที่บอกหน้าที่ชัดเจน
- ห้ามสร้าง abstraction เผื่ออนาคต หากยังมีผู้ใช้เพียงจุดเดียวและไม่ได้ลดความซับซ้อนจริง
- ห้ามย้าย business flow ออกจาก method จนต้องกระโดดหลายไฟล์เพื่อเข้าใจงานหนึ่งเรื่อง
- ห้ามสร้าง type/interface กลาง หากใช้เฉพาะ method เดียวและ TypeScript infer ได้ชัดเจน
- ห้ามเพิ่ม dependency ใหม่ หาก standard library หรือ utility เดิมทำได้อยู่แล้ว
- ห้ามลบหรือรวมไฟล์ชื่อคล้ายกันก่อนตรวจ caller และ responsibility ทั้งหมด

## Checklist ก่อนจบงาน

- ค้นแล้วว่าไม่มี utility/service/component เดิมที่ทำงานเดียวกัน
- ใช้หรือขยายของเดิมทุกจุดที่เหมาะสมแล้ว
- ไม่มี implementation เดียวกันถูก copy หลายไฟล์
- ชื่อไฟล์และ class บอก responsibility ชัด ไม่พึ่งแค่เอกพจน์/พหูพจน์
- ไม่มี import path หรือชื่อ class เก่าหลงเหลือหลัง rename
- Service ยังอ่าน business method เดียวจบ และ utility มีเฉพาะ logic ที่ใช้ร่วมกันจริง

