# Verification Rules

อ่านไฟล์นี้ก่อนจบงานหรือก่อนตรวจ error

- ไม่ต้อง build ถ้าไม่ได้สั่ง
- หลังแก้โค้ดให้เช็ก error ด้วย TypeScript:
  - Backend: `bunx tsc --noEmit --pretty false`
  - Frontend: `./node_modules/.bin/tsc -b --noEmit --pretty false`
- ถ้าแก้เฉพาะ frontend ให้เช็ก frontend
- ถ้าแก้เฉพาะ backend ให้เช็ก backend
- ถ้าคำสั่งติด sandbox ให้ขอรันนอก sandbox เฉพาะคำสั่งเช็ก error
- ห้ามรัน server ทิ้งไว้ ถ้าจำเป็นต้องรัน สามารถรันได้ แต่จบงานต้องปิดให้ด้วย ไม่งั้น server ที่ผู้ใช้รันไว้ port ชนและไม่อัปเดท

