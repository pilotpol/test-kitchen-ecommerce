โครงการ test-app- เป็น Application ภายใต้ Prompt Serve Framework ใช้งานใน AI Workspace ทุกส่วนของระบบ (ผู้ใช้ ฐานข้อมูล AI คลังความรู้ Workflow) ใช้บริการของแพลตฟอร์ม ไม่สร้างของซ้ำ

### Tech stack มาตรฐาน (ไม่ต้องถามผู้ใช้ ใช้ทันที)
ผู้ใช้บอกเฉพาะความต้องการทางธุรกิจ ส่วน stack ต่อไปนี้ตายตัวสำหรับทุกแอปของ harness นี้ ห้ามเปลี่ยนหรือถามซ้ำ
| ชั้น | สิ่งที่ใช้ | ที่อยู่ในโครงการ |
|---|---|---|
| หน้าเว็บ (FE) | Next.js (App Router) + TypeScript + Tailwind ใน pnpm monorepo | `apps/<slug>/app`, `apps/<slug>/components` |
| Backend (BE) | Go + Gin รันใน container เดียวกับหน้าเว็บ ฟังเฉพาะ 127.0.0.1 | `apps/<slug>/backend` |
| ฐานข้อมูล | PostgreSQL ของแอปที่แพลตฟอร์มสร้างให้ (`DATABASE_URL`, schema ของแอป) | ตารางสร้างใน `backend/internal/store.Migrate` |
| AI | Agent ของแอปบน PromptServe เรียกผ่าน AI Gateway SDK ใน route ฝั่งเซิร์ฟเวอร์ (`/api/chat`) | `promptserve.app.json` ส่วน `agent` |
| คลังความรู้ | KB ของแอปที่แพลตฟอร์มสร้างและผูกกับ Agent ให้เองตอนส่งแอปขึ้น | เอกสาร `.md`, `.txt`, `.csv`, `.json` ใน `apps/<slug>/knowledge/` |
| ผู้ใช้และสิทธิ์ | Keycloak ของแพลตฟอร์ม (session cookie) | `access` ใน `promptserve.app.json` |

กติกาของ stack
- เบราว์เซอร์เรียก backend ผ่าน `/api/backend/<path>` เท่านั้น route นี้ตรวจ session แล้วส่ง `X-PS-User` และ `X-PS-Roles` ให้ backend ห้ามแก้หรือลบ `app/api/backend/[...path]/route.ts`
- ตรรกะธุรกิจและการอ่านเขียนข้อมูลอยู่ใน backend Go ทุก query กรองด้วยผู้ใช้จาก `X-PS-User` และใช้ parameter เสมอ
- Agent ของแอปถูกสร้างอัตโนมัติจาก `agent.instructions` ใน `promptserve.app.json` เขียนคำสั่งของ Agent ที่นั่น ไม่ฝัง prompt ในโค้ด เมื่อ Agent ต้องใช้ข้อมูลของผู้ใช้ ให้ route `/api/chat` ดึงข้อมูลสรุปจาก backend แล้วแนบในข้อความที่ส่ง
- ความรู้ทั่วไปที่ Agent ต้องใช้ (คำอธิบายหมวดหมู่ วิธีใช้งาน นโยบาย) เขียนเป็นเอกสารใน `knowledge/` แพลตฟอร์มสร้างคลังความรู้ `app-<slug>` นำเข้า และผูกกับ Agent ให้เองทุกครั้งที่ส่งแอปขึ้น
- กราฟใช้ส่วนประกอบ SVG ที่เขียนเองหรือ library ที่ไม่ต้องมี key ภายนอก ข้อมูลกราฟมาจาก backend

### ขั้นตอนและประตูผ่าน (สามขั้น ไม่มีการอนุมัติ)
1. Requirement gathering: ผู้รับผิดชอบโครงการคนเดียวทำได้ครบ ซักถามไม่เกิน 3 รอบต่อแท็บ สิ่งที่ยังไม่ชัดเขียนเป็นสมมติฐาน ประตูผ่านคือ Intent, Spec, Plan และ Design ครบ ผู้ตรวจอิสระตรวจเอกสารเป็นด่านสุดท้าย แล้วมี backlog อย่างน้อยหนึ่งรายการ จากนั้นนักวิเคราะห์ระบบส่งงานให้นักพัฒนาผ่าน Git เท่านั้น (ไม่มีการส่งต่อบนเครื่องเดียวโดยไม่ผ่าน Git) โครงการมี git repo หลัก (parent) ตั้งแต่เริ่มขั้นนี้ เก็บ docs และ artifacts
2. Build: นักพัฒนารับงานจากนักวิเคราะห์ระบบผ่าน Git แล้วยืนยัน Tech Stack จากนั้นเริ่ม backlog ทีละรายการตามลำดับบนบอร์ด รายการต้องผ่าน unit test ทั้ง FE และ BE และผ่านการตรวจคุณภาพโค้ดจึงรวมเข้างานหลัก ถ้า Tech Stack แยก BFF หรือ Backend ระบบแยกเป็น repo ย่อย (submodule) ตอนเริ่มขั้นนี้ Autopilot ของขั้นนี้ไม่นำแอปขึ้น การส่งงานให้ DevOps เป็นการตัดสินใจของคน
3. Deploy: DevOps รับงานจากนักพัฒนาผ่าน Git ก่อน แล้วปุ่ม Deploy to AI Workspace กดได้เมื่อ backlog ที่เกี่ยวกับหน้าเว็บและโครงสร้างที่จำเป็นครบแล้ว ระบบตรวจก่อนส่ง นำขึ้น Playground แล้ว Go live ใน AI Workspace ถ้ายังไม่พร้อมใช้ Local Run ได้อย่างเดียว Autopilot ของขั้น Deploy นำขึ้นเองได้หลัง DevOps รับงานแล้ว

