package auth

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestCompleteValidatesAndPersistsPrivateSession(t *testing.T) {
	expiresAt := time.Now().Add(time.Hour).UTC().Truncate(time.Second)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := r.Header.Get("Authorization"); got != "Bearer session-secret" {
			t.Fatalf("Authorization = %q", got)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = fmt.Fprintf(w, `{"session":{"token":"session-secret","expiresAt":%q},"user":{"id":"user-1","name":"Ada","email":"ada@adila.co"}}`, expiresAt.Format(time.RFC3339))
	}))
	defer server.Close()

	path := filepath.Join(t.TempDir(), "nested", "session.json")
	service := newService(path, server.URL, server.Client())
	state, err := service.Complete("session-secret")
	if err != nil {
		t.Fatalf("Complete: %v", err)
	}
	if !state.Authenticated || state.User == nil || state.User.Email != "ada@adila.co" {
		t.Fatalf("state = %#v", state)
	}

	info, err := os.Stat(path)
	if err != nil {
		t.Fatalf("Stat: %v", err)
	}
	if got := info.Mode().Perm(); got != 0o600 {
		t.Fatalf("mode = %o, want 600", got)
	}
	raw, _ := os.ReadFile(path)
	if !strings.Contains(string(raw), "session-secret") {
		t.Fatal("persisted session does not contain token")
	}
	if got := service.Status(); !got.Authenticated || got.User == nil || got.User.ID != "user-1" {
		t.Fatalf("Status = %#v", got)
	}
}

func TestCompleteRejectsUnverifiedToken(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
	}))
	defer server.Close()

	path := filepath.Join(t.TempDir(), "session.json")
	service := newService(path, server.URL, server.Client())
	if _, err := service.Complete("invalid"); err == nil {
		t.Fatal("Complete should reject invalid token")
	}
	if _, err := os.Stat(path); !os.IsNotExist(err) {
		t.Fatalf("session file should not exist: %v", err)
	}
}

func TestStatusRemovesExpiredSession(t *testing.T) {
	path := filepath.Join(t.TempDir(), "session.json")
	service := newService(path, "http://identity.invalid", http.DefaultClient)
	if err := service.write(storedSession{
		Token:     "expired",
		User:      User{ID: "user-1"},
		ExpiresAt: time.Now().Add(-time.Minute),
	}); err != nil {
		t.Fatalf("write: %v", err)
	}
	if got := service.Status(); got.Authenticated {
		t.Fatalf("Status = %#v", got)
	}
	if _, err := os.Stat(path); !os.IsNotExist(err) {
		t.Fatalf("expired session file should be removed: %v", err)
	}
}

func TestLogoutClearsSessionWhenIdentityIsUnavailable(t *testing.T) {
	path := filepath.Join(t.TempDir(), "session.json")
	client := &http.Client{Timeout: 20 * time.Millisecond}
	service := newService(path, "http://127.0.0.1:1", client)
	if err := service.write(storedSession{
		Token:     "session-secret",
		User:      User{ID: "user-1"},
		ExpiresAt: time.Now().Add(time.Hour),
	}); err != nil {
		t.Fatalf("write: %v", err)
	}
	if err := service.Logout(); err != nil {
		t.Fatalf("Logout: %v", err)
	}
	if got := service.Status(); got.Authenticated {
		t.Fatalf("Status = %#v", got)
	}
}
