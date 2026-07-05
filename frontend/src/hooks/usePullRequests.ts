import { usePullRequestsStore } from "@/stores/pull-requests.store";
import { useShallow } from "zustand/react/shallow";

/**
 * Lê o estado de pull requests / code review via selectors.
 * O carregamento inicial acontece no `loader` da rota, não em useEffect.
 */
export function usePullRequests() {
  return usePullRequestsStore(
    useShallow((s) => ({
      list: s.list,
      stateFilter: s.stateFilter,
      detail: s.detail,
      files: s.files,
      commits: s.commits,
      reviews: s.reviews,
      reviewComments: s.reviewComments,
      issueComments: s.issueComments,
      loading: s.loading,
      busy: s.busy,
      error: s.error,

      loadList: s.loadList,
      setFilter: s.setFilter,
      loadDetail: s.loadDetail,
      clearDetail: s.clearDetail,
      createPr: s.createPr,
      comment: s.comment,
      submitReview: s.submitReview,
      reply: s.reply,
      merge: s.merge,
    })),
  );
}
