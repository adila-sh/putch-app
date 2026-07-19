import { Service as AuthService, State as AuthState } from "@bindings/auth";
import { ErrorAlert } from "@/components/functional/error-alert";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Column,
  Container,
  Label,
  Row,
  Title,
} from "@/components/ui";
import { Button } from "@/components/ui/button";
import { useSync } from "@/hooks/useSync";
import { useNavigate } from "@tanstack/react-router";
import { CircleUser, GitBranch, KeyRound, LogIn, LogOut, Settings2 } from "lucide-react";
import { useEffect, useState } from "react";

export default function ProfileView() {
  const navigate = useNavigate();
  const { account, status, device, busy, error, startLogin, cancelLogin, logout } = useSync();
  const [identity, setIdentity] = useState<AuthState | null>(null);
  const [identityBusy, setIdentityBusy] = useState(false);

  useEffect(() => {
    void AuthService.Status().then(setIdentity);
  }, []);

  async function logoutIdentity() {
    setIdentityBusy(true);
    await AuthService.Logout();
    await navigate({ to: "/auth", replace: true });
  }

  const authed = account?.authenticated === true;

  return (
    <Container className="p-6">
      <Column>
        <Title>Conta</Title>
        <Label>Sua conta do GitHub e o estado de sincronização deste workspace.</Label>

        {error && <ErrorAlert message={error} />}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CircleUser strokeWidth={1.5} className="size-4" />
              Adila
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Row className="items-center justify-between gap-4">
              <Column className="gap-0.5">
                <span className="font-medium">{identity?.user?.name || "Conta Adila"}</span>
                <span className="text-sm text-muted-foreground">{identity?.user?.email}</span>
              </Column>
              <Button
                variant="outline"
                size="sm"
                disabled={identityBusy}
                onClick={() => void logoutIdentity()}
              >
                <LogOut strokeWidth={1.5} />
                Sair da Adila
              </Button>
            </Row>
          </CardContent>
        </Card>

        {/* Identidade GitHub */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound strokeWidth={1.5} className="size-4" />
              GitHub
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {authed ? (
              <Row className="items-center justify-between">
                <Row className="items-center gap-3">
                  {account?.avatarUrl ? (
                    <img
                      src={account.avatarUrl}
                      alt={account.login}
                      className="size-12 rounded-full"
                    />
                  ) : (
                    <CircleUser strokeWidth={1.5} className="size-12 text-muted-foreground" />
                  )}
                  <Column className="gap-0.5">
                    <span className="font-medium">{account?.name || account?.login}</span>
                    <span className="text-sm text-muted-foreground">@{account?.login}</span>
                  </Column>
                </Row>
                <Column className="items-end gap-2">
                  <Badge>conectado</Badge>
                  <Button variant="outline" size="sm" disabled={busy} onClick={() => logout()}>
                    <LogOut strokeWidth={1.5} />
                    Sair
                  </Button>
                </Column>
              </Row>
            ) : device ? (
              <Column className="gap-3">
                <p className="text-sm">
                  Acesse{" "}
                  <a
                    href={device.verificationUri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-primary underline"
                  >
                    {device.verificationUri}
                  </a>{" "}
                  e informe o código:
                </p>
                <div className="rounded-md border bg-muted px-4 py-3 text-center font-mono text-2xl tracking-widest">
                  {device.userCode}
                </div>
                <Button variant="ghost" size="sm" onClick={() => cancelLogin()}>
                  Cancelar
                </Button>
              </Column>
            ) : (
              <Column className="gap-3">
                <p className="text-sm text-muted-foreground">
                  Conecte-se ao GitHub para versionar collections e colaborar via pull requests.
                </p>
                <Button disabled={busy} onClick={() => startLogin()} className="self-start">
                  <LogIn strokeWidth={1.5} />
                  Conectar ao GitHub
                </Button>
              </Column>
            )}
          </CardContent>
        </Card>

        {/* Sincronização deste workspace */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GitBranch strokeWidth={1.5} className="size-4" />
              Sincronização
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {status?.isRepo ? (
              <Column className="gap-2 text-sm">
                <Row className="items-center gap-2">
                  <span className="text-muted-foreground">Branch:</span>
                  <span className="font-mono">{status.branch || "—"}</span>
                  {status.hasRemote ? (
                    <Badge variant="secondary">com remoto</Badge>
                  ) : (
                    <Badge variant="outline">sem remoto</Badge>
                  )}
                </Row>
                {status.hasRemote && (
                  <Row className="items-center gap-2">
                    <span className="text-muted-foreground">Remoto:</span>
                    {/* remoteUrl já vem sanitizada (sem token) do backend */}
                    <span className="min-w-0 truncate font-mono">{status.remoteUrl}</span>
                  </Row>
                )}
                <Row className="items-center gap-4">
                  <span>
                    <span className="text-muted-foreground">À frente:</span> {status.ahead}
                  </span>
                  <span>
                    <span className="text-muted-foreground">Atrás:</span> {status.behind}
                  </span>
                  <Badge variant={status.clean ? "secondary" : "default"}>
                    {status.clean ? "sem alterações" : "alterações pendentes"}
                  </Badge>
                </Row>
              </Column>
            ) : (
              <p className="text-sm text-muted-foreground">
                Este workspace ainda não é um repositório git. Conecte um remoto no painel de
                sincronização para começar a versionar.
              </p>
            )}
            <Row className="gap-2 pt-1">
              <Button type="link" to="/panel/git" variant="outline" size="sm">
                <GitBranch strokeWidth={1.5} />
                Abrir sincronização
              </Button>
              <Button type="link" to="/panel/settings" variant="ghost" size="sm">
                <Settings2 strokeWidth={1.5} />
                Definições
              </Button>
            </Row>
          </CardContent>
        </Card>
      </Column>
    </Container>
  );
}
