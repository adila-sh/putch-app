import { SyncService as Wails } from "@bindings/services";

// Fluxo de PR / code review (Fase 3). Os DTOs vêm do binding do pacote github;
// reexportados aqui para a UI importar de um lugar só. Todos os métodos do
// facade resolvem owner/repo do remoto do workspace, então a UI só passa o
// número do PR (e o payload de escrita) — nunca vê o token.
export type {
  IssueComment,
  PullRequestCommit,
  PullRequestDetail,
  PullRequestFile,
  PullRequestInfo,
  PullRequestReview,
  PullRequestSummary,
  ReviewComment,
  ReviewCommentInput,
} from "@bindings/github";

export const PullRequestsService = {
  // Leitura (3a)
  list: (state: string) => Wails.ListPullRequests(state),
  get: (number: number) => Wails.GetPullRequest(number),
  files: (number: number) => Wails.ListPullRequestFiles(number),
  commits: (number: number) => Wails.ListPullRequestCommits(number),
  reviews: (number: number) => Wails.ListReviews(number),
  reviewComments: (number: number) => Wails.ListReviewComments(number),
  issueComments: (number: number) => Wails.ListIssueComments(number),

  // Escrita (3b)
  create: (base: string, head: string, title: string, body: string) =>
    Wails.CreatePullRequest(base, head, title, body),
  comment: (number: number, body: string) => Wails.CreateIssueComment(number, body),
  review: (number: number, event: string, body: string) =>
    Wails.CreateReview(number, event, body, []),
  reviewComment: (
    number: number,
    commitID: string,
    path: string,
    line: number,
    side: string,
    body: string,
  ) => Wails.CreateReviewComment(number, commitID, path, line, side, body),
  replyToReviewComment: (number: number, inReplyTo: number, body: string) =>
    Wails.ReplyToReviewComment(number, inReplyTo, body),
  merge: (number: number, method: string) => Wails.MergePullRequest(number, method),
};
