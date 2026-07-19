import { useHistoryStore } from "@/stores/history.store";
import { renderApp } from "@/test/render-app";
import { RequestConfig, ResponseData } from "@bindings/services";
import { afterEach, expect, test } from "vitest";

afterEach(() => useHistoryStore.getState().clear());

test("registra, detalha e remove uma execução do histórico", async () => {
  useHistoryStore.getState().clear();
  useHistoryStore.getState().record({
    config: new RequestConfig({
      method: "POST",
      url: "https://api.example.com/orders",
      headers: { authorization: "Bearer token" },
      body: '{"amount":42}',
    }),
    response: new ResponseData({
      status: 201,
      headers: { "content-type": "application/json" },
      body: '{"id":"order-1"}',
      duration_ms: 85,
    }),
  });

  const screen = await renderApp("/panel/history");

  await expect.element(screen.getByText("https://api.example.com/orders")).toBeVisible();
  await expect.element(screen.getByText("201")).toBeVisible();
  await screen.getByText("https://api.example.com/orders").click();
  await expect.element(screen.getByText("Request body")).toBeVisible();
  await expect.element(screen.getByText('{"id":"order-1"}')).toBeVisible();
  await screen.getByTitle("Remover do histórico").click();
  await expect.element(screen.getByText("Nenhuma requisição ainda")).toBeVisible();
});

test("limpa todas as execuções após confirmação", async () => {
  useHistoryStore.getState().clear();
  useHistoryStore.getState().record({
    config: new RequestConfig({ method: "GET", url: "https://api.example.com/health" }),
    error: "offline",
  });

  const screen = await renderApp("/panel/history");
  await screen.getByRole("button", { name: "Limpar histórico" }).click();
  await screen.getByRole("button", { name: "Limpar" }).click();
  await expect.element(screen.getByText("Nenhuma requisição ainda")).toBeVisible();
});
