import {
  Badge,
  Column,
  Container,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Label,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Title,
} from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ErrorAlert } from "@/components/functional/error-alert";
import { UnifiedDiff, computeDiff } from "@/components/functional/unified-diff";
import { useSync } from "@/hooks/useSync";
import { Events } from "@wailsio/runtime";
import { useEffect, useState } from "react";

const STATUS_LABEL: Record<string, string> = {
  added: "adicionado",
  modified: "modificado",
  deleted: "removido",
  untracked: "novo",
  conflict: "conflito",
};

// Go serializa time.Time como string ISO (RFC3339) no fio, embora o binding
// tipe como wrapper Time. Formata defensivamente para pt-BR.
function formatDate(value: unknown): string {
  if (!value) return "";
  const d = new Date(value as string);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("pt-BR");
}

export default function GitView() {
  const {
    account,
    status,
    device,
    repos,
    lastPull,
    commits,
    branches,
    selectedDiff,
    busy,
    error,
    load,
    refreshStatus,
    loadHistory,
    loadBranches,
    checkout,
    createBranch,
    showFileDiff,
    showCommitDiff,
    clearDiff,
    discardFile,
    startLogin,
    cancelLogin,
    logout,
    loadRepos,
    commit,
    push,
    pull,
    resolve,
    connect,
    clone,
  } = useSync();

  const [message, setMessage] = useState("");
  const [remoteURL, setRemoteURL] = useState("");
  const [cloneURL, setCloneURL] = useState("");
  const [newBranch, setNewBranch] = useState("");
  // Confirmação inline de descarte (destrutivo) por caminho de arquivo.
  const [confirmDiscard, setConfirmDiscard] = useState<string | null>(null);

  // O backend emite "github.changed" quando o estado de autenticação muda
  // (login concluído, logout). Recarregamos conta, status e — se houver repo —
  // histórico e branches nesse momento.
  useEffect(() => {
    const off = Events.On("github.changed", () => {
      void (async () => {
        await load();
        await refreshStatus();
        await Promise.all([loadHistory(), loadBranches()]);
      })();
    });
    return () => off();
  }, [load, refreshStatus, loadHistory, loadBranches]);

  const authed = account?.authenticated === true;

  const handleCommit = async () => {
    const text = message.trim();
    if (!text) return;
    try {
      await commit(text);
      setMessage("");
      await loadHistory();
    } catch {
      /* erro já está no store */
    }
  };

  const handleConnect = async () => {
    const url = remoteURL.trim();
    if (!url) return;
    try {
      await connect(url);
      setRemoteURL("");
    } catch {
      /* erro já está no store */
    }
  };

  const handleClone = async () => {
    const url = cloneURL.trim();
    if (!url) return;
    try {
      await clone(url);
      setCloneURL("");
    } catch {
      /* erro já está no store */
    }
  };

  const handleCreateBranch = async () => {
    const name = newBranch.trim();
    if (!name) return;
    try {
      await createBranch(name);
      setNewBranch("");
    } catch {
      /* erro já está no store */
    }
  };

  const handleDiscard = async (path: string, untracked: boolean) => {
    try {
      await discardFile(path, untracked);
    } catch {
      /* erro já está no store */
    } finally {
      setConfirmDiscard(null);
    }
  };

  return (
    <Container className="p-6">
      <Column>
        <Title>Sincronização</Title>
        <Label>Versione suas collections com git e colabore via GitHub.</Label>

        {error && <ErrorAlert message={error} />}

        {/* Conta GitHub */}
        <Card>
          <CardHeader>
            <CardTitle>GitHub</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {authed ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {account?.avatarUrl && (
                    <img
                      src={account.avatarUrl}
                      alt={account.login}
                      className="h-10 w-10 rounded-full"
                    />
                  )}
                  <div>
                    <div className="font-medium">{account?.name || account?.login}</div>
                    <div className="text-sm text-muted-foreground">@{account?.login}</div>
                  </div>
                </div>
                <Button variant="outline" disabled={busy} onClick={() => logout()}>
                  Sair
                </Button>
              </div>
            ) : device ? (
              <div className="space-y-3">
                <p className="text-sm">
                  Acesse{" "}
                  <a
                    href={device.verificationUri}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-primary underline"
                  >
                    {device.verificationUri}
                  </a>{" "}
                  e informe o código:
                </p>
                <div className="rounded-md border bg-muted px-4 py-3 text-center font-mono text-2xl tracking-widest">
                  {device.userCode}
                </div>
                <Button variant="ghost" onClick={() => cancelLogin()}>
                  Cancelar
                </Button>
              </div>
            ) : (
              <Button disabled={busy} onClick={() => startLogin()}>
                Conectar ao GitHub
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Workspace / remoto */}
        <Card>
          <CardHeader>
            <CardTitle>Workspace</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {status?.isRepo && status.hasRemote ? (
              <div className="space-y-1 text-sm">
                <div>
                  <span className="text-muted-foreground">Branch:</span>{" "}
                  <span className="font-mono">{status.branch || "—"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Remoto:</span>{" "}
                  <span className="font-mono break-all">{status.remoteUrl}</span>
                </div>
                <div className="flex gap-4">
                  <span>
                    <span className="text-muted-foreground">À frente:</span> {status.ahead}
                  </span>
                  <span>
                    <span className="text-muted-foreground">Atrás:</span> {status.behind}
                  </span>
                  <span>{status.clean ? "Sem alterações" : "Alterações pendentes"}</span>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Conectar repositório existente</p>
                  <p className="text-xs text-muted-foreground">
                    Aponta o workspace atual para um remoto (git init + remote add).
                  </p>
                  <div className="flex gap-2">
                    <Input
                      placeholder="https://github.com/org/repo.git"
                      value={remoteURL}
                      onChange={(e) => setRemoteURL(e.target.value)}
                    />
                    <Button disabled={busy || !remoteURL.trim()} onClick={handleConnect}>
                      Conectar
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Clonar workspace</p>
                  <p className="text-xs text-muted-foreground">
                    Substitui o workspace local pelo conteúdo do repositório remoto.
                  </p>
                  <div className="flex gap-2">
                    <Input
                      placeholder="https://github.com/org/repo.git"
                      value={cloneURL}
                      onChange={(e) => setCloneURL(e.target.value)}
                    />
                    <Button
                      variant="outline"
                      disabled={busy || !cloneURL.trim()}
                      onClick={handleClone}
                    >
                      Clonar
                    </Button>
                  </div>
                </div>

                {authed && (
                  <div className="space-y-2">
                    <Button variant="ghost" size="sm" disabled={busy} onClick={() => loadRepos()}>
                      Listar meus repositórios
                    </Button>
                    {repos.length > 0 && (
                      <ul className="max-h-48 space-y-1 overflow-y-auto rounded-md border p-2 text-sm">
                        {repos.map((r) => (
                          <li
                            key={r.fullName}
                            className="flex items-center justify-between gap-2 rounded px-2 py-1 hover:bg-accent"
                          >
                            <span className="truncate font-mono">{r.fullName}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={busy}
                              onClick={() => clone(r.cloneUrl)}
                            >
                              Clonar
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Conflitos (fora das tabs — sempre visível quando existe) */}
        {status?.conflicted && (
          <Card>
            <CardHeader>
              <CardTitle className="text-destructive">Conflito de merge</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Escolha qual versão manter para resolver o conflito.
              </p>
              {status.conflictedFiles.length > 0 && (
                <ul className="space-y-1 rounded-md border bg-muted p-2 font-mono text-xs">
                  {status.conflictedFiles.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              )}
              <div className="flex gap-2">
                <Button disabled={busy} onClick={() => resolve("ours")}>
                  Manter local
                </Button>
                <Button disabled={busy} onClick={() => resolve("theirs")}>
                  Manter remoto
                </Button>
                <Button variant="destructive" disabled={busy} onClick={() => resolve("abort")}>
                  Abortar merge
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Abas de git: Status | Histórico | Branches */}
        {status?.isRepo && (
          <Tabs defaultValue="status">
            <TabsList>
              <TabsTrigger value="status">Status</TabsTrigger>
              <TabsTrigger value="history">Histórico</TabsTrigger>
              <TabsTrigger value="branches">Branches</TabsTrigger>
            </TabsList>

            {/* ── Status: alterações, commit, push/pull, descarte por arquivo ── */}
            <TabsContent value="status">
              <Card>
                <CardHeader>
                  <CardTitle>Alterações</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {status.changes.length > 0 ? (
                    <ul className="max-h-64 space-y-1 overflow-y-auto rounded-md border p-2 text-sm">
                      {status.changes.map((c) => {
                        const untracked = c.status === "untracked";
                        return (
                          <li
                            key={c.path}
                            className="flex items-center justify-between gap-2 rounded px-1 py-0.5 hover:bg-accent"
                          >
                            <button
                              type="button"
                              className="min-w-0 flex-1 truncate text-left font-mono hover:underline"
                              onClick={() => showFileDiff(c.path, false)}
                              title="Ver diff"
                            >
                              {c.path}
                            </button>
                            <span className="shrink-0 text-muted-foreground">
                              {STATUS_LABEL[c.status] ?? c.status}
                            </span>
                            {confirmDiscard === c.path ? (
                              <span className="flex shrink-0 gap-1">
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  disabled={busy}
                                  onClick={() => handleDiscard(c.path, untracked)}
                                >
                                  Confirmar
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setConfirmDiscard(null)}
                                >
                                  Cancelar
                                </Button>
                              </span>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={busy}
                                onClick={() => setConfirmDiscard(c.path)}
                              >
                                Descartar
                              </Button>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">Nada a commitar.</p>
                  )}

                  <div className="flex gap-2">
                    <Input
                      placeholder="Mensagem do commit"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void handleCommit();
                      }}
                    />
                    <Button
                      disabled={busy || !message.trim() || status.clean}
                      onClick={handleCommit}
                    >
                      Commit
                    </Button>
                  </div>

                  {status.hasRemote && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        disabled={busy || status.conflicted}
                        onClick={() => pull()}
                      >
                        Pull
                      </Button>
                      <Button
                        variant="outline"
                        disabled={busy || status.conflicted}
                        onClick={() => push()}
                      >
                        Push {status.ahead > 0 ? `(${status.ahead})` : ""}
                      </Button>
                    </div>
                  )}

                  {lastPull && (
                    <div className="rounded-md border bg-muted p-2 text-xs">
                      {lastPull.alreadyUpToDate
                        ? "Já está atualizado."
                        : lastPull.fastForward
                          ? "Atualizado (fast-forward)."
                          : lastPull.conflicted
                            ? "Pull gerou conflitos — resolva acima."
                            : lastPull.merged
                              ? "Merge concluído."
                              : "Pull concluído."}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Histórico: lista de commits, clique abre o diff ── */}
            <TabsContent value="history">
              <Card>
                <CardHeader>
                  <CardTitle>Histórico</CardTitle>
                </CardHeader>
                <CardContent>
                  {commits.length > 0 ? (
                    <ul className="max-h-[28rem] space-y-1 overflow-y-auto">
                      {commits.map((cm) => (
                        <li key={cm.hash}>
                          <button
                            type="button"
                            className="w-full rounded-md border px-3 py-2 text-left hover:bg-accent"
                            onClick={() => showCommitDiff(cm.hash, cm.subject)}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                                {cm.subject}
                              </span>
                              <span className="shrink-0 font-mono text-xs text-muted-foreground">
                                {cm.shortHash}
                              </span>
                            </div>
                            <div className="mt-0.5 text-xs text-muted-foreground">
                              {cm.authorName}
                              {formatDate(cm.authoredAt) && ` · ${formatDate(cm.authoredAt)}`}
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">Nenhum commit ainda.</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Branches: lista, troca e criação ── */}
            <TabsContent value="branches">
              <Card>
                <CardHeader>
                  <CardTitle>Branches</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {branches.length > 0 ? (
                    <ul className="max-h-72 space-y-1 overflow-y-auto rounded-md border p-2">
                      {branches.map((b) => (
                        <li
                          key={b.name}
                          className="flex items-center justify-between gap-2 rounded px-2 py-1 hover:bg-accent"
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="truncate font-mono text-sm">{b.name}</span>
                            {b.isCurrent && <Badge variant="secondary">atual</Badge>}
                          </span>
                          {!b.isCurrent && (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={busy}
                              onClick={() => checkout(b.name)}
                            >
                              Trocar
                            </Button>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">Nenhuma branch.</p>
                  )}

                  <div className="flex gap-2">
                    <Input
                      placeholder="Nome da nova branch"
                      value={newBranch}
                      onChange={(e) => setNewBranch(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void handleCreateBranch();
                      }}
                    />
                    <Button disabled={busy || !newBranch.trim()} onClick={handleCreateBranch}>
                      Criar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </Column>

      {/* Diálogo de diff (arquivo do working tree ou commit) */}
      <Dialog open={selectedDiff !== null} onOpenChange={(open) => !open && clearDiff()}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="truncate font-mono text-sm">{selectedDiff?.title}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[70vh] space-y-4 overflow-y-auto">
            {selectedDiff?.files.length === 0 && (
              <p className="text-sm text-muted-foreground">Sem alterações neste diff.</p>
            )}
            {selectedDiff?.files.map((f) => (
              <div key={f.path} className="space-y-1">
                {selectedDiff.files.length > 1 && (
                  <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                    <span className="truncate">{f.path}</span>
                    <span>{STATUS_LABEL[f.status] ?? f.status}</span>
                  </div>
                )}
                {f.isBinary ? (
                  <p className="text-sm text-muted-foreground italic">Arquivo binário.</p>
                ) : (
                  <div className="rounded-md border p-2 text-xs">
                    <UnifiedDiff
                      lines={computeDiff(f.oldText, f.newText)}
                      emptyLabel="Sem diferenças."
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </Container>
  );
}