### แผนผัง repo
- `apps/<slug>/` แอปของโครงการ (Next.js หน้าเว็บ, `backend/` Go + Gin, `knowledge/` เอกสารของคลังความรู้) แก้โค้ดได้เฉพาะที่นี่
- `packages/` ชุดกลางของแพลตฟอร์ม (`@repo/ai-gateway-sdk`, `@repo/adk`, `@repo/auth-*`, UI) ห้ามแก้
- `docs/` เอกสารประกอบ, `docs/adr/` บันทึกการตัดสินใจ, `docs/runbook.md` วิธีดูแลระบบ
- `evals/` ชุดประเมินคำตอบ AI สำหรับ Evals และ Simulation ของ PromptServe
- `artifacts/` เอกสารของทีม (Intent, Spec, Plan, wireframe, test) ที่ AI Kitchen จัดการ
`apps/<slug>/` เป็น git submodule (repo หน้าเว็บ) และ `apps/<slug>/backend/` เป็น git submodule ซ้อนใน repo หน้าเว็บ (repo backend) ระบบแยกให้ตอนเริ่มงานพัฒนา แพลตฟอร์มยังเป็นผู้ build, deploy และใส่ค่า env ให้ โครงการนี้จึงไม่มีโฟลเดอร์ `deployment/`

### หลักออกแบบ AI บนแพลตฟอร์ม
- แยกขั้นตอนของงานเป็น move, rule, decide, extract, generate และ human งานตายตัวใช้โค้ดหรือ Workflow จุดตัดสินใจที่ตอบเป็นตัวเลือกใช้ System One งานอ่านเอกสารและเรียบเรียงข้อความใช้ System Two รายการที่ความมั่นใจต่ำส่งเข้าคิวเจ้าหน้าที่
- AI ทุกครั้งผ่าน AI Gateway ด้วย SDK ฝั่งเซิร์ฟเวอร์ (BFF) เท่านั้น กุญแจไม่ถึงเบราว์เซอร์
- คำตอบที่อ้างความรู้ขององค์กรต้องมาจาก Knowledge Base ของแพลตฟอร์ม และแสดงที่มา
- ข้อมูลส่วนบุคคลถือตาม PDPA เก็บเท่าที่จำเป็น

### Definition of Done
เกณฑ์ยอมรับทุกข้อมี test หรือกรณีประเมินที่รันจริง, ข้อความที่ผู้ใช้เห็นเป็นภาษาไทยทางการ มีสถานะ loading, empty และ error, ไม่มีค่าลับในโค้ด, ชุด `evals/` มีกรณีปกติ กรณีขอบ และกรณีที่ต้องปฏิเสธ, runbook อัปเดตแล้ว

### ชุดตรวจและคำสั่งของทีม
`pnpm lint`, `pnpm check-types` และ `go test ./...` ใน `apps/<slug>/backend` ต้องผ่านก่อนจบรอบ กติกาตามโฟลเดอร์อยู่ใน `.claude/rules/` คำสั่งของทีมคือ `/review`, `/evals` และ `/golive-check` (subagent `promptserve-reviewer` และ `promptserve-eval-designer`) hook ตรวจไฟล์ที่แก้ทุกครั้ง ข้อความจาก `post_edit_check` ต้องแก้ในรอบนั้น

### กติกาการคิดของ agent
- ไม่แน่ใจให้ถาม อย่าตั้งสมมติฐานแล้วทำต่อเงียบ ๆ สมมติฐานที่จำเป็นต้องเขียนไว้ให้ผู้ใช้ยืนยัน
- ค้น Knowledge Base `harness-promptserve-app` และคลังของโดเมนก่อนตัดสินใจ และอ้างชื่อเอกสาร
- เปลี่ยนให้น้อยที่สุดที่ทำให้เกณฑ์ยอมรับผ่าน ไม่ขยายขอบเขตเอง
- รายงานเฉพาะสิ่งที่ตรวจหรือรันจริง แยกจากสิ่งที่เป็นแผน
