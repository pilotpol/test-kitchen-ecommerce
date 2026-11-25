---
description: ตรวจความพร้อมก่อน Go live จาก Playground ของ PromptServe
---

ตรวจความพร้อมก่อน Go live แล้วรายงานเป็นรายการ ผ่าน หรือ ยังขาด

- ไม่มีข้อค้นพบระดับ Critical หรือ High ที่ยังเปิดอยู่
- `pnpm lint`, `pnpm check-types` และ CI ของ branch หลักผ่าน
- ชุด `evals/` รันจริงบน Evals ของ PromptServe และผ่านเกณฑ์ที่ Spec กำหนด
- `promptserve.app.json` ระบุ Agent, บทบาทที่เปิดแอปได้ และสภาพแวดล้อมถูกต้อง
- migration ของฐานข้อมูลย้อนกลับได้ และ `docs/runbook.md` อัปเดตแล้ว
- เจ้าของงานยืนยันบน Playground แล้ว agent ห้ามกด Go live เอง

$ARGUMENTS
