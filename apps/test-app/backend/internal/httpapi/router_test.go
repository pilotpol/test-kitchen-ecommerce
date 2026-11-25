package httpapi

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestRequireUserRefusesARequestWithoutAUser(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.GET("/api/me", requireUser, func(c *gin.Context) { c.String(http.StatusOK, CurrentUser(c)) })

	refused := httptest.NewRecorder()
	router.ServeHTTP(refused, httptest.NewRequest(http.MethodGet, "/api/me", nil))
	if refused.Code != http.StatusUnauthorized {
		t.Fatalf("want 401 without a user, got %d", refused.Code)
	}

	request := httptest.NewRequest(http.MethodGet, "/api/me", nil)
	request.Header.Set(userHeader, "somchai")
	allowed := httptest.NewRecorder()
	router.ServeHTTP(allowed, request)
	if allowed.Code != http.StatusOK || allowed.Body.String() != "somchai" {
		t.Fatalf("want 200 somchai, got %d %q", allowed.Code, allowed.Body.String())
	}
}
