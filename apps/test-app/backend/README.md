# Backend ของ test-app- (Go + Gin)

- รันใน container เดียวกับหน้าเว็บ ฟังที่ `BACKEND_ADDR` (ค่าเริ่มต้น `127.0.0.1:8081`)
- เบราว์เซอร์เรียกผ่าน `/api/backend/<path>` ของ Next.js ซึ่งส่งต่อมาที่ `/api/<path>` ของ backend พร้อม `X-PS-User`
- ฐานข้อมูล: `DATABASE_URL` (PostgreSQL ของแอป) สร้างตารางใน `internal/store.Migrate` แบบรันซ้ำได้
- ทดสอบ: `go test ./...` ในโฟลเดอร์นี้
- รันในเครื่อง: `DATABASE_URL=postgres://... go run .`
