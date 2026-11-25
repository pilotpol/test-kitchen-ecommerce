---
description: กติกาของโค้ดแอปใน apps/ บน Prompt Serve Framework (AI ผ่าน Gateway, BFF, ข้อความภาษาไทย, PDPA)
paths:
  - apps/**
---

# โค้ดของแอป

- แก้โค้ดได้เฉพาะใน `apps/<slug>/` ห้ามแก้ `packages/` และไฟล์ที่ Playground ป้องกันไว้
- AI ทุกครั้งผ่าน AI Gateway ด้วย SDK ฝั่งเซิร์ฟเวอร์ (BFF) เท่านั้น กุญแจและ token ห้ามถึงเบราว์เซอร์และห้ามอยู่ในโค้ด
- ผู้ใช้ ฐานข้อมูล คลังความรู้ และ Workflow ใช้บริการของแพลตฟอร์ม ไม่สร้างของซ้ำ
- คำตอบที่อ้างความรู้ขององค์กรมาจาก Knowledge Base ของแพลตฟอร์มและแสดงที่มา
- ข้อความที่ผู้ใช้เห็นเป็นภาษาไทยทางการ ทุกหน้ามีสถานะ loading, empty และ error
- ข้อมูลส่วนบุคคลเก็บเท่าที่จำเป็นตาม PDPA
- ก่อนจบรอบงานรัน `pnpm lint` และ `pnpm check-types` ให้ผ่าน
- ไฟล์ทดสอบ (`*.test.ts`, `*.test.tsx`) ถูกตรวจชนิดด้วย `tsc --noEmit` เหมือนโค้ดแอป และ error ในไฟล์ทดสอบขวางการส่งแอปขึ้น Playground เขียนให้ชนิดถูกตั้งแต่แรก: ค่าที่ส่งให้ `getByText`, `getByRole`, `getByLabelText` ต้องเป็น `string` ไม่ใช่ `string | undefined` (ตรวจค่าก่อนหรือใช้ค่าคงที่), ใช้ matcher ของ `@testing-library/jest-dom` ผ่านการ import ที่มีชนิดข้อมูล, ไม่ใช้ `any` เพื่อหลบ error และรัน `pnpm check-types` หลังเขียนหรือแก้ไฟล์ทดสอบทุกครั้งก่อนจบรอบ
