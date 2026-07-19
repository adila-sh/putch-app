import { expect, test } from "vitest";
import { renderApp } from "@/test/render-app";

const collections = [
  {
    id: "billing",
    name: "Billing API",
    description: "Cobranças e faturas",
    pinned: true,
    deprecated: false,
    request_count: 8,
    created_at: "2026-01-10T10:00:00Z",
    updated_at: "2026-07-18T10:00:00Z",
  },
  {
    id: "legacy",
    name: "Legacy API",
    description: "Integração antiga",
    pinned: false,
    deprecated: true,
    request_count: 2,
    created_at: "2025-01-10T10:00:00Z",
    updated_at: "2026-01-10T10:00:00Z",
  },
];

test("lista e busca coleções carregadas do backend", async () => {
  const screen = await renderApp("/panel/collections", { collections });

  await expect.element(screen.getByRole("heading", { name: "Coleções" })).toBeVisible();
  await expect.element(screen.getByText("Billing API")).toBeVisible();
  await expect.element(screen.getByText("Legacy API")).toBeVisible();

  await screen.getByRole("textbox", { name: "Buscar coleções" }).fill("billing");

  await expect.element(screen.getByText("Billing API")).toBeVisible();
  await expect.element(screen.getByText("Legacy API")).not.toBeInTheDocument();
});

test("mostra o estado vazio quando ainda não há coleções", async () => {
  const screen = await renderApp("/panel/collections");

  await expect.element(screen.getByText("Nenhuma coleção encontrada")).toBeVisible();
  await expect.element(screen.getByRole("button", { name: "Criar coleção" })).toBeVisible();
});
