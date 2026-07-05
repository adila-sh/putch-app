import { createFileRoute } from "@tanstack/react-router";
import GitView from "@/features/git/view";
import { useSyncStore } from "@/stores/sync.store";

export const Route = createFileRoute("/panel/git/")({
  loader: async () => {
    const s = useSyncStore.getState();
    await s.load();
    // Histórico e branches só fazem sentido com repo; as ações já viram no-op
    // fora dele, então basta dispará-las após o status resolver.
    await Promise.all([s.loadHistory(), s.loadBranches()]);
  },
  component: GitView,
});
