import {
  type BranchInfo,
  type CommitInfo,
  type DeviceFlowStart,
  type GitHubAccount,
  type GitHubUserRepo,
  type PullResult,
  SyncService,
  type WorkspaceStatus,
} from "@/services/sync.service";
import { create } from "zustand";

function msg(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

// Um arquivo dentro de um diff selecionado — forma comum entre o diff de um
// arquivo do working tree (DiffResult) e o de um commit (CommitFileDiff).
export interface DiffFile {
  path: string;
  oldText: string;
  newText: string;
  status: string;
  isBinary: boolean;
}

// O diff aberto no painel de detalhe: título (nome do arquivo ou assunto do
// commit) + os arquivos afetados.
export interface DiffView {
  title: string;
  files: DiffFile[];
}

interface SyncState {
  account: GitHubAccount | null;
  status: WorkspaceStatus | null;
  device: DeviceFlowStart | null; // fluxo de login ativo
  repos: GitHubUserRepo[];
  lastPull: PullResult | null;
  commits: CommitInfo[]; // histórico (aba Histórico)
  branches: BranchInfo[]; // branches locais (aba Branches)
  selectedDiff: DiffView | null; // diff aberto no painel de detalhe
  loading: boolean; // carga inicial
  busy: boolean; // ação em andamento (commit/push/pull/...)
  error: string | null;

  load: () => Promise<void>;
  refreshStatus: () => Promise<void>;

  loadHistory: () => Promise<void>;
  loadBranches: () => Promise<void>;
  checkout: (branch: string) => Promise<void>;
  createBranch: (name: string) => Promise<void>;
  showFileDiff: (path: string, staged: boolean) => Promise<void>;
  showCommitDiff: (sha: string, title: string) => Promise<void>;
  clearDiff: () => void;
  discardFile: (path: string, untracked: boolean) => Promise<void>;

  startLogin: () => Promise<void>;
  cancelLogin: () => Promise<void>;
  logout: () => Promise<void>;
  loadRepos: () => Promise<void>;

  commit: (message: string) => Promise<void>;
  push: () => Promise<void>;
  pull: () => Promise<void>;
  resolve: (strategy: "ours" | "theirs" | "abort") => Promise<void>;

  connect: (remoteURL: string) => Promise<void>;
  clone: (cloneURL: string) => Promise<void>;
}

export const useSyncStore = create<SyncState>((set, get) => ({
  account: null,
  status: null,
  device: null,
  repos: [],
  lastPull: null,
  commits: [],
  branches: [],
  selectedDiff: null,
  loading: false,
  busy: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null });
    try {
      const [account, status] = await Promise.all([SyncService.github(), SyncService.status()]);
      set({ account, status, loading: false });
    } catch (err) {
      set({ error: msg(err, "Falha ao carregar estado do git"), loading: false });
    }
  },

  refreshStatus: async () => {
    try {
      const status = await SyncService.status();
      set({ status });
    } catch (err) {
      set({ error: msg(err, "Falha ao atualizar status") });
    }
  },

  loadHistory: async () => {
    // Fora de um repo o facade devolveria erro de domínio; evita ruído na UI.
    if (!get().status?.isRepo) {
      set({ commits: [] });
      return;
    }
    try {
      const commits = await SyncService.log(50);
      set({ commits });
    } catch (err) {
      set({ error: msg(err, "Falha ao carregar o histórico") });
    }
  },

  loadBranches: async () => {
    if (!get().status?.isRepo) {
      set({ branches: [] });
      return;
    }
    try {
      const branches = await SyncService.branches();
      set({ branches });
    } catch (err) {
      set({ error: msg(err, "Falha ao listar branches") });
    }
  },

  checkout: async (branch) => {
    set({ busy: true, error: null });
    try {
      await SyncService.checkout(branch);
      set({ selectedDiff: null });
      // Trocar de branch muda status, histórico e a branch atual da lista.
      await Promise.all([get().refreshStatus(), get().loadBranches(), get().loadHistory()]);
    } catch (err) {
      set({ error: msg(err, "Falha ao trocar de branch") });
      throw err;
    } finally {
      set({ busy: false });
    }
  },

  createBranch: async (name) => {
    set({ busy: true, error: null });
    try {
      await SyncService.createBranch(name);
      // CreateBranch já troca para a nova branch — reflete tudo.
      await Promise.all([get().refreshStatus(), get().loadBranches(), get().loadHistory()]);
    } catch (err) {
      set({ error: msg(err, "Falha ao criar branch") });
      throw err;
    } finally {
      set({ busy: false });
    }
  },

  showFileDiff: async (path, staged) => {
    set({ error: null });
    try {
      const d = await SyncService.fileDiff(path, staged);
      if (!d) return;
      set({
        selectedDiff: {
          title: d.path,
          files: [
            {
              path: d.path,
              oldText: d.oldText,
              newText: d.newText,
              status: d.status,
              isBinary: d.isBinary,
            },
          ],
        },
      });
    } catch (err) {
      set({ error: msg(err, "Falha ao carregar o diff do arquivo") });
    }
  },

  showCommitDiff: async (sha, title) => {
    set({ error: null });
    try {
      const d = await SyncService.commitDiff(sha);
      if (!d) return;
      set({
        selectedDiff: {
          title,
          files: d.files.map((f) => ({
            path: f.path,
            oldText: f.oldText,
            newText: f.newText,
            status: f.status,
            isBinary: f.isBinary,
          })),
        },
      });
    } catch (err) {
      set({ error: msg(err, "Falha ao carregar o diff do commit") });
    }
  },

  clearDiff: () => set({ selectedDiff: null }),

  discardFile: async (path, untracked) => {
    set({ busy: true, error: null });
    try {
      await SyncService.discardFile(path, untracked);
      set({ selectedDiff: null });
      await get().refreshStatus();
    } catch (err) {
      set({ error: msg(err, "Falha ao descartar as mudanças") });
      throw err;
    } finally {
      set({ busy: false });
    }
  },

  startLogin: async () => {
    set({ error: null });
    try {
      const device = await SyncService.startLogin();
      set({ device });
    } catch (err) {
      set({ error: msg(err, "Falha ao iniciar login no GitHub") });
    }
  },

  cancelLogin: async () => {
    try {
      await SyncService.cancelLogin();
    } finally {
      set({ device: null });
    }
  },

  logout: async () => {
    set({ busy: true, error: null });
    try {
      await SyncService.logout();
      set({ account: { authenticated: false } as GitHubAccount, device: null, repos: [] });
    } catch (err) {
      set({ error: msg(err, "Falha ao sair do GitHub") });
    } finally {
      set({ busy: false });
    }
  },

  loadRepos: async () => {
    try {
      const repos = await SyncService.listRepos();
      set({ repos });
    } catch (err) {
      set({ error: msg(err, "Falha ao listar repositórios") });
    }
  },

  commit: async (message) => {
    set({ busy: true, error: null });
    try {
      await SyncService.commit(message);
      await get().refreshStatus();
    } catch (err) {
      set({ error: msg(err, "Falha no commit") });
      throw err;
    } finally {
      set({ busy: false });
    }
  },

  push: async () => {
    set({ busy: true, error: null });
    try {
      await SyncService.push();
      await get().refreshStatus();
    } catch (err) {
      set({ error: msg(err, "Falha no push") });
      throw err;
    } finally {
      set({ busy: false });
    }
  },

  pull: async () => {
    set({ busy: true, error: null, lastPull: null });
    try {
      const lastPull = await SyncService.pull();
      set({ lastPull });
      await get().refreshStatus();
    } catch (err) {
      set({ error: msg(err, "Falha no pull") });
      throw err;
    } finally {
      set({ busy: false });
    }
  },

  resolve: async (strategy) => {
    set({ busy: true, error: null });
    try {
      await SyncService.resolveConflict(strategy);
      set({ lastPull: null });
      await get().refreshStatus();
    } catch (err) {
      set({ error: msg(err, "Falha ao resolver conflito") });
      throw err;
    } finally {
      set({ busy: false });
    }
  },

  connect: async (remoteURL) => {
    set({ busy: true, error: null });
    try {
      await SyncService.connectRemote(remoteURL);
      await get().refreshStatus();
    } catch (err) {
      set({ error: msg(err, "Falha ao conectar o repositório") });
      throw err;
    } finally {
      set({ busy: false });
    }
  },

  clone: async (cloneURL) => {
    set({ busy: true, error: null });
    try {
      await SyncService.cloneWorkspace(cloneURL);
      await get().refreshStatus();
    } catch (err) {
      set({ error: msg(err, "Falha ao clonar o workspace") });
      throw err;
    } finally {
      set({ busy: false });
    }
  },
}));
