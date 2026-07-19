import { renderApp } from "@/test/render-app";
import { expect, test } from "vitest";

const COMMENT = 453466681;
const REVIEW = 1015796837;
const MERGE = 1142982069;

test("comenta, aprova e mescla um pull request aberto", async () => {
  const screen = await renderApp("/panel/git/pull-requests/42", {
    pullRequestDetail: {
      number: 42,
      title: "Melhorar cobertura",
      state: "open",
      merged: false,
      mergeable: true,
      mergeableState: "clean",
      head: "tests",
      base: "main",
      author: "ana",
      avatarUrl: "",
      createdAt: "2026-07-19T00:00:00Z",
      updatedAt: "2026-07-19T00:00:00Z",
      body: "Novos testes do frontend",
      changedFiles: 0,
      commits: 1,
    },
  });

  await expect.element(screen.getByText("Melhorar cobertura")).toBeVisible();
  await screen.getByPlaceholder("Escreva um comentário…").fill("Ótimo trabalho");
  await screen.getByRole("button", { name: "Comentar", exact: true }).first().click();
  await screen.getByPlaceholder("Resumo da review (opcional para aprovar)…").fill("Aprovado");
  await screen.getByRole("button", { name: "Aprovar" }).click();
  await screen.getByRole("button", { name: "Mesclar PR" }).click();

  await expect
    .poll(() => screen.wailsCalls.find((call) => call.methodID === COMMENT)?.args)
    .toEqual([42, "Ótimo trabalho"]);
  await expect
    .poll(() => screen.wailsCalls.find((call) => call.methodID === REVIEW)?.args)
    .toEqual([42, "APPROVE", "Aprovado", []]);
  await expect
    .poll(() => screen.wailsCalls.find((call) => call.methodID === MERGE)?.args)
    .toEqual([42, "merge"]);
});
