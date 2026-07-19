import { renderApp } from "@/test/render-app";
import { expect, test } from "vitest";

const CHOOSE_WORKSPACE = 3479207848;
const RESET_WORKSPACE = 1497618514;

test("persiste tema, escala e redução de animações", async () => {
  const screen = await renderApp("/panel/settings");

  await screen.getByRole("button", { name: /Ultra White/ }).click();
  await screen.getByRole("button", { name: /Ampliada/ }).click();
  await screen.getByRole("button", { name: /Reduzidas/ }).click();

  await expect.poll(() => document.documentElement.dataset.theme).toBe("ultra-white");
  await expect.poll(() => document.documentElement.style.fontSize).toBe("18px");
  await expect.poll(() => document.documentElement.dataset.reduceMotion).toBe("true");
});

test("altera e restaura a pasta do workspace", async () => {
  const screen = await renderApp("/panel/settings", {
    workspacePath: "/dados/putch",
    workspaceChosenPath: "/dados/equipe",
    workspaceDefaultPath: "/dados/padrao",
  });

  await screen.getByRole("tab", { name: "Workspace" }).click();
  await expect.element(screen.getByText("/dados/putch")).toBeVisible();
  await screen.getByRole("button", { name: /Alterar pasta/ }).click();
  await expect.element(screen.getByText("/dados/equipe")).toBeVisible();
  await screen.getByRole("button", { name: "Restaurar padrão" }).click();
  await expect.element(screen.getByText("/dados/padrao")).toBeVisible();

  expect(screen.wailsCalls.some((call) => call.methodID === CHOOSE_WORKSPACE)).toBe(true);
  expect(screen.wailsCalls.some((call) => call.methodID === RESET_WORKSPACE)).toBe(true);
});
