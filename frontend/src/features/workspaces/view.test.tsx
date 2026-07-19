import { renderApp } from "@/test/render-app";
import { expect, test } from "vitest";

const workspaces = [
  {
    id: "main",
    name: "Principal",
    description: "APIs da equipe",
    pinned: true,
    is_active: true,
    created_at: "2026-01-10T10:00:00Z",
    updated_at: "2026-07-18T10:00:00Z",
  },
  {
    id: "mobile",
    name: "Mobile",
    description: "Aplicativos móveis",
    pinned: false,
    is_active: false,
    created_at: "2026-02-10T10:00:00Z",
    updated_at: "2026-06-18T10:00:00Z",
  },
];

test("lista workspaces e apresenta estado vazio para uma busca sem resultado", async () => {
  const screen = await renderApp("/panel/workspaces", { workspaces });

  await expect.element(screen.getByRole("heading", { name: "Workspaces" })).toBeVisible();
  await expect.element(screen.getByText("Mobile")).toBeVisible();

  await screen.getByRole("textbox", { name: "Buscar workspaces" }).fill("inexistente");

  await expect.element(screen.getByText("Nenhum workspace encontrado")).toBeVisible();
});

test("filtra somente o workspace ativo", async () => {
  const screen = await renderApp("/panel/workspaces", { workspaces });

  await screen.getByRole("tab", { name: "Ativo" }).click();

  await expect.element(screen.getByText("Mobile")).not.toBeInTheDocument();
  await expect.element(screen.getByText("APIs da equipe")).toBeVisible();
});
