import { TooltipProvider } from "@/components/ui/tooltip";
import { PreferencesProvider } from "@/contexts/preferences.context";
import { ThemeProvider } from "@/contexts/theme.context";
import "@/globals.css";
import { routeTree } from "@/routeTree.gen";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { setTransport, type RuntimeTransport } from "@wailsio/runtime";
import { render } from "vitest-browser-react";

const METHOD = {
  authComplete: 3618535367,
  authLogout: 3583323782,
  authStartLogin: 1051065329,
  authStatus: 1828880498,
  collectionsCreate: 2084708613,
  collectionsFindAll: 4243907705,
  collectionsFindByID: 2654200150,
  collectionsUpdate: 3600698108,
  environmentsCreate: 2447251272,
  environmentsFindAll: 3781922170,
  environmentsUpdate: 2358908509,
  foldersFindByCollectionID: 1268793018,
  foldersGetOrders: 2226501538,
  requestsFindAll: 2286483754,
  requestsFindByCollectionID: 4214591943,
  requestsCreate: 1873506200,
  requestsSend: 1632454770,
  testsFindAll: 957369605,
  testsCreate: 2930607881,
  testsRun: 1192741990,
  workspaceChoose: 3479207848,
  workspaceGetPath: 545074776,
  workspaceReset: 1497618514,
  workspacesCreate: 168728580,
  workspacesFindAll: 2684998398,
  workspacesUpdate: 1425478529,
  syncGitHub: 3916722846,
  syncStatus: 1506582571,
  syncConnectRemote: 1055202155,
  syncCloneWorkspace: 239914799,
  pullRequestsList: 3592563856,
  pullRequestsCreate: 3777235463,
  pullRequestsGet: 1523842093,
  pullRequestFiles: 1836861674,
  pullRequestCommits: 3245035211,
  pullRequestReviews: 2245991334,
  pullRequestReviewComments: 3193575795,
  pullRequestIssueComments: 1849240722,
  pullRequestComment: 453466681,
  pullRequestReview: 1015796837,
  pullRequestMerge: 1142982069,
} as const;

interface BackendState {
  authenticated?: boolean;
  authUser?: unknown;
  collectionCreated?: unknown;
  collections?: unknown[];
  environmentCreated?: unknown;
  environments?: unknown[];
  requests?: unknown[];
  requestCreated?: unknown;
  responseSent?: unknown;
  tests?: unknown[];
  testCreated?: unknown;
  testRunResult?: unknown;
  workspaceChosenPath?: string;
  workspaceDefaultPath?: string;
  workspacePath?: string;
  workspaceCreated?: unknown;
  workspaces?: unknown[];
  syncAccount?: unknown;
  syncStatus?: unknown;
  pullRequests?: unknown[];
  pullRequestCreated?: unknown;
  pullRequestDetail?: unknown;
}

export interface WailsCall {
  methodID: number;
  args: unknown[];
}

