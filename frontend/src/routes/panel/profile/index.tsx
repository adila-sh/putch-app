import { createFileRoute } from "@tanstack/react-router";
import ProfileView from "@/features/profile/view";
import { useSyncStore } from "@/stores/sync.store";

export const Route = createFileRoute("/panel/profile/")({
  // Conta + status de sync vêm do mesmo store do painel Git.
  loader: () => useSyncStore.getState().load(),
  component: ProfileView,
});
