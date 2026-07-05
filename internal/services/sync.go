package services

// SyncService é a fachada de colaboração do putch: orquestra store (a pasta do
// workspace), git (motor local) e github (auth + API) numa superfície enxuta
// e estável para os bindings Wails. As engines (internal/git, internal/github)
// têm dezenas de métodos low-level — aqui expomos só o que a UI da Fase 7 usa
// para o fluxo "criar coleção → commit → outra pessoa pull".
//
// Segredos continuam protegidos pelo store (<env>.local.yml gitignored); esta
// camada nunca commita à mão — sempre `git add -A` respeitando o .gitignore.

import (
	"fmt"
	"net/url"
	"strings"

	"github.com/joaov/putch/internal/git"
	"github.com/joaov/putch/internal/github"
	"github.com/joaov/putch/internal/store"
)

type GitHubAccount struct {
	Authenticated bool   `json:"authenticated"`
	Login         string `json:"login"`
	Name          string `json:"name"`
	AvatarURL     string `json:"avatarUrl"`
}

type ChangedFile struct {
	Path   string `json:"path"`
	Status string `json:"status"` // added|modified|deleted|untracked|conflict
}

type WorkspaceStatus struct {
	Path            string        `json:"path"`
	IsRepo          bool          `json:"isRepo"`
	HasRemote       bool          `json:"hasRemote"`
	RemoteURL       string        `json:"remoteUrl"` // sem token (sanitizada)
	Branch          string        `json:"branch"`
	Ahead           int           `json:"ahead"`
	Behind          int           `json:"behind"`
	Clean           bool          `json:"clean"`
	Changes         []ChangedFile `json:"changes"`
	Conflicted      bool          `json:"conflicted"`
	ConflictedFiles []string      `json:"conflictedFiles"`
}

type SyncService struct {
	store  *store.Store
	git    *git.Service
	github *github.Service
}

func NewSyncService(st *store.Store, g *git.Service, gh *github.Service) *SyncService {
	return &SyncService{store: st, git: g, github: gh}
}

func (s *SyncService) root() string { return s.store.Root }

// ── GitHub auth (Device Flow) ─────────────────────────────────────────────────

// GitHub devolve o estado da conta. Se autenticado, busca o perfil
// (best-effort: token inválido degrada para não-autenticado).
func (s *SyncService) GitHub() (GitHubAccount, error) {
	if !s.github.IsAuthenticated() {
		return GitHubAccount{}, nil
	}
	u, err := s.github.GetUser()
	if err != nil {
		// Token presente mas rejeitado/offline: não trava a UI.
		return GitHubAccount{Authenticated: true}, nil
	}
	return GitHubAccount{
		Authenticated: true,
		Login:         u.Login,
		Name:          u.Name,
		AvatarURL:     u.AvatarURL,
	}, nil
}

// StartGitHubLogin inicia o Device Flow e já dispara o polling em background.
// O sucesso emite "github.changed" (via hook Emit, ligado no main) para a UI
// recarregar — o frontend só precisa mostrar UserCode/VerificationURI.
func (s *SyncService) StartGitHubLogin() (github.DeviceFlowStart, error) {
	df, err := s.github.StartDeviceFlow()
	if err != nil {
		return github.DeviceFlowStart{}, err
	}
	go func() {
		// Erro do polling (timeout/cancelado) não tem para onde subir aqui;
		// a UI percebe pela ausência do evento e pelo botão de cancelar.
		_ = s.github.PollDeviceToken(df.DeviceCode, df.Interval)
	}()
	return df, nil
}

func (s *SyncService) CancelGitHubLogin() {
	s.github.CancelDeviceFlow()
}

func (s *SyncService) GitHubLogout() error {
	return s.github.Logout()
}

func (s *SyncService) ListRepos() ([]github.GitHubUserRepo, error) {
	return s.github.ListMyRepos(100)
}

// ── Workspace status ──────────────────────────────────────────────────────────

