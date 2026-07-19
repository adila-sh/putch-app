import { renderApp } from "@/test/render-app";
import { expect, test } from "vitest";

test("abre o portal centralizado quando não há sessão", async () => {
  const screen = await renderApp("/auth", { authenticated: false });

  await expect.element(screen.getByText("Abrindo Adila Auth")).toBeVisible();
  await expect.poll(() => screen.wailsCalls.some((call) => call.methodID === 1051065329)).toBe(true);
});

test("a raiz envia uma sessão válida para o painel", async () => {
  const screen = await renderApp("/", { authenticated: true });

  await expect.element(screen.getByText("Coleções").first()).toBeVisible();
  expect(screen.wailsCalls.some((call) => call.methodID === 1828880498)).toBe(true);
});

test("a raiz envia visitante para autenticação", async () => {
  const screen = await renderApp("/", { authenticated: false });

  await expect.element(screen.getByText("Abrindo Adila Auth")).toBeVisible();
  await expect.poll(() => screen.wailsCalls.some((call) => call.methodID === 1051065329)).toBe(true);
});

test("bloqueia acesso direto ao painel sem sessão", async () => {
  const screen = await renderApp("/panel/collections", { authenticated: false });

  await expect.element(screen.getByText("Abrindo Adila Auth")).toBeVisible();
});

test("callback sem token exibe erro recuperável", async () => {
  const screen = await renderApp("/auth/callback");

  await expect.element(screen.getByText("Login não concluído")).toBeVisible();
  await expect.element(screen.getByRole("button", { name: "Voltar ao login" })).toBeVisible();
});
