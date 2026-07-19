import "vitest-browser-react";
import { setTransport, type RuntimeTransport } from "@wailsio/runtime";
import { page } from "vitest/browser";
import { afterEach, beforeEach } from "vitest";

beforeEach(async () => {
  // As telas desktop possuem sidebars e painéis redimensionáveis; uma área
  // realista evita esconder controles importantes no iframe padrão estreito.
  await page.viewport(1280, 800);
});

// Alguns submits navegam para outra rota e seus loaders podem terminar durante
// o cleanup. Um transporte inerte isola esses trabalhos tardios sem deixá-los
// cair no transporte real de browser nem contaminar o mock do teste seguinte.
const idleTransport: RuntimeTransport = {
  async call() {
    return [];
  },
};

afterEach(() => {
  setTransport(idleTransport);
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.removeAttribute("data-reduce-motion");
  document.documentElement.style.removeProperty("font-size");
});
