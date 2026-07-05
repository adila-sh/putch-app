package services

// Testes da Fase 2 do ROADMAP: a fachada de histórico/branches/diff que o
// SyncService expõe para a UI. Reutilizam os helpers do arquivo da Fase 1
// (gitCmd, gitInitRepo, newSyncService, newStore) — mesmo package.

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// seedRepo transforma o root do store num repo git com um commit inicial
// contendo os arquivos dados (path relativo → conteúdo). Devolve o SyncService.
func seedRepo(t *testing.T, files map[string]string) (*SyncService, *SyncService) {
	t.Helper()
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())
	st := newStore(t)
	svc := newSyncService(t, st)
	gitInitRepo(t, st.Root)
	for rel, content := range files {
		abs := filepath.Join(st.Root, rel)
		if err := os.MkdirAll(filepath.Dir(abs), 0o755); err != nil {
			t.Fatalf("MkdirAll %s: %v", rel, err)
		}
		if err := os.WriteFile(abs, []byte(content), 0o644); err != nil {
			t.Fatalf("WriteFile %s: %v", rel, err)
		}
	}
	// svc devolvido duas vezes só para deixar a assinatura simétrica com o uso;
	// o segundo valor é o mesmo ponteiro (conveniência nos testes).
	return svc, svc
}

// currentBranch acha o nome da branch atual via ListBranches.
func currentBranch(t *testing.T, svc *SyncService) string {
	t.Helper()
	branches, err := svc.ListBranches()
	if err != nil {
		t.Fatalf("ListBranches: %v", err)
	}
	for _, b := range branches {
		if b.IsCurrent {
			return b.Name
		}
	}
	t.Fatal("nenhuma branch marcada como atual")
	return ""
}

// ── Log + CommitDiff ────────────────────────────────────────────────────────────

func TestSyncServiceLogAndCommitDiff(t *testing.T) {
	svc, _ := seedRepo(t, map[string]string{"nota.txt": "linha 1\n"})

	sha, err := svc.Commit("commit inicial")
	if err != nil {
		t.Fatalf("Commit: %v", err)
	}

	commits, err := svc.Log(10)
	if err != nil {
		t.Fatalf("Log: %v", err)
	}
	if len(commits) != 1 {
		t.Fatalf("esperava 1 commit no histórico, veio %d", len(commits))
	}
	if commits[0].Subject != "commit inicial" {
		t.Fatalf("subject divergiu: %q", commits[0].Subject)
	}
	if !strings.HasPrefix(sha, commits[0].Hash[:7]) && commits[0].Hash != sha {
		t.Fatalf("sha do Log (%s) não bate com o do Commit (%s)", commits[0].Hash, sha)
	}

	diff, err := svc.CommitDiff(sha)
	if err != nil {
		t.Fatalf("CommitDiff: %v", err)
	}
	if len(diff.Files) == 0 {
		t.Fatal("CommitDiff devia listar arquivos do commit")
	}

	// erro: sha vazio é rejeitado antes de tocar o git
	if _, err := svc.CommitDiff("   "); err == nil {
		t.Fatal("CommitDiff devia rejeitar sha vazio")
	}
}

// ── Branches: criar, listar, trocar ─────────────────────────────────────────────

func TestSyncServiceBranchesLifecycle(t *testing.T) {
	svc, _ := seedRepo(t, map[string]string{"nota.txt": "conteúdo\n"})
	if _, err := svc.Commit("inicial"); err != nil {
		t.Fatalf("Commit: %v", err)
	}

	base := currentBranch(t, svc) // main ou master, conforme a config da máquina

	// criar já troca para a nova branch
	if err := svc.CreateBranch("feature/x"); err != nil {
		t.Fatalf("CreateBranch: %v", err)
	}
	if cur := currentBranch(t, svc); cur != "feature/x" {
		t.Fatalf("CreateBranch devia trocar para a nova branch, atual=%q", cur)
	}

	branches, _ := svc.ListBranches()
	if len(branches) != 2 {
		t.Fatalf("esperava 2 branches, veio %d", len(branches))
	}

	// voltar para a base
	if err := svc.Checkout(base); err != nil {
		t.Fatalf("Checkout base: %v", err)
	}
	if cur := currentBranch(t, svc); cur != base {
		t.Fatalf("Checkout devia voltar para %q, atual=%q", base, cur)
	}

	// erros de validação e de branch inexistente
	if err := svc.CreateBranch("  "); err == nil {
		t.Fatal("CreateBranch devia rejeitar nome vazio")
	}
	if err := svc.Checkout(""); err == nil {
		t.Fatal("Checkout devia rejeitar nome vazio")
	}
	if err := svc.Checkout("nao-existe"); err == nil {
		t.Fatal("Checkout de branch inexistente devia falhar")
	}
}

// ── FileDiff + DiscardFile ──────────────────────────────────────────────────────

func TestSyncServiceFileDiffAndDiscard(t *testing.T) {
	svc, _ := seedRepo(t, map[string]string{"nota.txt": "linha 1\n"})
	if _, err := svc.Commit("inicial"); err != nil {
		t.Fatalf("Commit: %v", err)
	}

	// modifica o arquivo rastreado no working tree
	abs := filepath.Join(svc.root(), "nota.txt")
	if err := os.WriteFile(abs, []byte("linha 1\nlinha 2\n"), 0o644); err != nil {
		t.Fatalf("WriteFile: %v", err)
	}

	diff, err := svc.FileDiff("nota.txt", false)
	if err != nil {
		t.Fatalf("FileDiff: %v", err)
	}
	if !strings.Contains(diff.NewText, "linha 2") {
		t.Fatalf("FileDiff devia mostrar a linha nova, NewText=%q", diff.NewText)
	}
	if strings.Contains(diff.OldText, "linha 2") {
		t.Fatalf("OldText não devia conter a linha nova, OldText=%q", diff.OldText)
	}

	// descarta a mudança do arquivo rastreado → volta ao conteúdo commitado
	if err := svc.DiscardFile("nota.txt", false); err != nil {
		t.Fatalf("DiscardFile: %v", err)
	}
	restored, _ := os.ReadFile(abs)
	if string(restored) != "linha 1\n" {
		t.Fatalf("DiscardFile devia restaurar o conteúdo commitado, veio %q", string(restored))
	}

	// erro: caminho vazio é rejeitado
	if _, err := svc.FileDiff("", false); err == nil {
		t.Fatal("FileDiff devia rejeitar caminho vazio")
	}
	if err := svc.DiscardFile("  ", false); err == nil {
		t.Fatal("DiscardFile devia rejeitar caminho vazio")
	}
}

// ── Guardas sem repositório ──────────────────────────────────────────────────────

func TestSyncServiceGitFacadeWithoutRepo(t *testing.T) {
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())
	st := newStore(t) // root NÃO é um repo git
	svc := newSyncService(t, st)

	if _, err := svc.Log(10); err == nil ||
		!strings.Contains(err.Error(), "repositório") {
		t.Fatalf("Log sem repo: esperava erro de domínio, veio %v", err)
	}
	if _, err := svc.ListBranches(); err == nil ||
		!strings.Contains(err.Error(), "repositório") {
		t.Fatalf("ListBranches sem repo: esperava erro de domínio, veio %v", err)
	}
}