// Status é o retrato único que a UI consome: é repo?, branch, ahead/behind vs
// origin, arquivos alterados e estado de conflito. Tudo best-effort — offline
// ou sem remoto não é erro, só campos zerados.
func (s *SyncService) Status() (WorkspaceStatus, error) {
	root := s.root()
	ws := WorkspaceStatus{Path: root, Clean: true}

	if !s.git.IsRepo(root) {
		return ws, nil
	}
	ws.IsRepo = true

	if br, err := s.git.CurrentBranch(root); err == nil {
		ws.Branch = br
	}

	if ri, err := s.git.RemoteInfo(root); err == nil && ri != nil && ri.URL != "" {
		ws.HasRemote = true
		ws.RemoteURL = sanitizeURL(ri.URL)
	}

	// Atualiza refs remotas para o ahead/behind ser real; offline → ignora.
	if ws.HasRemote {
		_ = s.git.Fetch(root)
		if ws.Branch != "" {
			if ab, err := s.git.AheadBehind(root, "origin/"+ws.Branch, ws.Branch); err == nil {
				ws.Ahead, ws.Behind = ab.Ahead, ab.Behind
			}
		}
	}

	st, err := s.git.Status(root)
	if err != nil {
		return ws, err
	}
	add := func(fs []git.FileChange) {
		for _, f := range fs {
			ws.Changes = append(ws.Changes, ChangedFile{Path: f.Path, Status: f.Status})
		}
	}
	add(st.Staged)
	add(st.Unstaged)
	add(st.Untracked)

	if conflicts, err := s.git.Conflicts(root); err == nil && len(conflicts) > 0 {
		ws.Conflicted = true
		ws.ConflictedFiles = conflicts
	} else if s.git.MergeInProgress(root) {
		// Merge começado mas sem arquivos U (ex.: resolvidos mas não commitado).
		ws.Conflicted = true
	}

	ws.Clean = len(ws.Changes) == 0 && !ws.Conflicted
	return ws, nil
}

// ── Operações de sync ─────────────────────────────────────────────────────────

// Commit estagia o workspace inteiro (respeitando .gitignore, então segredos
// .local.yml ficam de fora) e commita. Autor vem do git config do usuário.
func (s *SyncService) Commit(message string) (string, error) {
	if strings.TrimSpace(message) == "" {
		return "", fmt.Errorf("mensagem de commit não pode ser vazia")
	}
	root := s.root()
	if !s.git.IsRepo(root) {
		return "", fmt.Errorf("workspace ainda não está conectado a um repositório")
	}
	if err := s.git.StageAll(root); err != nil {
		return "", err
	}
	return s.git.Commit(root, message, "", "")
}

func (s *SyncService) Push() error {
	root := s.root()
	branch, err := s.git.CurrentBranch(root)
	if err != nil {
		return err
	}
	return s.git.Push(root, branch)
}

func (s *SyncService) Pull() (*git.PullResult, error) {
	root := s.root()
	branch, err := s.git.CurrentBranch(root)
	if err != nil {
		return nil, err
	}
	if err := s.git.Fetch(root); err != nil {
		return nil, err
	}
	return s.git.Pull(root, branch)
}

// ResolveConflict aceita "ours" (manter as minhas), "theirs" (usar as deles)
// ou "abort" (desistir do merge).
func (s *SyncService) ResolveConflict(strategy string) error {
	return s.git.ResolveConflict(s.root(), strategy)
}

// ── Histórico / branches / diff (Fase 2) ──────────────────────────────────────
//
// Fachadas finas sobre git.Service: a UI ganha acesso ao histórico, às branches
// e aos diffs sem que o binding precise falar com o motor git direto. Devolvem
// os DTOs do pacote git (mesmo tradeoff do Pull, que já expõe *git.PullResult).
// Os que dependem de repo checam IsRepo e degradam para um erro de domínio em
// pt-br, consistente com Commit.

// Log devolve os commits mais recentes (limit <= 0 usa o default do motor).
func (s *SyncService) Log(limit int) ([]git.CommitInfo, error) {
	root := s.root()
	if !s.git.IsRepo(root) {
		return nil, fmt.Errorf("workspace ainda não está conectado a um repositório")
	}
	return s.git.Log(root, limit)
}

// ListBranches lista as branches locais, marcando a atual.
func (s *SyncService) ListBranches() ([]git.BranchInfo, error) {
	root := s.root()
	if !s.git.IsRepo(root) {
		return nil, fmt.Errorf("workspace ainda não está conectado a um repositório")
	}
	return s.git.ListBranches(root)
}

// Checkout troca para uma branch existente.
func (s *SyncService) Checkout(branch string) error {
	if strings.TrimSpace(branch) == "" {
		return fmt.Errorf("nome da branch não pode ser vazio")
	}
	return s.git.Checkout(s.root(), branch)
}

// CreateBranch cria uma branch e já troca para ela (fluxo esperado pela UI).
func (s *SyncService) CreateBranch(name string) error {
	if strings.TrimSpace(name) == "" {
		return fmt.Errorf("nome da branch não pode ser vazio")
	}
	return s.git.CreateBranch(s.root(), name, true)
}

// FileDiff devolve o diff de um arquivo alterado (staged=false = working tree).
func (s *SyncService) FileDiff(path string, staged bool) (*git.DiffResult, error) {
	if strings.TrimSpace(path) == "" {
		return nil, fmt.Errorf("caminho do arquivo é obrigatório")
	}
	return s.git.FileDiff(s.root(), path, staged)
}