function mockTransport(state: BackendState, calls: WailsCall[]): RuntimeTransport {
  return {
    async call(objectID, method, _windowName, args) {
      // Binding calls chegam ao runtime como Call.Call: objectID=0,
      // method=0 e o ID real do método Go dentro do payload.
      if (objectID !== 0 || method !== 0 || typeof args?.methodID !== "number") {
        throw new Error(`Chamada inesperada ao objeto Wails ${objectID}, método ${method}`);
      }

      const callArgs = Array.isArray(args.args) ? args.args : [];
      calls.push({ methodID: args.methodID, args: callArgs });

      switch (args.methodID) {
        case METHOD.authComplete:
          return {
            authenticated: true,
            user: state.authUser ?? {
              id: "user-1",
              name: "Ada",
              email: "ada@adila.co",
            },
            expires_at: "2026-07-20T00:00:00Z",
          };
        case METHOD.authLogout:
        case METHOD.authStartLogin:
          return undefined;
        case METHOD.authStatus:
          return {
            authenticated: state.authenticated ?? true,
            user:
              state.authUser ??
              (state.authenticated === false
                ? undefined
                : { id: "user-1", name: "Ada", email: "ada@adila.co" }),
            expires_at: "2026-07-20T00:00:00Z",
          };
        case METHOD.collectionsCreate:
          return (
            state.collectionCreated ?? {
              ...(callArgs[0] as object),
              id: "created-collection",
              request_count: 0,
            }
          );
        case METHOD.collectionsFindAll:
          return state.collections ?? [];
        case METHOD.collectionsFindByID:
          return (
            state.collections?.find(
              (collection) =>
                typeof collection === "object" &&
                collection !== null &&
                "id" in collection &&
                collection.id === callArgs[0],
            ) ?? {
              id: callArgs[0],
              name: "Coleção",
              description: "",
              bg: 0,
              request_count: 0,
            }
          );
        case METHOD.collectionsUpdate:
          return undefined;
        case METHOD.environmentsCreate:
          return (
            state.environmentCreated ?? {
              ...(callArgs[0] as object),
              id: "created-environment",
            }
          );
        case METHOD.environmentsFindAll:
          return state.environments ?? [];
        case METHOD.environmentsUpdate:
          return undefined;
        case METHOD.foldersFindByCollectionID:
          return [];
        case METHOD.requestsFindByCollectionID:
          return state.requests ?? [];
        case METHOD.foldersGetOrders:
          return {};
        case METHOD.requestsFindAll:
          return state.requests ?? [];
        case METHOD.requestsCreate:
          return (
            state.requestCreated ?? {
              ...(callArgs[0] as object),
              id: "created-request",
            }
          );
        case METHOD.requestsSend:
          return (
            state.responseSent ?? {
              status: 200,
              headers: { "content-type": "application/json" },
              body: "{}",
              duration_ms: 1,
            }
          );
        case METHOD.testsFindAll:
          return state.tests ?? [];
        case METHOD.testsCreate:
          return (
            state.testCreated ?? {
              ...(callArgs[0] as object),
              id: "created-test",
              workspace_id: "workspace-1",
              created_at: "2026-07-19T00:00:00Z",
            }
          );
        case METHOD.testsRun:
          return (
            state.testRunResult ?? {
              test_id: callArgs[0],
              passed: true,
              steps: [],
            }
          );
        case METHOD.workspaceChoose:
          return state.workspaceChosenPath ?? "/workspace/escolhido";
        case METHOD.workspaceGetPath:
          return state.workspacePath ?? "/workspace/atual";
        case METHOD.workspaceReset:
          return state.workspaceDefaultPath ?? "/workspace/padrao";
        case METHOD.workspacesCreate:
          return (
            state.workspaceCreated ?? {
              ...(callArgs[0] as object),
              id: "created-workspace",
            }
          );
        case METHOD.workspacesFindAll:
          return state.workspaces ?? [];
        case METHOD.workspacesUpdate:
          return undefined;
        case METHOD.syncGitHub:
          return state.syncAccount ?? { authenticated: false };
        case METHOD.syncStatus:
          return (
            state.syncStatus ?? {
              isRepo: false,
              branch: "",
              hasRemote: false,
              remoteUrl: "",
              ahead: 0,
              behind: 0,
              clean: true,
              files: [],
            }
          );
        case METHOD.syncConnectRemote:
        case METHOD.syncCloneWorkspace:
          return undefined;
        case METHOD.pullRequestsList:
          return state.pullRequests ?? [];
        case METHOD.pullRequestsCreate:
          return (
            state.pullRequestCreated ?? {
              number: 42,
              title: callArgs[2],
              state: "open",
              head: callArgs[1],
              base: callArgs[0],
            }
          );
        case METHOD.pullRequestsGet:
          return state.pullRequestDetail ?? state.pullRequestCreated ?? null;
        case METHOD.pullRequestFiles:
        case METHOD.pullRequestCommits:
        case METHOD.pullRequestReviews:
        case METHOD.pullRequestReviewComments:
        case METHOD.pullRequestIssueComments:
          return [];
        case METHOD.pullRequestComment:
        case METHOD.pullRequestReview:
          return {};
        case METHOD.pullRequestMerge:
          return undefined;
        default:
          throw new Error(`Chamada inesperada ao método Wails ${args.methodID}`);
      }
    },
  };
}

export async function renderApp(path: string, state: BackendState = {}) {
  const wailsCalls: WailsCall[] = [];
  setTransport(mockTransport(state, wailsCalls));

  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
    defaultPreload: false,
  });

  const screen = await render(
    <ThemeProvider>
      <PreferencesProvider>
        <TooltipProvider>
          <RouterProvider router={router} />
        </TooltipProvider>
      </PreferencesProvider>
    </ThemeProvider>,
  );

  return Object.assign(screen, { wailsCalls });
}
