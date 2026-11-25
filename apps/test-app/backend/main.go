// Backend ของ test-app-: Go + Gin ตามมาตรฐานของ PromptServe harness
//
// ทำงานใน container เดียวกับหน้าเว็บ Next.js และฟังเฉพาะ 127.0.0.1 (BACKEND_ADDR)
// เบราว์เซอร์เรียกผ่าน /api/backend/* ของ Next.js เท่านั้น ซึ่งตรวจ session ก่อน
// แล้วส่งชื่อผู้ใช้และบทบาทมาใน header X-PS-User และ X-PS-Roles
// ฐานข้อมูลคือ PostgreSQL ของแอปที่แพลตฟอร์มสร้างให้ (DATABASE_URL)
package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"app/backend/internal/httpapi"
	"app/backend/internal/store"
)

const (
	defaultAddr     = "127.0.0.1:8081"
	shutdownTimeout = 10 * time.Second
)

func main() {
	addr := os.Getenv("BACKEND_ADDR")
	if addr == "" {
		addr = defaultAddr
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	db, err := store.Open(ctx, os.Getenv("DATABASE_URL"))
	if err != nil {
		log.Fatalf("database: %v", err)
	}
	defer db.Close()
	if err := store.Migrate(ctx, db); err != nil {
		log.Fatalf("migrate: %v", err)
	}

	server := &http.Server{Addr: addr, Handler: httpapi.Router(db), ReadHeaderTimeout: 10 * time.Second}
	go func() {
		log.Printf("backend listening on %s", addr)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen: %v", err)
		}
	}()
	<-ctx.Done()
	shutdown, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
	defer cancel()
	_ = server.Shutdown(shutdown)
}
