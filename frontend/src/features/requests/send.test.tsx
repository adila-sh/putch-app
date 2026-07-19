import { renderApp } from "@/test/render-app";
import { expect, test } from "vitest";

const SEND_REQUEST = 1632454770;

test("envia uma request selecionada e exibe a resposta HTTP", async () => {
  const screen = await renderApp("/panel/collections/acme/requests", {
    collections: [
      {
        id: "acme",
        name: "API principal",
        description: "",
        bg: 0,
        request_count: 1,
      },
    ],
    requests: [
      {
        id: "list-customers",
        name: "Listar clientes",
        collection_id: "acme",
        folder_id: "",
        url: "https://api.example.com/customers",
        method: "GET",
        params: {},
        headers: {},
        body: "",
        body_type: "",
        form: {},
        files: {},
        auth_type: "",
        auth_value: "",
        timeout_ms: 0,
        pre_script: "",
        post_script: "",
        created_at: "2026-07-19T00:00:00Z",
        updated_at: "2026-07-19T00:00:00Z",
        is_favorite: false,
        is_active: true,
      },
    ],
    responseSent: {
      status: 200,
      headers: { "content-type": "application/json" },
      body: '{"customers":[{"name":"Ana"}]}',
      duration_ms: 35,
    },
  });

  await expect.element(screen.getByText("API principal")).toBeVisible();
  await screen.getByText("Listar clientes").click();
  await expect.element(screen.getByText('Clique em "Enviar" para ver a resposta')).toBeVisible();
  await screen.getByRole("button", { name: "Enviar" }).click();

  await expect
    .poll(() => screen.wailsCalls.find((call) => call.methodID === SEND_REQUEST)?.args[0])
    .toMatchObject({
      method: "GET",
      url: "https://api.example.com/customers",
    });
  await expect.element(screen.getByText("200")).toBeVisible();
  await expect.element(screen.getByText("OK")).toBeVisible();
  await expect.element(screen.getByText(/Ana/)).toBeVisible();
});
