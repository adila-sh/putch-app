import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@bindings/services": fileURLToPath(
        new URL("./bindings/github.com/joaov/putch/internal/services/index.js", import.meta.url),
      ),
      "@bindings/git": fileURLToPath(
        new URL("./bindings/github.com/joaov/putch/internal/git/index.js", import.meta.url),
      ),
      "@bindings/github": fileURLToPath(
        new URL("./bindings/github.com/joaov/putch/internal/github/index.js", import.meta.url),
      ),
    },
  },
  // O renderer React é carregado pelo setup do Browser Mode. Pré-otimizá-lo
  // evita que o Vite descubra `react-dom/client` durante a primeira execução,
  // invalide o bundle no meio dos testes e recarregue o Chromium.
  optimizeDeps: {
    include: ["react-dom/client"],
  },
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./src/test/setup.ts"],
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      instances: [{ browser: "chromium" }],
    },
  },
});
