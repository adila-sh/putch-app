import "@/globals.css";
import AuthEditor from "@/features/auth/view";
import HeadersEditor from "@/features/headers/view";
import QueryParamsEditor from "@/features/params/view";
import { useState } from "react";
import { expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";

test("adiciona, normaliza e remove headers", async () => {
  const onChange = vi.fn();
  const screen = await render(<HeadersEditor headers={{}} onChange={onChange} />);

  await screen.getByRole("button", { name: "Adicionar header" }).click();
  await screen.getByPlaceholder("Nome do header").fill("  X-Tenant  ");
  await screen.getByPlaceholder("Valor do header").fill("  acme  ");
  expect(onChange).toHaveBeenLastCalledWith({ "X-Tenant": "acme" });

  await screen.getByRole("button", { name: "Remover header" }).click();
  expect(onChange).toHaveBeenLastCalledWith({});
});

test("adiciona, normaliza e mantém uma linha ao remover parâmetros", async () => {
  const onChange = vi.fn();
  const screen = await render(<QueryParamsEditor params={{}} onChange={onChange} />);

  await screen.getByRole("button", { name: "Adicionar parâmetro" }).click();
  await screen.getByPlaceholder("Nome do parâmetro").fill("  page  ");
  await screen.getByPlaceholder("Valor do parâmetro").fill("  2  ");
  expect(onChange).toHaveBeenLastCalledWith({ page: "2" });

  await screen.getByRole("button", { name: "Remover parâmetro" }).click();
  expect(onChange).toHaveBeenLastCalledWith({});
  await expect.element(screen.getByPlaceholder("Nome do parâmetro")).toBeVisible();
});

function AuthHarness() {
  const [auth, setAuth] = useState({ authType: "", authValue: "" });
  return (
    <>
      <AuthEditor authType={auth.authType} authValue={auth.authValue} onChange={setAuth} />
      <output data-testid="auth-state">{JSON.stringify(auth)}</output>
    </>
  );
}

test("mapeia bearer, basic e API key para o formato aceito pelo backend", async () => {
  const screen = await render(<AuthHarness />);
  const select = screen.getByRole("combobox");

  await select.click();
  await screen.getByRole("option", { name: "Bearer Token" }).click();
  await screen.getByPlaceholder("meu-token-jwt").fill("token-123");
  await expect
    .element(screen.getByTestId("auth-state"))
    .toHaveTextContent('{"authType":"bearer","authValue":"token-123"}');

  await select.click();
  await screen.getByRole("option", { name: "Basic Auth" }).click();
  await screen.getByPlaceholder("usuario").fill("ana");
  await screen.getByPlaceholder("senha").fill("secret");
  await expect
    .element(screen.getByTestId("auth-state"))
    .toHaveTextContent('{"authType":"basic","authValue":"ana:secret"}');

  await select.click();
  await screen.getByRole("option", { name: "API Key" }).click();
  await screen.getByPlaceholder("X-API-Key").fill("X-Key");
  await screen.getByPlaceholder("abc123").fill("key-42");
  await expect
    .element(screen.getByTestId("auth-state"))
    .toHaveTextContent('{"authType":"apikey","authValue":"X-Key:key-42"}');
});