// CommitDiff devolve o conjunto de diffs de um commit (por sha).
func (s *SyncService) CommitDiff(sha string) (*git.CommitDiffResult, error) {
	if strings.TrimSpace(sha) == "" {
		return nil, fmt.Errorf("sha do commit é obrigatório")
	}
	return s.git.CommitDiff(s.root(), sha)
}

// DiscardFile descarta as mudanças de um arquivo (untracked=true remove o novo).
func (s *SyncService) DiscardFile(path string, untracked bool) error {
	if strings.TrimSpace(path) == "" {
		return fmt.Errorf("caminho do arquivo é obrigatório")
	}
	return s.git.DiscardFile(s.root(), path, untracked)
}

// DiscardFiles descarta várias mudanças de uma vez (rastreados vs não rastreados).
func (s *SyncService) DiscardFiles(tracked, untracked []string) error {
	return s.git.DiscardFiles(s.root(), tracked, untracked)
}

// StashPush guarda as mudanças atuais num stash rotulado.
func (s *SyncService) StashPush(message string) error {
	return s.git.StashPush(s.root(), message)
}

// StashPop restaura o stash mais recente.
func (s *SyncService) StashPop() error {
	return s.git.StashPop(s.root())
}

// ── Pull Requests / code review (Fase 3) ──────────────────────────────────────
//
// Fachadas sobre github.Service. owner/repo saem do remoto do workspace
// (git.RemoteInfo já parseia), então a UI nunca precisa informá-los — nem vê o
// token, que continua só no .git/config. Exigem login no GitHub + um remoto
// GitHub e degradam para erro de domínio em pt-br. Devolvem os DTOs do pacote
// github direto (mesmo tradeoff de Pull/Log). A leitura (3a) precede a escrita
// (3b): listar/ver PR é o incremento utilizável; review/comment/merge escrevem.

// ownerRepo resolve dono/repositório a partir do remoto do workspace. É o único
// ponto que traduz "o repo conectado" nos parâmetros que a API do GitHub exige.
func (s *SyncService) ownerRepo() (string, string, error) {
	if !s.github.IsAuthenticated() {
		return "", "", fmt.Errorf("é preciso estar autenticado no GitHub")
	}
	root := s.root()
	if !s.git.IsRepo(root) {
		return "", "", fmt.Errorf("workspace ainda não está conectado a um repositório")
	}
	ri, err := s.git.RemoteInfo(root)
	if err != nil || ri == nil || ri.URL == "" {
		return "", "", fmt.Errorf("workspace não tem um remoto configurado")
	}
	if !ri.IsGitHub || ri.Owner == "" || ri.Name == "" {
		return "", "", fmt.Errorf("o remoto do workspace não é um repositório GitHub")
	}
	return ri.Owner, ri.Name, nil
}

// ── Leitura (3a) ──────────────────────────────────────────────────────────────

// ListPullRequests lista PRs do repo. state aceita "open"|"closed"|"all"
// (vazio = open, default do motor).
func (s *SyncService) ListPullRequests(state string) ([]github.PullRequestSummary, error) {
	owner, repo, err := s.ownerRepo()
	if err != nil {
		return nil, err
	}
	return s.github.ListPullRequests(owner, repo, state)
}

// GetPullRequest devolve os detalhes completos de um PR (descrição, SHAs,
// mergeable, contadores).
func (s *SyncService) GetPullRequest(number int) (*github.PullRequestDetail, error) {
	owner, repo, err := s.ownerRepo()
	if err != nil {
		return nil, err
	}
	return s.github.GetPullRequest(owner, repo, number)
}

// ListPullRequestFiles lista os arquivos alterados no PR (com patch unificado
// para o render de diff da UI).
func (s *SyncService) ListPullRequestFiles(number int) ([]github.PullRequestFile, error) {
	owner, repo, err := s.ownerRepo()
	if err != nil {
		return nil, err
	}
	return s.github.ListPullRequestFiles(owner, repo, number)
}

// ListPullRequestCommits lista os commits incluídos no PR (ordem cronológica).
func (s *SyncService) ListPullRequestCommits(number int) ([]github.PullRequestCommit, error) {
	owner, repo, err := s.ownerRepo()
	if err != nil {
		return nil, err
	}
	return s.github.ListPullRequestCommits(owner, repo, number)
}

// ListReviews lista as reviews submetidas no PR (approve/request_changes/comment).
func (s *SyncService) ListReviews(number int) ([]github.PullRequestReview, error) {
	owner, repo, err := s.ownerRepo()
	if err != nil {
		return nil, err
	}
	return s.github.ListReviews(owner, repo, number)
}

// ListReviewComments lista os comentários inline (ancorados a linhas do diff).
func (s *SyncService) ListReviewComments(number int) ([]github.ReviewComment, error) {
	owner, repo, err := s.ownerRepo()
	if err != nil {
		return nil, err
	}
	return s.github.ListReviewComments(owner, repo, number)
}

