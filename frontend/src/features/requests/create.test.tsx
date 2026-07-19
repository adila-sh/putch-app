import { renderApp } from "@/test/render-app";
import { expect, test } from "vitest";

const CREATE_REQUEST = 1873506200;

test("valida e cria uma request dentro da coleção atual", async () => {
  const screen = await renderApp("/panel/collections/acme/requests/create");
  const submit = screen.getByRole("button", { name: "Criar" });

  await expect.element(screen.getByRole("heading", { name: "Criar nova request" })).toBeVisible();
  await expect.element(submit).toBeDisabled();

  await screen.getByPlaceholder("Minha request").fill("  Listar clientes  ");
  await screen
    .getByPlaceholder("https://api.example.com/endpoint")
    .fill("  https://api.example.com/customers  ");
  await expect.element(submit).toBeEnabled();
  await submit.click();

  await expect
    .poll(() => screen.wailsCalls.find((call) => call.methodID === CREATE_REQUEST)?.args[0])
    .toMatchObject({
      name: "Listar clientes",
      collection_id: "acme",
      folder_id: "",
      method: "GET",
      url: "https://api.example.com/customers",
    });
});
