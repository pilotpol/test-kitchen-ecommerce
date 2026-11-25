// Package httpapi คือ HTTP API ของ backend (Gin)
//
// ทุก route ใต้ /api ต้องผ่าน requireUser: Next.js ส่งชื่อผู้ใช้ที่ตรวจ session แล้ว
// มาใน X-PS-User ข้อมูลของผู้ใช้แต่ละคนต้องกรองด้วยชื่อนี้เสมอ
package httpapi

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	userHeader  = "X-PS-User"
	rolesHeader = "X-PS-Roles"
	userKey     = "ps-user"
)

// Router สร้าง Gin engine ของแอป
func Router(db *pgxpool.Pool) *gin.Engine {
	gin.SetMode(gin.ReleaseMode)
	router := gin.New()
	router.Use(gin.Recovery())
	router.GET("/healthz", func(c *gin.Context) {
		if err := db.Ping(c.Request.Context()); err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"status": "database unavailable"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})
	api := router.Group("/api", requireUser)
	api.GET("/me", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"username": CurrentUser(c), "roles": Roles(c)})
	})
	return router
}

func requireUser(c *gin.Context) {
	user := strings.TrimSpace(c.GetHeader(userHeader))
	if user == "" {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "กรุณาเข้าสู่ระบบ"})
		return
	}
	c.Set(userKey, user)
	c.Next()
}

// CurrentUser คือชื่อผู้ใช้ที่ลงชื่อเข้าใช้ (preferred_username)
func CurrentUser(c *gin.Context) string { return c.GetString(userKey) }

// Roles คือบทบาทของผู้ใช้ตาม PromptServe
func Roles(c *gin.Context) []string {
	raw := c.GetHeader(rolesHeader)
	if raw == "" {
		return nil
	}
	return strings.Split(raw, ",")
}
