# Frontend Rules

อ่านไฟล์นี้เมื่องานเกี่ยวกับ frontend, UI, modal, tab, filter, pagination, state หรือ API hook

## API และ State

- ใช้ `useApi` สำหรับเรียก API ปกติ
- Hook หรือ effect ที่เรียก API ผ่าน `useApi()` ต้องระวัง function identity ของ `get/post/put/patch/del` เพราะอาจเปลี่ยนทุก render ถ้า effect ควรยิงตาม query/filter/page เท่านั้น ให้เก็บ API function ไว้ใน `useRef` หรือจัด dependency ให้ผูกกับ state จริง ไม่ผูกกับ function จาก `useApi` เพื่อป้องกัน fetch -> setState -> render -> fetch ซ้ำวนลูป
- API ที่เป็น upload ให้ใช้ `FormData` และ `multipart/form-data`
- ใช้ context เมื่อข้อมูลต้องใช้หลายจุด เช่น session, menu, appearance, system identity
- ไม่ใช้ localStorage สำหรับ auth, menu, permission หรือข้อมูลระบบที่ควรมาจาก backend
- localStorage ใช้ได้เฉพาะ preference ฝั่ง user เช่น theme mode, font, language, view mode

## URL State

- Modal หรือ panel ที่เป็น state สำคัญของหน้า ต้องผูกกับ URL query param เช่น `?modal=edit&id=1`, `?panel=appearance`, `?submodal=reset-password`
- ห้ามใช้ `useState` อย่างเดียวในการเปิด/ปิด modal หลักของหน้า เพราะ refresh แล้วสถานะจะหาย
- การเปิด modal ให้ใช้ `useSearchParams()` จาก `react-router-dom` และปิด modal ด้วยการลบ query param ที่เกี่ยวข้อง
- Modal ที่ต้องรู้ target record ให้เก็บ `id` หรือ key ใน URL แล้ว sync target จากข้อมูลจริงของหน้า
- Sub-modal ซ้อน modal ใช้ param แยก เช่น `submodal` เพื่อไม่ชนกับ modal หลัก
- Tab, pagination (`?page=`), และ filter ที่เป็น state สำคัญของหน้า (search, status, date range ฯลฯ) ต้องผูกกับ URL query param ด้วย `useSearchParams()` เช่นกัน ห้ามเก็บไว้ใน `useState` อย่างเดียว เพราะ refresh แล้วค่าจะหาย/รีเซ็ตกลับค่าเริ่มต้น
- อ่านค่าเริ่มต้นจาก URL ด้วย lazy initializer ของ `useState(() => ...)` และเขียนกลับ URL ผ่านฟังก์ชันกลาง เช่น `changeTab`/`changePage` ที่ทั้ง set state และ set/delete query param พร้อมกัน
- Effect ที่ใช้ reset page เมื่อ filter เปลี่ยน ห้ามใช้ ref flag แบบ `isFirstRender = useRef(true)` เพราะ React Strict Mode รัน effect ซ้ำตอน mount ทำให้ flag ถูกพลิกเป็น `false` ก่อนเวลาและยิง reset ทับค่าที่ restore มาจาก URL ให้เทียบค่าฟิลเตอร์ก่อนหน้ากับปัจจุบันผ่าน ref แทน (`prevFiltersRef`)
- State ชั่วคราวที่ไม่ควร restore หลัง refresh เช่น password ที่กรอกอยู่ หรือ token ที่แสดงได้ครั้งเดียว ไม่ต้องเก็บใน URL
- Dropdown ธรรมดา เช่น user dropdown, select menu, tooltip ไม่จำเป็นต้อง persist ด้วย URL ยกเว้นเป็น panel สำคัญของ workflow

## Tables

- ตารางข้อมูลที่มี pagination/filter ควรให้หัวตารางของ field สำคัญกดจัดเรียงได้ โดยใช้ `SortableTableHeader` และเก็บ `sortBy`/`sortOrder` ใน URL query param
- ถ้าตารางดึงข้อมูลแบบ backend pagination ต้องส่ง `sortBy`/`sortOrder` ไป API และ backend ต้อง whitelist field ที่ sort ได้ก่อนแปลงเป็น `orderBy`
- เลือกเฉพาะ column ที่ช่วยอ่านข้อมูลจริง เช่น เวลา, status, user, resource, duration; ไม่จำเป็นต้อง sort column ข้อความยาว, metadata, action button หรือเลขลำดับหน้า
- เมื่อเปลี่ยน sort ให้ลบ `page` เพื่อกลับหน้าแรก และคง filter อื่นใน URL ไว้
- ใช้ utility เดิม เช่น `frontend/src/utils/sortParams.ts` และ common header เดิมก่อนสร้าง logic ใหม่ซ้ำในแต่ละหน้า

## UI และ Common Components

- ใช้ theme, color, font, spacing และ component style ตามโปรเจกต์ปัจจุบัน
- ห้ามสร้าง UI คนละแนวกับระบบเดิมโดยไม่จำเป็น
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

## Date & Time Formatting

- ทุกการแสดงวันที่/เวลาใน frontend ต้องใช้ `useRegional()` จาก `@/contexts/RegionalContext`
- ใช้ `formatDate`, `formatDateTime`, หรือ `formatTime` จาก hook แทนการ hardcode locale หรือ `toLocaleString`
- ห้าม hardcode `'th-TH'` หรือ `toLocaleString('th-TH')`
