import { expect, test } from "vitest";
import { renderApp } from "@/test/render-app";

const environments = [
  {
    id: "production",
    name: "Produção",
    description: "Serviços públicos",
    variables: { API_URL: "https://api.example.com", TOKEN: "secret" },
    pinned: true,
    deprecated: false,
    created_at: "2026-01-10T10:00:00Z",
    updated_at: "2026-07-18T10:00:00Z",
  },
  {
    id: "legacy",
    name: "Legado",
    description: "Ambiente descontinuado",
    variables: {},
    pinned: false,
    deprecated: true,
    created_at: "2025-01-10T10:00:00Z",
    updated_at: "2026-01-10T10:00:00Z",
  },
];

test("busca ambientes pelo nome", async () => {
  const screen = await renderApp("/panel/environments", { environments });

  await expect
    .element(screen.getByRole("heading", { name: "Variáveis de ambiente" }))
    .toBeVisible();
  await expect.element(screen.getByText("Produção")).toBeVisible();
  await expect.element(screen.getByText("Legado")).toBeVisible();

  await screen.getByRole("textbox", { name: "Buscar ambientes" }).fill("produção");

  await expect.element(screen.getByText("Produção")).toBeVisible();
  await expect.element(screen.getByText("Legado")).not.toBeInTheDocument();
});

test("filtra somente ambientes depreciados", async () => {
  const screen = await renderApp("/panel/environments", { environments });

  await screen.getByRole("tab", { name: "Depreciados" }).click();

  await expect.element(screen.getByText("Legado")).toBeVisible();
  await expect.element(screen.getByText("Produção")).not.toBeInTheDocument();
});
