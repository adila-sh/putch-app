import { Service as AuthService } from "@bindings/auth";
import { Button } from "@/components/ui/button";
import { createFileRoute } from "@tanstack/react-router";
import { LoaderCircle, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/auth")({
  component: AuthScreen,
});

function AuthScreen() {
  const [error, setError] = useState("");

  function openPortal() {
    setError("");
    void AuthService.StartLogin().catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : "Não foi possível abrir o login.");
    });
  }

  useEffect(openPortal, []);

  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-6">
      <section className="flex max-w-sm flex-col items-center text-center">
        {error ? (
          <>
            <h1 className="text-xl font-semibold">Não foi possível abrir a autenticação</h1>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
            <Button className="mt-5" onClick={openPortal}>
              <RefreshCw className="size-4" />
              Tentar novamente
            </Button>
          </>
        ) : (
          <>
            <LoaderCircle className="size-7 animate-spin text-muted-foreground" />
            <h1 className="mt-4 text-xl font-semibold">Abrindo Adila Auth</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Entre com sua conta em auth.adila.co para continuar no Putch.
            </p>
          </>
        )}
      </section>
    </main>
  );
}
