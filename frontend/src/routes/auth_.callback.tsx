import { Service as AuthService } from "@bindings/auth";
import { Button } from "@/components/ui/button";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CircleAlert, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/auth_/callback")({
  component: AuthCallback,
});

export function sessionTokenFromHash(hash: string): string {
  return new URLSearchParams(hash.replace(/^#/, "")).get("token")?.trim() ?? "";
}

function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState("");

  useEffect(() => {
    const token = sessionTokenFromHash(window.location.hash);
    if (!token) {
      setError("O Adila Auth não retornou uma sessão válida.");
      return;
    }

    // Remove o segredo da barra e do histórico antes da validação remota.
    window.history.replaceState(null, "", window.location.pathname);
    void AuthService.Complete(token)
      .then(() => navigate({ to: "/panel/collections", replace: true }))
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : "Não foi possível salvar a sessão.");
      });
  }, [navigate]);

  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-6">
      <section className="flex max-w-sm flex-col items-center text-center">
        {error ? (
          <>
            <CircleAlert className="size-8 text-destructive" />
            <h1 className="mt-4 text-xl font-semibold">Login não concluído</h1>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
            <Button className="mt-5" onClick={() => navigate({ to: "/auth", replace: true })}>
              Voltar ao login
            </Button>
          </>
        ) : (
          <>
            <LoaderCircle className="size-7 animate-spin text-muted-foreground" />
            <h1 className="mt-4 text-xl font-semibold">Salvando sua sessão</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Validando o acesso com Adila Identity…
            </p>
          </>
        )}
      </section>
    </main>
  );
}
