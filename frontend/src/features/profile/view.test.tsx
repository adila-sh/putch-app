import { renderApp } from "@/test/render-app";
import { expect, test } from "vitest";

test("mostra a conta autenticada e o estado de sincronização", async () => {
  const screen = await renderApp("/panel/profile", {
    syncAccount: {
      authenticated: true,
      login: "ana",
      name: "Ana Souza",
      avatarUrl: "",
    },
    syncStatus: {
      isRepo: true,
      branch: "main",
      hasRemote: true,
      remoteUrl: "https://github.com/acme/api.git",
      ahead: 2,
      behind: 1,
      clean: false,
      files: [],
    },
  });

  await expect.element(screen.getByText("Ana Souza")).toBeVisible();
  await expect.element(screen.getByText("@ana")).toBeVisible();
  await expect.element(screen.getByText("conectado")).toBeVisible();
  await expect.element(screen.getByText("main")).toBeVisible();
  await expect.element(screen.getByText("alterações pendentes")).toBeVisible();
});
