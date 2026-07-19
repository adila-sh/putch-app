import { renderApp } from "@/test/render-app";
import { expect, test } from "vitest";

const CREATE_WORKSPACE = 168728580;

test("cria workspace com aparência e preferência de fixação", async () => {
  const screen = await renderApp("/panel/workspaces/create");
  const submit = screen.getByRole("button", { name: "Criar" });

  await expect.element(submit).toBeDisabled();
  await screen.getByPlaceholder("Meu workspace").fill("  Plataforma  ");
  await screen.getByRole("button", { name: "Cor #8b5cf6" }).click();
  await screen.getByRole("button", { name: "Ícone 🚀" }).click();
  await screen.getByRole("switch").click();
  await submit.click();

  await expect
    .poll(() => screen.wailsCalls.find((call) => call.methodID === CREATE_WORKSPACE)?.args[0])
    .toMatchObject({
      name: "Plataforma",
      color: "#8b5cf6",
      icon: "🚀",
      pinned: true,
    });
});
