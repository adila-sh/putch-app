import PullRequestsList from "@/features/pull-requests/list";
import { usePullRequestsStore } from "@/stores/pull-requests.store";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/panel/git/pull-requests/")({
  loader: () => usePullRequestsStore.getState().loadList(),
  component: PullRequestsList,
});
