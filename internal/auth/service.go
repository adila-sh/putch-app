// Package auth implements the desktop side of Adila Identity authentication.
package auth

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
)

const (
	identityURL = "https://identity.adila.co"
	authURL     = "https://auth.adila.co/auth"
	returnURL   = "https://putch.adila.co/auth/desktop"
)

// User is the small profile snapshot kept with the local session.
type User struct {
	ID       string  `json:"id"`
	Name     string  `json:"name"`
	Email    string  `json:"email"`
	ImageURL *string `json:"image,omitempty"`
}

// State is safe to return to the frontend: the bearer token is never exposed.
type State struct {
	Authenticated bool      `json:"authenticated"`
	User          *User     `json:"user,omitempty"`
	ExpiresAt     time.Time `json:"expires_at,omitempty"`
}

type storedSession struct {
	Token     string    `json:"token"`
	User      User      `json:"user"`
	ExpiresAt time.Time `json:"expires_at"`
}

type identitySession struct {
	Session struct {
		Token     string    `json:"token"`
		ExpiresAt time.Time `json:"expiresAt"`
	} `json:"session"`
	User User `json:"user"`
}

// Service owns login navigation and the private on-disk session.
type Service struct {
	mu          sync.RWMutex
	path        string
	identityURL string
	client      *http.Client
	window      *application.WebviewWindow
}

// NewService creates the production service under the user's config directory.
func NewService() *Service {
	path := ""
	if dir, err := os.UserConfigDir(); err == nil {
		path = filepath.Join(dir, "adila", "putch-session.json")
	}
	return newService(path, identityURL, &http.Client{Timeout: 15 * time.Second})
}

func newService(path, baseURL string, client *http.Client) *Service {
	return &Service{path: path, identityURL: strings.TrimRight(baseURL, "/"), client: client}
}

// AttachWindow connects navigation methods after the Wails window is created.
//
//wails:ignore
func (s *Service) AttachWindow(window *application.WebviewWindow) {
	s.mu.Lock()
	s.window = window
	s.mu.Unlock()
}

// StartLogin renders the central login portal as the top-level webview page.
func (s *Service) StartLogin() error {
	s.mu.RLock()
	window := s.window
	s.mu.RUnlock()
	if window == nil {
		return errors.New("janela do aplicativo ainda não está pronta")
	}

	login, err := url.Parse(authURL)
	if err != nil {
		return err
	}
	query := login.Query()
	query.Set("redirect", returnURL)
	login.RawQuery = query.Encode()
	window.SetURL(login.String())
	return nil
}

// Complete validates the session token with Identity before storing it locally.
func (s *Service) Complete(token string) (State, error) {
	token = strings.TrimSpace(token)
	if token == "" {
		return State{}, errors.New("sessão de autenticação ausente")
	}

	session, err := s.fetchSession(token)
	if err != nil {
		return State{}, err
	}
	if session.Session.Token == "" || session.Session.Token != token {
		return State{}, errors.New("Identity retornou uma sessão inválida")
	}

	stored := storedSession{Token: token, User: session.User, ExpiresAt: session.Session.ExpiresAt}
	if err := s.write(stored); err != nil {
		return State{}, fmt.Errorf("salvar sessão local: %w", err)
	}
	return stateFromStored(stored), nil
}

// Status reads the persisted session without exposing its bearer token.
func (s *Service) Status() State {
	stored, err := s.read()
	if err != nil || stored.Token == "" || !stored.ExpiresAt.After(time.Now()) {
		if err == nil && stored.Token != "" {
			_ = s.remove()
		}
		return State{}
	}
	return stateFromStored(stored)
}

// Logout revokes the remote session when possible and always clears local state.
func (s *Service) Logout() error {
	stored, _ := s.read()
	if stored.Token != "" {
		req, err := http.NewRequest(http.MethodPost, s.identityURL+"/api/auth/sign-out", nil)
		if err == nil {
			req.Header.Set("Authorization", "Bearer "+stored.Token)
			resp, requestErr := s.client.Do(req)
			if requestErr == nil {
				_, _ = io.Copy(io.Discard, resp.Body)
				_ = resp.Body.Close()
			}
		}
	}
	return s.remove()
}

// InjectCompletionBridge is called after navigations. It only acts on the
// trusted HTTPS Putch callback and returns the HttpOnly-backed Identity session
// to the local Wails origin through a URL fragment (never sent to a server).
//
//wails:ignore
func (s *Service) InjectCompletionBridge() {
	s.mu.RLock()
	window := s.window
	s.mu.RUnlock()
	if window == nil {
		return
	}

	callback := "wails://localhost/auth/callback"
	if runtime.GOOS == "windows" {
		callback = "https://wails.localhost/auth/callback"
	}
	quotedCallback, _ := json.Marshal(callback)
	window.ExecJS(fmt.Sprintf(`(() => {
  if (location.protocol !== "https:" || location.hostname !== "putch.adila.co") return;
  if (window.__putchDesktopAuthCompleting) return;
  window.__putchDesktopAuthCompleting = true;
  fetch("https://identity.adila.co/api/auth/get-session", { credentials: "include" })
    .then((response) => {
      if (!response.ok) throw new Error("Identity respondeu " + response.status);
      return response.json();
    })
    .then((data) => {
      const token = data && data.session && data.session.token;
      if (!token) throw new Error("sessão ausente");
      location.replace(%s + "#token=" + encodeURIComponent(token));
    })
    .catch(() => { window.__putchDesktopAuthCompleting = false; });
})();`, quotedCallback))
}

func (s *Service) fetchSession(token string) (identitySession, error) {
	req, err := http.NewRequest(http.MethodGet, s.identityURL+"/api/auth/get-session", nil)
	if err != nil {
		return identitySession{}, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err := s.client.Do(req)
	if err != nil {
		return identitySession{}, fmt.Errorf("validar sessão no Identity: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		_, _ = io.Copy(io.Discard, resp.Body)
		return identitySession{}, fmt.Errorf("Identity recusou a sessão (%s)", resp.Status)
	}

	var remote identitySession
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&remote); err != nil {
		return identitySession{}, fmt.Errorf("ler sessão do Identity: %w", err)
	}
	return remote, nil
}

func (s *Service) read() (storedSession, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if s.path == "" {
		return storedSession{}, os.ErrNotExist
	}
	raw, err := os.ReadFile(s.path)
	if err != nil {
		return storedSession{}, err
	}
	var session storedSession
	if err := json.Unmarshal(raw, &session); err != nil {
		return storedSession{}, err
	}
	return session, nil
}

func (s *Service) write(session storedSession) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.path == "" {
		return errors.New("diretório de configuração indisponível")
	}
	if err := os.MkdirAll(filepath.Dir(s.path), 0o700); err != nil {
		return err
	}
	raw, err := json.MarshalIndent(session, "", "  ")
	if err != nil {
		return err
	}
	temporary := s.path + ".tmp"
	if err := os.WriteFile(temporary, raw, 0o600); err != nil {
		return err
	}
	if err := os.Chmod(temporary, 0o600); err != nil {
		_ = os.Remove(temporary)
		return err
	}
	if err := os.Rename(temporary, s.path); err != nil {
		_ = os.Remove(temporary)
		return err
	}
	return os.Chmod(s.path, 0o600)
}

func (s *Service) remove() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.path == "" {
		return nil
	}
	err := os.Remove(s.path)
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	return err
}

func stateFromStored(session storedSession) State {
	user := session.User
	return State{Authenticated: true, User: &user, ExpiresAt: session.ExpiresAt}
}
