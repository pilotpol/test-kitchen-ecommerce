# test-app-

Application ภายใต้ Prompt Serve Framework ใช้งานใน AI Workspace สร้างและดูแลด้วย AI Kitchen

| ส่วน | ที่อยู่ |
|---|---|
| แอปของโครงการ (Next.js) | `apps/<slug>/` แก้โค้ดได้เฉพาะที่นี่ |
| ชุดกลางของแพลตฟอร์ม | `packages/` ห้ามแก้ |
| เอกสาร, ADR และ runbook | `docs/` |
| ชุดประเมินคำตอบ AI | `evals/` |
| guardrail ของ agent และการตรวจ | `.claude/`, `ci/`, `.pre-commit-config.yaml`, `.github/workflows/ci.yml` |

## คำสั่ง

```bash
pnpm install            # ติดตั้ง dependency ของ monorepo
pnpm dev                # รันแอปบนเครื่อง
pnpm lint               # ตรวจรูปแบบโค้ด
pnpm check-types        # ตรวจชนิดข้อมูล
pnpm format             # จัดรูปแบบโค้ดด้วย prettier
bash .claude/hooks/tests/test_guardrails.sh   # ทดสอบ guardrail ของ agent
python3 ci/secret_scan.py --tree              # สแกนค่าลับทั้ง repository
```

ติดตั้งการตรวจก่อน commit ครั้งเดียวต่อเครื่อง: `pip install pre-commit && pre-commit install`

## กติกาที่ agent ใช้

- `CLAUDE.md`, `AGENTS.md` และ `GEMINI.md` สร้างโดย AI Kitchen ทุกรอบงาน ไม่ต้องแก้เอง
- `.claude/rules/` กติกาเฉพาะโฟลเดอร์, `.claude/commands/` คำสั่งที่ทีมเรียกใช้เป็นประจำ, `.claude/agents/` ผู้ช่วยเฉพาะงาน
- `.claude/settings.json` ผูก hook ปิดกั้น push เข้า branch ที่ป้องกันไว้และค่าลับใน commit และ hook ตรวจไฟล์ที่ agent เพิ่งแก้
