import { renderApp } from "@/test/render-app";
import { expect, test } from "vitest";

const LIST_PULL_REQUESTS = 3592563856;
const CREATE_PULL_REQUEST = 3777235463;

test("lista, filtra e cria pull request", async () => {
  const screen = await renderApp("/panel/git/pull-requests", {
    pullRequests: [
      {
        number: 17,
        title: "Adicionar autenticação",
        state: "open",
        head: "feature/auth",
        base: "main",
        author: "ana",
        avatarUrl: "",
        updatedAt: "2026-07-19T00:00:00Z",
        draft: false,
        body: "",
      },
    ],
    pullRequestCreated: {
      number: 42,
      title: "Melhorar testes",
      state: "open",
      head: "test-suite",
      base: "main",
    },
  });

  await expect.element(screen.getByText("Adicionar autenticação")).toBeVisible();
  await expect.element(screen.getByText("aberto")).toBeVisible();
  await screen.getByRole("combobox").click();
  await screen.getByRole("option", { name: "Todos" }).click();
  await expect
    .poll(() =>
      screen.wailsCalls.some(
        (call) => call.methodID === LIST_PULL_REQUESTS && call.args[0] === "all",
      ),
    )
    .toBe(true);

  await screen.getByRole("button", { name: "Novo PR" }).click();
  await screen.getByPlaceholder("deixe vazio para a branch atual").fill("test-suite");
  await screen.getByPlaceholder("Resumo das mudanças").fill("Melhorar testes");
  await screen.getByPlaceholder("O que mudou e por quê").fill("Amplia cobertura do frontend");
  await screen.getByRole("button", { name: "Criar PR" }).click();

  await expect
    .poll(() => screen.wailsCalls.find((call) => call.methodID === CREATE_PULL_REQUEST)?.args)
    .toEqual(["main", "test-suite", "Melhorar testes", "Amplia cobertura do frontend"]);
});
