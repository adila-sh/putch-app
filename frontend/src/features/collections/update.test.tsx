import { renderApp } from "@/test/render-app";
import { expect, test } from "vitest";

const UPDATE_COLLECTION = 3600698108;

test("edita uma coleção existente", async () => {
  const screen = await renderApp("/panel/collections/collection-1/update", {
    collections: [
      {
        id: "collection-1",
        name: "API antiga",
        description: "Legado",
        pinned: false,
        deprecated: false,
        bg: 0,
        request_count: 0,
      },
    ],
  });

  await screen.getByPlaceholder("Coleção de APIs").fill("API atualizada");
  await screen.getByPlaceholder("Para que serve esta coleção (opcional)").fill("Core");
  await screen.getByRole("button", { name: "Fundo 5" }).click();
  await screen.getByRole("button", { name: "Salvar" }).click();

  await expect
    .poll(() => screen.wailsCalls.find((call) => call.methodID === UPDATE_COLLECTION)?.args)
    .toMatchObject(["collection-1", { name: "API atualizada", description: "Core", bg: 4 }]);
});
