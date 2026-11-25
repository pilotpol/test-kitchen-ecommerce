// Package store คือการเข้าถึง PostgreSQL ของแอป
//
// แพลตฟอร์มให้ login และ schema ของแอปนี้เอง (search_path เป็น schema ของแอป)
// สร้างตารางแบบ CREATE TABLE IF NOT EXISTS ใน Migrate ห้ามใส่รหัสผ่านในโค้ด
package store

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5/pgxpool"
)

// maxConns เล็กโดยตั้งใจ: login ของแอปเปิดได้ 10 connection และหน้าเว็บใช้ร่วมด้วย
const maxConns = 4

// Open เปิด pool จาก DATABASE_URL
func Open(ctx context.Context, url string) (*pgxpool.Pool, error) {
	if url == "" {
		return nil, errors.New("DATABASE_URL is not set: the platform sets it when the app is deployed")
	}
	config, err := pgxpool.ParseConfig(url)
	if err != nil {
		return nil, err
	}
	config.MaxConns = maxConns
	return pgxpool.NewWithConfig(ctx, config)
}

// Migrate สร้างตารางของแอป ทุกคำสั่งต้องรันซ้ำได้
func Migrate(ctx context.Context, db *pgxpool.Pool) error {
	_, err := db.Exec(ctx, `CREATE TABLE IF NOT EXISTS app_meta (
		key   TEXT PRIMARY KEY,
		value TEXT NOT NULL
	)`)
	return err
}
