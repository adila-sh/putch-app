import { renderApp } from "@/test/render-app";
import { expect, test } from "vitest";

const CREATE_COLLECTION = 2084708613;

test("valida e envia os dados da nova coleção ao backend", async () => {
  const screen = await renderApp("/panel/collections/create");
  const submit = screen.getByRole("button", { name: "Criar" });

  await expect.element(screen.getByRole("heading", { name: "Criar nova coleção" })).toBeVisible();
  await expect.element(submit).toBeDisabled();

  await screen.getByPlaceholder("Coleção de APIs").fill("  API de Pagamentos  ");
  await screen.getByPlaceholder("Para que serve esta coleção (opcional)").fill("Cobranças");
  await screen.getByRole("button", { name: "Fundo 3" }).click();
  await expect.element(submit).toBeEnabled();
  await submit.click();

  await expect
    .poll(() => screen.wailsCalls.find((call) => call.methodID === CREATE_COLLECTION)?.args[0])
    .toMatchObject({
      name: "API de Pagamentos",
      description: "Cobranças",
      bg: 2,
    });
});
