### แนวทางนักพัฒนาใน PromptServe Application Harness
- แก้โค้ดเฉพาะใน `apps/<slug>/` ห้ามแก้ `packages/` และไฟล์ป้องกันของ Playground
- โครงสร้างมาตรฐาน: หน้าเว็บ Next.js ใน `apps/<slug>/app`, backend Go + Gin ใน `apps/<slug>/backend` (route ใหม่เพิ่มใน `internal/httpapi`, ตารางใน `internal/store.Migrate`), เบราว์เซอร์เรียก backend ผ่าน `/api/backend/<path>` เท่านั้น
- ข้อมูลของผู้ใช้ทุกแถวมีคอลัมน์ผู้ใช้ (`owner`) จาก `X-PS-User` และทุก query กรองด้วยค่านี้ เขียน test ของ handler ด้วย `httptest` และรัน `go test ./...` ให้ผ่าน
- Agent ของแอป: เขียน `agent.instructions` ใน `promptserve.app.json` ให้ตรงกับงาน และใส่เอกสารความรู้ที่ Agent ต้องใช้ใน `knowledge/` แพลตฟอร์มสร้าง Agent และคลังความรู้ให้เองตอนส่งแอปขึ้น
- เรียก AI, Agent, Workflow และคลังความรู้ผ่าน `@repo/ai-gateway-sdk` ใน BFF route ฝั่งเซิร์ฟเวอร์เท่านั้น
- ขั้นตอนประเภท rule หรือ move เขียนเป็นโค้ดปกติ ไม่ส่งให้โมเดล
- ทุกการเรียก AI มี timeout, ข้อความเมื่อบริการไม่พร้อม และไม่ทำให้หน้าจอค้าง
- เพิ่มกรณีประเมินลง `evals/` เมื่อเพิ่มพฤติกรรม AI ใหม่ (input, พฤติกรรมที่คาดหวัง, เกณฑ์ตัดสิน)
- บันทึกการตัดสินใจที่กระทบโครงสร้างเป็น ADR ใน `docs/adr/`

Checklist ก่อนสรุป: test ที่เกี่ยวข้องรันผ่านจริง, lint ผ่าน, `pnpm check-types` ผ่านรวมถึงไฟล์ `*.test.tsx` (ค่าที่ส่งให้ `getByText` ต้องเป็น `string`), ไม่มีค่าลับใน source, ข้อความภาษาไทยทางการ ไม่มี em-dash, สถานะ loading, empty และ error ครบ

ข้อผิดพลาดที่ต้องเลี่ยง: ส่ง token ไปเบราว์เซอร์, เขียน prompt ที่ควรอยู่ใน Agent บนแพลตฟอร์มลงในโค้ดของแอป, เพิ่ม dependency ที่แพลตฟอร์มมีให้แล้ว
- ถ้าโครงการเลือก BFF แยก (`artifacts/dev/stack-options.json` มี `"bff": true`) ระบบสร้าง `apps/<slug>/bff` เป็น submodule (Node, Hono) ให้ตอนเริ่ม Build หน้าเว็บเรียก BFF นี้ และ BFF เรียก backend Go ที่ `BE_API_URL` เขียนโค้ดและ test ของ BFF ใน `apps/<slug>/bff` เท่านั้น ถ้าไม่ได้เลือก BFF อยู่ใน Next.js แอปเดียวกัน
