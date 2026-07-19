import { renderApp } from "@/test/render-app";
import { expect, test } from "vitest";

const UPDATE_ENVIRONMENT = 2358908509;

test("edita ambiente e preserva suas variáveis", async () => {
  const screen = await renderApp("/panel/environments/environment-1/update", {
    environments: [
      {
        id: "environment-1",
        name: "Homologação",
        description: "Interno",
        pinned: false,
        deprecated: false,
        variables: { API_URL: "https://staging.example.com" },
      },
    ],
  });

  await screen.getByPlaceholder("Produção, Desenvolvimento, etc.").fill("Staging");
  await screen.getByPlaceholder("Para que serve este ambiente (opcional)").fill("QA");
  await screen.getByRole("button", { name: "Salvar" }).click();

  await expect
    .poll(() => screen.wailsCalls.find((call) => call.methodID === UPDATE_ENVIRONMENT)?.args)
    .toMatchObject([
      "environment-1",
      {
        name: "Staging",
        description: "QA",
        variables: { API_URL: "https://staging.example.com" },
      },
    ]);
});
