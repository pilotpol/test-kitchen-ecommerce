# ประวัติรุ่น

## 4.1.1

- โครงตั้งต้นมี formatter (`.prettierrc.json`) และ CI รันชุดทดสอบของแอป (`pnpm test --if-present`) เพิ่มจากเดิมที่รันแค่ lint และ check-types คะแนน Harness Score ของ harness นี้ขึ้นจาก 98 เป็น 105 จาก 105 (scaffold 1.1.4)

## 4.1.0

- ส่งงานระหว่างขั้นผ่าน Git เท่านั้น: นักวิเคราะห์ระบบส่งงานให้นักพัฒนา นักพัฒนารับงานแล้วจึงใช้ Autopilot ของขั้น Build ได้ และส่งงานให้ DevOps เอง ไม่มีการส่งต่อบนเครื่องเดียวโดยไม่ผ่าน Git อีก (workflow 3.1.0)
- Autopilot ของขั้น Build ไม่นำแอปขึ้นเอง และรอให้ Tech Stack ได้รับการยืนยันจากคนก่อน ขั้น Deploy เป็นของ DevOps ซึ่งรับงานจากนักพัฒนาก่อน แล้ว Autopilot ของขั้นนี้นำขึ้น AI Workspace ได้ (knowledge 1.3.1)

## 4.0.0

- สามขั้น: Requirement gathering, Build (เดิม Code and Deploy ที่ไม่มีแถบย่อย Code และ Deploy แล้ว) และ Deploy ที่มีปุ่ม Deploy to AI Workspace ปุ่มกดได้เมื่อ backlog ที่เกี่ยวกับหน้าเว็บและโครงสร้างที่จำเป็นครบ ถ้ายังไม่ครบใช้ Local Run ได้อย่างเดียว ระบบยังนำขึ้นเองเมื่อทุกรายการรวมแล้ว (workflow 3.0.0)
- ผู้ตรวจอิสระกลับมาเป็นด่านสุดท้ายของ Requirement gathering ก่อนสร้าง backlog (knowledge 1.3.0)
- โครงการมี git repo หลัก (parent) ตั้งแต่เริ่ม Requirement gathering เก็บ docs และ artifacts เริ่มต้นบนเครื่องนี้ แล้วค่อยเชื่อม Git server ทีหลัง ถ้าเลือก Tech Stack แยก BFF ระบบสร้าง `apps/<slug>/bff` เป็น submodule อีกตัวตอนเริ่ม Build path เดิมของหน้าเว็บและ backend ไม่เปลี่ยน
- โครงการเดิม (harness 3.x) ปรับเป็นรุ่นนี้เองเมื่อเปิดด้วย AI Kitchen 3.2.8

## 3.1.1

- นักพัฒนาต้องเขียนไฟล์ทดสอบ `*.test.tsx` ให้ผ่าน `tsc --noEmit` ตั้งแต่แรก (เช่น ค่าที่ส่งให้ `getByText` ต้องเป็น `string`) และรัน `pnpm check-types` ทุกครั้งหลังแก้ไฟล์ทดสอบ เพราะ error ในไฟล์ทดสอบขวางการส่งแอปขึ้น Playground (roles 2.1.1, scaffold 1.1.3)

## 3.1.0

- ขั้น Requirement gathering ไม่มีผู้ตรวจอิสระแล้ว เส้นทางไป backlog คือ ข้อมูลนำเข้า, Intent, Spec, Plan และ Design แท็บผู้ตรวจอิสระถูกถอดออก ไม่มีการตรวจเอกสารอัตโนมัติหลังได้ backlog และไม่มีคำเตือนผลตรวจก่อนสร้าง backlog (workspace 2.1.0, knowledge 1.2.2) ไม่กระทบ Code and Deploy และการนำขึ้น AI Workspace

## 3.0.1

- เปลี่ยนชื่อแอปในถ้อยคำจาก Prompt Serve Coder เป็น AI Kitchen ไม่มีการเปลี่ยนขั้นตอน บทบาท หรือโครงสร้าง repository

## 3.0.0

- เหลือสองขั้น: Requirement gathering (ทำคนเดียว ไม่มีการอนุมัติ ไม่ใช้ Git ยกเว้นส่งงานต่อ) และ Code and Deploy (พัฒนาตาม backlog อัตโนมัติ แล้ว Go live ใน AI Workspace) `workflow.json` ระบุ `mode: auto`
- ขั้นทดสอบและขั้นอนุมัติ Deployment รวมเข้าขั้น Code and Deploy โครงการเดิมของ harness นี้ปรับเป็นรุ่นนี้เองเมื่อเปิดด้วย Prompt Serve Coder 2.38.0

## 2.1.1

- hook ของ Claude Code (`pre_bash_guard.py`, `post_edit_check.py`) หาไฟล์ของตนเองโดยไล่ขึ้นจากโฟลเดอร์ปัจจุบันจนพบ `.claude/hooks/` แทน `git rev-parse --show-toplevel` เดิมเมื่อ agent `cd` เข้า submodule (เช่น `backend/`) hook ชี้ไปที่ไฟล์ที่ไม่มีอยู่ แล้วคำสั่ง Bash ทุกคำสั่งถูกบล็อก รวมถึง `cd` ที่จะออกมา

## 2.1.0

- แยกหน้าเว็บเป็น submodule ที่ `apps/<slug>/` และ backend เป็น submodule ซ้อนที่ `backend/` แต่ละตัวมี repo บน Git server path เดิมทั้งหมด จึงไม่กระทบ Local Run และ Go live โครงการที่เริ่มงานพัฒนาแล้วคงโครงเดิม

## 1.0.0

รุ่นตั้งต้นของ harness นี้เมื่อเริ่มแยกรุ่น เนื้อหาเหมือน Prompt Serve Coder 2.9

## 2.0.0

แยก Tech Lead กับ DevOps เป็นคนละบทบาท Tech Lead ตรวจทานและอนุมัติ DevOps เตรียมและดำเนินการนำขึ้นระบบ
