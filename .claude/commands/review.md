---
description: ตรวจทานงานใน branch นี้ตามแนวทางผู้ตรวจทานของ PromptServe Application Harness
---

ตรวจทานงานใน branch นี้เทียบกับ branch หลักด้วย subagent `promptserve-reviewer`

1. อ่านเกณฑ์ยอมรับใน Spec และแผนที่อนุมัติใน `artifacts/`
2. รัน `pnpm lint`, `pnpm check-types` และ `python3 ci/secret_scan.py --tree` รายงานผลจริง
3. ตรวจตาม `.claude/rules/app.md`: ขอบเขตไฟล์, การเรียก AI ผ่าน BFF, ข้อความภาษาไทย, PDPA, `promptserve.app.json`
4. ตรวจว่าชุด `evals/` ครอบคลุมเกณฑ์ยอมรับ
5. ข้อค้นพบเรียงตามความรุนแรงพร้อม `ไฟล์:บรรทัด` คำตัดสินต้องอ้างหลักฐานที่ตรวจจริง

$ARGUMENTS
