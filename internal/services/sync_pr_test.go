package services

// Testes da Fase 3 do ROADMAP: os guards da fachada de PR/code review. Todos os
// 13 métodos resolvem owner/repo via ownerRepo() antes de tocar a rede, então
// exercitamos exatamente essas pré-condições (sem login, sem repo, sem remoto,
// remoto não-GitHub) — nenhuma delega para a API do GitHub de fato.

import (
	"strings"
	"testing"

	"github.com/joaov/putch/internal/config"
	"github.com/joaov/putch/internal/git"
	"github.com/joaov/putch/internal/github"
	"github.com/joaov/putch/internal/store"
)

// prCalls lista cada método de PR da fachada como um thunk que devolve só o
// erro. Serve para provar que TODOS passam pelo guard (mesmo os de escrita, que
// nunca deveriam disparar sem as pré-condições).
func prCalls(svc *SyncService) map[string]func() error {
	return map[string]func() error{
		"ListPullRequests":       func() error { _, err := svc.ListPullRequests("open"); return err },
		"GetPullRequest":         func() error { _, err := svc.GetPullRequest(1); return err },
		"ListPullRequestFiles":   func() error { _, err := svc.ListPullRequestFiles(1); return err },
		"ListPullRequestCommits": func() error { _, err := svc.ListPullRequestCommits(1); return err },
		"ListReviews":            func() error { _, err := svc.ListReviews(1); return err },
		"ListReviewComments":     func() error { _, err := svc.ListReviewComments(1); return err },
		"ListIssueComments":      func() error { _, err := svc.ListIssueComments(1); return err },
		"CreatePullRequest":      func() error { _, err := svc.CreatePullRequest("main", "feat", "título", "corpo"); return err },
		"CreateIssueComment":     func() error { _, err := svc.CreateIssueComment(1, "oi"); return err },
		"CreateReview":           func() error { _, err := svc.CreateReview(1, "COMMENT", "corpo", nil); return err },
		"CreateReviewComment":    func() error { _, err := svc.CreateReviewComment(1, "sha", "a.txt", 10, "RIGHT", "corpo"); return err },
		"ReplyToReviewComment":   func() error { _, err := svc.ReplyToReviewComment(1, int64(5), "corpo"); return err },
		"MergePullRequest":       func() error { return svc.MergePullRequest(1, "merge") },
	}
}

// newAuthedSyncService constrói um SyncService com um token fake no config, para
// exercitar os guards que só rodam DEPOIS da checagem de autenticação. O token
// nunca é usado porque os guards de repo/remoto barram antes de qualquer request.
func newAuthedSyncService(t *testing.T, st *store.Store) *SyncService {
	t.Helper()
	cfg := config.New()
	if err := cfg.Set("github.token", "fake-token-para-teste"); err != nil {
		t.Fatalf("Set token: %v", err)
	}
	gh := github.NewService(cfg)
	if !gh.IsAuthenticated() {
		t.Fatal("github devia estar autenticado após Set do token")
	}
	return NewSyncService(st, git.NewService(), gh)
}

// Sem login, todo método de PR falha citando autenticação — antes de tocar a rede.
func TestSyncServicePRRequiresAuth(t *testing.T) {
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())
	st := newStore(t)
	svc := newSyncService(t, st)
	gitInitRepo(t, st.Root) // é repo, mas falta o login: o guard de auth vem primeiro

	for name, call := range prCalls(svc) {
		err := call()
		if err == nil {
			t.Errorf("%s: esperava erro sem autenticação", name)
			continue
		}
		if !strings.Contains(err.Error(), "autenticado") {
			t.Errorf("%s: erro devia citar autenticação, veio %q", name, err.Error())
		}
	}
}

// Autenticado mas o workspace não é um repo git → guard de repo dispara.
func TestSyncServicePRRequiresRepo(t *testing.T) {
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())
	st := newStore(t)
	svc := newAuthedSyncService(t, st)

	for name, call := range prCalls(svc) {
		err := call()
		if err == nil {
			t.Errorf("%s: esperava erro fora de um repo git", name)
			continue
		}
		if !strings.Contains(err.Error(), "repositório") {
			t.Errorf("%s: erro devia citar repositório, veio %q", name, err.Error())
		}
	}
}

// Autenticado, é repo, mas sem remoto configurado → guard de remoto dispara.
func TestSyncServicePRRequiresRemote(t *testing.T) {
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())
	st := newStore(t)
	svc := newAuthedSyncService(t, st)
	gitInitRepo(t, st.Root)

	if _, e := svc.ListPullRequests("open"); e == nil || !strings.Contains(e.Error(), "remoto") {
		t.Fatalf("ListPullRequests devia exigir remoto, veio %v", e)
	}
	if _, e := svc.CreateIssueComment(1, "oi"); e == nil || !strings.Contains(e.Error(), "remoto") {
		t.Fatalf("CreateIssueComment devia exigir remoto, veio %v", e)
	}
}

// Autenticado, é repo, remoto aponta para host não-GitHub → guard de GitHub dispara.
func TestSyncServicePRRequiresGitHubRemote(t *testing.T) {
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())
	st := newStore(t)
	svc := newAuthedSyncService(t, st)
	gitInitRepo(t, st.Root)
	gitCmd(t, st.Root, "remote", "add", "origin", "https://gitlab.com/foo/bar.git")

	if _, e := svc.ListPullRequests("open"); e == nil || !strings.Contains(e.Error(), "GitHub") {
		t.Fatalf("ListPullRequests devia exigir remoto GitHub, veio %v", e)
	}
	if _, e := svc.GetPullRequest(1); e == nil || !strings.Contains(e.Error(), "GitHub") {
		t.Fatalf("GetPullRequest devia exigir remoto GitHub, veio %v", e)
	}
}
