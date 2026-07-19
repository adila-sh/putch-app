import { Service as AuthService } from "@bindings/auth";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEnvironmentsStore } from "@/stores/environments.store";
import { useWorkspacesStore } from "@/stores/workspaces.store";
import PanelLayout from "./-layout";

export const Route = createFileRoute("/panel")({
  beforeLoad: async () => {
    const session = await AuthService.Status();
    if (!session.authenticated) {
      throw redirect({ to: "/auth", replace: true });
    }
  },
  // Workspaces e environments carregados no nível do painel: os switchers da
  // sidebar (workspace ativo + ambiente ativo daquele workspace) ficam
  // disponíveis em todas as páginas. Ao trocar de workspace o router invalida
  // estas rotas e os environments recarregam no escopo do novo workspace.
  loader: () =>
    Promise.all([useWorkspacesStore.getState().load(), useEnvironmentsStore.getState().load()]),
  component: PanelLayout,
});
