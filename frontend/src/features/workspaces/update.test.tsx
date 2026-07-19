import { renderApp } from "@/test/render-app";
import { expect, test } from "vitest";

const UPDATE_WORKSPACE = 1425478529;

test("edita os dados visuais do workspace", async () => {
  const screen = await renderApp("/panel/workspaces/workspace-1/update", {
    workspaces: [
      {
        id: "workspace-1",
        name: "Equipe antiga",
        description: "",
        color: "#3b82f6",
        icon: "📦",
        pinned: false,
        is_active: true,
        created_at: "2026-07-19T00:00:00Z",
      },
    ],
  });

  await screen.getByPlaceholder("Meu workspace").fill("Equipe Core");
  await screen.getByRole("button", { name: "Cor #10b981" }).click();
  await screen.getByRole("button", { name: "Ícone 🔧" }).click();
  await screen.getByRole("button", { name: "Salvar" }).click();

  await expect
    .poll(() => screen.wailsCalls.find((call) => call.methodID === UPDATE_WORKSPACE)?.args)
    .toMatchObject(["workspace-1", { name: "Equipe Core", color: "#10b981", icon: "🔧" }]);
});
