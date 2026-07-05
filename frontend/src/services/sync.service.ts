import { SyncService as Wails } from "@bindings/services";

// Tipos vêm dos bindings gerados: os do facade (services/models) e os
// cross-package das engines (git/github models) reexportados aqui para a UI
// importar de um lugar só.
export type { ChangedFile, GitHubAccount, WorkspaceStatus } from "@bindings/services";
export type {
  BranchInfo,
  CommitDiffResult,
  CommitFileDiff,
  CommitInfo,
  DiffResult,
  PullResult,
} from "@bindings/git";
export type { DeviceFlowStart, GitHubUserRepo } from "@bindings/github";

export const SyncService = {
  status: () => Wails.Status(),
  github: () => Wails.GitHub(),

  startLogin: () => Wails.StartGitHubLogin(),
  cancelLogin: () => Wails.CancelGitHubLogin(),
  logout: () => Wails.GitHubLogout(),
  listRepos: () => Wails.ListRepos(),

  commit: (message: string) => Wails.Commit(message),
  push: () => Wails.Push(),
  pull: () => Wails.Pull(),
  resolveConflict: (strategy: "ours" | "theirs" | "abort") => Wails.ResolveConflict(strategy),

  connectRemote: (remoteURL: string) => Wails.ConnectRemote(remoteURL),
  cloneWorkspace: (cloneURL: string) => Wails.CloneWorkspace(cloneURL),

  // Histórico / branches / diff (Fase 2)
  log: (limit: number) => Wails.Log(limit),
  branches: () => Wails.ListBranches(),
  checkout: (branch: string) => Wails.Checkout(branch),
  createBranch: (name: string) => Wails.CreateBranch(name),
  fileDiff: (path: string, staged: boolean) => Wails.FileDiff(path, staged),
  commitDiff: (sha: string) => Wails.CommitDiff(sha),
  discardFile: (path: string, untracked: boolean) => Wails.DiscardFile(path, untracked),
};
