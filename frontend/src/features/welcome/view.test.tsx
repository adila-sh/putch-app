import { renderApp } from "@/test/render-app";
import { expect, test } from "vitest";

test("apresenta os principais caminhos de entrada do aplicativo", async () => {
  const screen = await renderApp("/panel/welcome");

  await expect.element(screen.getByRole("heading", { name: "Bem-vindo ao Putch" })).toBeVisible();
  await expect.element(screen.getByRole("link", { name: /Criar Workspace/ })).toBeVisible();
  await expect.element(screen.getByRole("button", { name: /Clonar repositório/ })).toBeVisible();
  await expect.element(screen.getByText("Acesso rápido")).toBeVisible();
});
