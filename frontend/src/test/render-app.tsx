import { TooltipProvider } from "@/components/ui/tooltip";
import { PreferencesProvider } from "@/contexts/preferences.context";
import { ThemeProvider } from "@/contexts/theme.context";
import "@/globals.css";
import { routeTree } from "@/routeTree.gen";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { setTransport, type RuntimeTransport } from "@wailsio/runtime";
import { render } from "vitest-browser-react";

const METHOD = {
  collectionsFindAll: 4243907705,
  environmentsFindAll: 3781922170,
  workspacesFindAll: 2684998398,
} as const;

interface BackendState {
  collections?: unknown[];
  environments?: unknown[];
  workspaces?: unknown[];
}

function mockTransport(state: BackendState): RuntimeTransport {
  return {
    async call(objectID, method, _windowName, args) {
      // Binding calls chegam ao runtime como Call.Call: objectID=0,
      // method=0 e o ID real do método Go dentro do payload.
      if (objectID !== 0 || method !== 0 || typeof args?.methodID !== "number") {
        throw new Error(`Chamada inesperada ao objeto Wails ${objectID}, método ${method}`);
      }

      switch (args.methodID) {
        case METHOD.collectionsFindAll:
          return state.collections ?? [];
        case METHOD.environmentsFindAll:
          return state.environments ?? [];
        case METHOD.workspacesFindAll:
          return state.workspaces ?? [];
        default:
          throw new Error(`Chamada inesperada ao método Wails ${args.methodID}`);
      }
    },
  };
}

export async function renderApp(path: string, state: BackendState = {}) {
  setTransport(mockTransport(state));

  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
    defaultPreload: false,
  });

  return render(
    <ThemeProvider>
      <PreferencesProvider>
        <TooltipProvider>
          <RouterProvider router={router} />
        </TooltipProvider>
      </PreferencesProvider>
    </ThemeProvider>,
  );
}