// ListIssueComments lista os comentários de timeline do PR (não atrelados ao diff).
func (s *SyncService) ListIssueComments(number int) ([]github.IssueComment, error) {
	owner, repo, err := s.ownerRepo()
	if err != nil {
		return nil, err
	}
	return s.github.ListIssueComments(owner, repo, number)
}

// ── Escrita (3b) ──────────────────────────────────────────────────────────────

// CreatePullRequest abre um PR. head vazio assume a branch atual do workspace
// (fluxo esperado: "abrir PR da minha branch"); base é obrigatória.
func (s *SyncService) CreatePullRequest(base, head, title, body string) (*github.PullRequestInfo, error) {
	if strings.TrimSpace(title) == "" {
		return nil, fmt.Errorf("título do PR não pode ser vazio")
	}
	if strings.TrimSpace(base) == "" {
		return nil, fmt.Errorf("branch de destino (base) é obrigatória")
	}
	owner, repo, err := s.ownerRepo()
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(head) == "" {
		br, err := s.git.CurrentBranch(s.root())
		if err != nil {
			return nil, err
		}
		head = br
	}
	return s.github.CreatePullRequest(owner, repo, base, head, title, body)
}

// CreateIssueComment posta um comentário de timeline no PR (texto puro).
func (s *SyncService) CreateIssueComment(number int, body string) (*github.IssueComment, error) {
	if strings.TrimSpace(body) == "" {
		return nil, fmt.Errorf("comentário não pode ser vazio")
	}
	owner, repo, err := s.ownerRepo()
	if err != nil {
		return nil, err
	}
	return s.github.CreateIssueComment(owner, repo, number, body)
}

// CreateReview submete uma review. event aceita APPROVE|REQUEST_CHANGES|COMMENT
// (vazio = review pendente). comments anexa comentários inline por linha.
func (s *SyncService) CreateReview(number int, event, body string, comments []github.ReviewCommentInput) (*github.PullRequestReview, error) {
	owner, repo, err := s.ownerRepo()
	if err != nil {
		return nil, err
	}
	return s.github.CreateReview(owner, repo, number, event, body, comments)
}

// CreateReviewComment ancora um comentário a uma linha do diff. side aceita
// "LEFT" (versão antiga) ou "RIGHT" (nova); commitID é o SHA do head do PR.
func (s *SyncService) CreateReviewComment(number int, commitID, path string, line int, side, body string) (*github.ReviewComment, error) {
	if strings.TrimSpace(body) == "" {
		return nil, fmt.Errorf("comentário não pode ser vazio")
	}
	owner, repo, err := s.ownerRepo()
	if err != nil {
		return nil, err
	}
	return s.github.CreateReviewComment(owner, repo, number, commitID, path, line, side, body)
}

// ReplyToReviewComment responde a um comentário inline existente (thread).
func (s *SyncService) ReplyToReviewComment(number int, inReplyTo int64, body string) (*github.ReviewComment, error) {
	if strings.TrimSpace(body) == "" {
		return nil, fmt.Errorf("resposta não pode ser vazia")
	}
	owner, repo, err := s.ownerRepo()
	if err != nil {
		return nil, err
	}
	return s.github.ReplyToReviewComment(owner, repo, number, inReplyTo, body)
}

// MergePullRequest mescla o PR. method aceita "merge"|"squash"|"rebase"
// (vazio = merge).
func (s *SyncService) MergePullRequest(number int, method string) error {
	owner, repo, err := s.ownerRepo()
	if err != nil {
		return err
	}
	return s.github.MergePullRequest(owner, repo, number, method)
}

// ── Conectar / clonar workspace ───────────────────────────────────────────────

// ConnectRemote liga o workspace atual a um repositório (o criador publicando).
// Injeta o token na URL https para push em repo privado funcionar sem
// credential helper (mesmo tradeoff do clone: token só no .git/config local).
func (s *SyncService) ConnectRemote(remoteURL string) error {
	authed := s.github.AuthenticatedURL(remoteURL)
	return s.git.InitWorkspace(s.root(), authed)
}

// CloneWorkspace popula o workspace a partir de um repositório existente
// (o colaborador entrando). Recusa se já houver um repo conectado.
func (s *SyncService) CloneWorkspace(cloneURL string) error {
	authed := s.github.AuthenticatedURL(cloneURL)
	return s.git.CloneInto(s.root(), authed)
}

// sanitizeURL remove qualquer userinfo (token x-access-token:...) antes de
// devolver a URL para a UI — o token nunca aparece na tela nem em logs.
func sanitizeURL(raw string) string {
	u, err := url.Parse(raw)
	if err != nil || u.User == nil {
		return raw
	}
	u.User = nil
	return u.String()
}
