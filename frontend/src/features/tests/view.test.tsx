import { renderApp } from "@/test/render-app";
import { expect, test } from "vitest";

const RUN_TEST = 1192741990;
const CREATE_TEST = 2930607881;

test("impede criar teste enquanto o workspace não possui requests", async () => {
  const screen = await renderApp("/panel/tests");

  await expect.element(screen.getByRole("heading", { name: "Testes" })).toBeVisible();
  await expect
    .element(
      screen.getByText(
        "Crie ao menos uma request numa coleção deste workspace antes de montar um teste.",
      ),
    )
    .toBeVisible();
  await expect.element(screen.getByRole("button", { name: "Novo teste" })).toBeDisabled();
});

test("executa uma suíte e mostra o resultado de cada passo", async () => {
  const screen = await renderApp("/panel/tests", {
    requests: [
      {
        id: "request-login",
        name: "Login",
        method: "POST",
        collection_id: "auth",
        url: "https://api.example.com/login",
      },
    ],
    tests: [
      {
        id: "test-auth",
        name: "Autenticação",
        workspace_id: "workspace-1",
        created_at: "2026-07-19T00:00:00Z",
        steps: [{ name: "Fazer login", request_id: "request-login" }],
      },
    ],
    testRunResult: {
      test_id: "test-auth",
      passed: true,
      steps: [
        {
          name: "Fazer login",
          request_id: "request-login",
          status: 200,
          duration_ms: 42,
          error: "",
          assertions: [],
          captured: {},
          passed: true,
        },
      ],
    },
  });

  await expect.element(screen.getByText("Autenticação")).toBeVisible();
  await screen.getByRole("button", { name: "Rodar" }).click();

  await expect.poll(() => screen.wailsCalls.some((call) => call.methodID === RUN_TEST)).toBe(true);
  await expect.element(screen.getByText("Passou")).toBeVisible();
  await expect.element(screen.getByText(/Fazer login/)).toBeVisible();
  await expect.element(screen.getByText(/200 · 42ms/)).toBeVisible();
});

test("monta uma suíte escolhendo request e asserção", async () => {
  const screen = await renderApp("/panel/tests", {
    requests: [
      {
        id: "request-health",
        name: "Health check",
        method: "GET",
        collection_id: "ops",
        url: "https://api.example.com/health",
      },
    ],
  });

  await screen.getByRole("button", { name: "Novo teste" }).click();
  await screen.getByPlaceholder("Nome do teste (ex.: Fluxo de login)").fill("  Smoke test  ");
  await screen.getByLabelText("Nome do passo").fill("Disponibilidade");
  await screen.getByText("— escolher request —").click();
  await screen.getByRole("option", { name: "GET Health check" }).click();
  await screen.getByRole("button", { name: "+ asserção" }).click();
  await screen.getByLabelText("Valor esperado").fill("200");
  await screen.getByRole("button", { name: "Salvar teste" }).click();

  await expect
    .poll(() => screen.wailsCalls.find((call) => call.methodID === CREATE_TEST)?.args[0])
    .toMatchObject({
      name: "Smoke test",
      steps: [
        {
          name: "Disponibilidade",
          request_id: "request-health",
          assertions: [{ type: "status", expected: "200" }],
        },
      ],
    });
});
