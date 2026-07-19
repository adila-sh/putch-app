import "@/globals.css";
import ResponseView from "@/features/response/view";
import { useHistoryStore } from "@/stores/history.store";
import { ResponseData } from "@bindings/services";
import { afterEach, expect, test } from "vitest";
import { render } from "vitest-browser-react";

afterEach(() => useHistoryStore.getState().clear());

test("alterna visualizações e converte uma resposta JSON para TypeScript", async () => {
  useHistoryStore.getState().clear();
  const screen = await render(
    <ResponseView
      response={
        new ResponseData({
          status: 200,
          headers: { "content-type": "application/json", "x-request-id": "req-42" },
          body: '{"id":42,"name":"Ana","active":true}',
          duration_ms: 18,
        })
      }
    />,
  );

  await expect.element(screen.getByText("200")).toBeVisible();
  await screen.getByRole("button", { name: "Raw" }).click();
  await expect.element(screen.getByText('{"id":42,"name":"Ana","active":true}')).toBeVisible();
  await screen.getByRole("button", { name: "Tree" }).click();
  await expect.element(screen.getByText('"Ana"')).toBeVisible();
  await screen.getByTitle("Converter para interface TypeScript").click();
  await expect.element(screen.getByText(/interface Response/)).toBeVisible();
  await expect.element(screen.getByText(/active: boolean/)).toBeVisible();
});

test("exibe headers e tempo de resposta", async () => {
  const screen = await render(
    <ResponseView
      response={
        new ResponseData({
          status: 404,
          headers: { "x-request-id": "missing-1" },
          body: "not found",
          duration_ms: 1250,
        })
      }
    />,
  );

  await expect.element(screen.getByText("Erro")).toBeVisible();
  await screen.getByText("Headers").click();
  await expect.element(screen.getByText("x-request-id")).toBeVisible();
  await screen.getByText("Timing").click();
  await expect.element(screen.getByText("1.25s").first()).toBeVisible();
});
