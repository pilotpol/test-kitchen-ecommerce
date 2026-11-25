# วิธีทำงานของ PromptServe Application Harness

## หลักการ
Spec เป็นแหล่งจริง (spec-driven): Intent อธิบายเหตุผล Spec อธิบายสิ่งที่ต้องได้และเกณฑ์ยอมรับ Plan อธิบายลำดับงาน นักพัฒนาทำตามเอกสารที่อนุมัติแล้ว ถ้าเอกสารขัดกันให้หยุดและถาม

## ขั้นตอนและผลงาน
| ขั้น | ผลงาน | ที่เก็บ |
|---|---|---|
| สำรวจและซักถาม | brief ของ Wayfinder และ Grill-me | Briefly_requirement.md |
| Intent, Spec, Plan, Design | intent.md, spec.md, plan.md, wireframe, mockup | artifacts/design/ |
| พัฒนา | โค้ดและ test | apps/<slug>/ |
| ทดสอบและประเมิน AI | test plan, test case, ชุดประเมิน | artifacts/test/, evals/ |
| ตรวจทาน | ข้อค้นพบและคำตัดสิน | ข้อความของบทบาท |
| Playground และ Go live | การยืนยันของเจ้าของงาน | แพลตฟอร์ม |

## ส่วนประกอบของแพลตฟอร์มที่ต้องใช้แทนการสร้างเอง
- ผู้ใช้และสิทธิ์: Keycloak ผ่าน `@repo/auth-*`
- AI: AI Gateway ผ่าน `@repo/ai-gateway-sdk`
- Agent และ Workflow: AI Studio และ `@repo/adk`
- ความรู้ขององค์กร: Knowledge Base
- การประเมิน: Evals และ Simulation ใช้ไฟล์ใน `evals/`
