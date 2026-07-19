import { renderApp } from "@/test/render-app";
import { expect, test } from "vitest";

const CREATE_ENVIRONMENT = 2447251272;

test("valida e envia ambiente com variáveis ao backend", async () => {
  const screen = await renderApp("/panel/environments/create");
  const submit = screen.getByRole("button", { name: "Criar" });

  await expect.element(screen.getByRole("heading", { name: "Criar novo ambiente" })).toBeVisible();
  await expect.element(submit).toBeDisabled();

  await screen.getByPlaceholder("Produção, Desenvolvimento, etc.").fill("  Produção  ");
  await screen.getByRole("textbox", { name: "Nome da variável" }).fill(" API_URL ");
  await screen.getByRole("textbox", { name: "Valor da variável" }).fill("https://api.example.com");
  await expect.element(submit).toBeEnabled();
  await submit.click();

  await expect
    .poll(() => screen.wailsCalls.find((call) => call.methodID === CREATE_ENVIRONMENT)?.args[0])
    .toMatchObject({
      name: "Produção",
      variables: { API_URL: "https://api.example.com" },
    });
});
