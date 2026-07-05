import {
  type IssueComment,
  type PullRequestCommit,
  type PullRequestDetail,
  type PullRequestFile,
  type PullRequestReview,
  type PullRequestSummary,
  PullRequestsService,
  type ReviewComment,
} from "@/services/pull-requests.service";
import { create } from "zustand";

function msg(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

// Filtro de estado da lista de PRs — espelha os valores aceitos pela API do
// GitHub (open/closed/all).
export type PrStateFilter = "open" | "closed" | "all";

// Evento de review submetida: APPROVE aprova, REQUEST_CHANGES pede mudanças,
// COMMENT só comenta (sem veredito).
export type ReviewEvent = "APPROVE" | "REQUEST_CHANGES" | "COMMENT";

interface PullRequestsState {
  list: PullRequestSummary[];
  stateFilter: PrStateFilter;

  // Detalhe do PR aberto e seus agregados (arquivos, commits, reviews,
  // comentários inline e de timeline).
  detail: PullRequestDetail | null;
  files: PullRequestFile[];
  commits: PullRequestCommit[];
  reviews: PullRequestReview[];
  reviewComments: ReviewComment[];
  issueComments: IssueComment[];

  loading: boolean; // carga de lista/detalhe
  busy: boolean; // ação de escrita em andamento
  error: string | null;

  loadList: () => Promise<void>;
  setFilter: (state: PrStateFilter) => Promise<void>;

  loadDetail: (number: number) => Promise<void>;
  clearDetail: () => void;

  createPr: (base: string, head: string, title: string, body: string) => Promise<number | null>;
  comment: (number: number, body: string) => Promise<void>;
  submitReview: (number: number, event: ReviewEvent, body: string) => Promise<void>;
  reply: (number: number, inReplyTo: number, body: string) => Promise<void>;
  merge: (number: number, method: string) => Promise<void>;
}

export const usePullRequestsStore = create<PullRequestsState>((set, get) => ({
  list: [],
  stateFilter: "open",
  detail: null,
  files: [],
  commits: [],
  reviews: [],
  reviewComments: [],
  issueComments: [],
  loading: false,
  busy: false,
  error: null,

  loadList: async () => {
    set({ loading: true, error: null });
    try {
      const list = await PullRequestsService.list(get().stateFilter);
      set({ list, loading: false });
    } catch (err) {
      // Sem login/remoto GitHub o facade devolve erro de domínio — mostra e
      // zera a lista em vez de deixar dados velhos.
      set({ error: msg(err, "Falha ao listar pull requests"), list: [], loading: false });
    }
  },

  setFilter: async (state) => {
    set({ stateFilter: state });
    await get().loadList();
  },

  loadDetail: async (number) => {
    set({ loading: true, error: null });
    try {
      const [detail, files, commits, reviews, reviewComments, issueComments] = await Promise.all([
        PullRequestsService.get(number),
        PullRequestsService.files(number),
        PullRequestsService.commits(number),
        PullRequestsService.reviews(number),
        PullRequestsService.reviewComments(number),
        PullRequestsService.issueComments(number),
      ]);
      set({ detail, files, commits, reviews, reviewComments, issueComments, loading: false });
    } catch (err) {
      set({ error: msg(err, "Falha ao carregar o pull request"), loading: false });
    }
  },

  clearDetail: () =>
    set({
      detail: null,
      files: [],
      commits: [],
      reviews: [],
      reviewComments: [],
      issueComments: [],
    }),

  createPr: async (base, head, title, body) => {
    set({ busy: true, error: null });
    try {
      const pr = await PullRequestsService.create(base, head, title, body);
      await get().loadList();
      return pr?.number ?? null;
    } catch (err) {
      set({ error: msg(err, "Falha ao criar o pull request") });
      throw err;
    } finally {
      set({ busy: false });
    }
  },

  comment: async (number, body) => {
    set({ busy: true, error: null });
    try {
      await PullRequestsService.comment(number, body);
      const issueComments = await PullRequestsService.issueComments(number);
      set({ issueComments });
    } catch (err) {
      set({ error: msg(err, "Falha ao comentar") });
      throw err;
    } finally {
      set({ busy: false });
    }
  },

  submitReview: async (number, event, body) => {
    set({ busy: true, error: null });
    try {
      await PullRequestsService.review(number, event, body);
      // Review muda o estado do PR (mergeable, contadores) e a lista de reviews.
      const [reviews, detail] = await Promise.all([
        PullRequestsService.reviews(number),
        PullRequestsService.get(number),
      ]);
      set({ reviews, detail });
    } catch (err) {
      set({ error: msg(err, "Falha ao enviar a review") });
      throw err;
    } finally {
      set({ busy: false });
    }
  },

  reply: async (number, inReplyTo, body) => {
    set({ busy: true, error: null });
    try {
      await PullRequestsService.replyToReviewComment(number, inReplyTo, body);
      const reviewComments = await PullRequestsService.reviewComments(number);
      set({ reviewComments });
    } catch (err) {
      set({ error: msg(err, "Falha ao responder o comentário") });
      throw err;
    } finally {
      set({ busy: false });
    }
  },

  merge: async (number, method) => {
    set({ busy: true, error: null });
    try {
      await PullRequestsService.merge(number, method);
      // Merge fecha o PR: recarrega detalhe e lista para refletir o novo estado.
      const [detail] = await Promise.all([PullRequestsService.get(number), get().loadList()]);
      set({ detail });
    } catch (err) {
      set({ error: msg(err, "Falha ao mesclar o pull request") });
      throw err;
    } finally {
      set({ busy: false });
    }
  },
}));
