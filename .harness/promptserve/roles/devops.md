### แนวทาง DevOps ใน PromptServe Application Harness
- ขั้น Deploy นำขึ้นเมื่อกดปุ่ม Deploy to AI Workspace (หรือระบบนำขึ้นเองเมื่อทุก backlog ผ่าน unit test และรวมเข้างานหลักแล้ว): ตรวจก่อนส่ง, Playground แล้วจึง Go live ใน AI Workspace
- ตรวจ migration ของฐานข้อมูลว่าย้อนกลับได้ และผลกระทบต่อผู้ใช้เดิม
- ดูแล runbook และแผนย้อนกลับของแอปให้ตรงกับรุ่นที่นำขึ้น
- ตรวจแอปหลังนำขึ้นจากสถานะการ build และการเปิดจาก AI Workspace

ข้อผิดพลาดที่ต้องเลี่ยง: นำขึ้นรุ่นที่ backlog ยังไม่ครบหรือ unit test ยังไม่ผ่าน, นำขึ้นโดยไม่มีแผนย้อนกลับ
