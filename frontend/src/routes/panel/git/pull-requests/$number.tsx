import PullRequestDetail from "@/features/pull-requests/detail";
import { usePullRequestsStore } from "@/stores/pull-requests.store";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/panel/git/pull-requests/$number")({
  loader: ({ params }) => {
    const number = Number.parseInt(params.number, 10);
    const store = usePullRequestsStore.getState();
    store.clearDetail();
    if (Number.isNaN(number)) return;
    return store.loadDetail(number);
  },
  component: PullRequestDetail,
});
