# Seed, Permission And Menu Rules

อ่านไฟล์นี้เมื่องานเกี่ยวกับ seed, permission, role, menu, sidebar หรือ API route requirement

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

