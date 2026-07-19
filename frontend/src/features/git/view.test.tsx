import { renderApp } from "@/test/render-app";
import { expect, test } from "vitest";

const CONNECT_REMOTE = 1055202155;
const CLONE_WORKSPACE = 239914799;

test("conecta ou clona um repositório remoto", async () => {
  const screen = await renderApp("/panel/git");
  const remoteInputs = screen.getByPlaceholder("https://github.com/org/repo.git");

  await expect
    .element(screen.getByRole("button", { name: "Conectar", exact: true }))
    .toBeDisabled();
  await remoteInputs.nth(0).fill("  https://github.com/acme/api.git  ");
  await screen.getByRole("button", { name: "Conectar", exact: true }).click();
  await remoteInputs.nth(1).fill("  https://github.com/acme/clone.git  ");
  await screen.getByRole("button", { name: "Clonar" }).click();

  await expect
    .poll(() => screen.wailsCalls.find((call) => call.methodID === CONNECT_REMOTE)?.args)
    .toEqual(["https://github.com/acme/api.git"]);
  await expect
    .poll(() => screen.wailsCalls.find((call) => call.methodID === CLONE_WORKSPACE)?.args)
    .toEqual(["https://github.com/acme/clone.git"]);
});
