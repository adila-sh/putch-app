import "vitest-browser-react";
import { setTransport } from "@wailsio/runtime";
import { afterEach } from "vitest";

afterEach(() => {
  setTransport(null);
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.removeAttribute("data-reduce-motion");
  document.documentElement.style.removeProperty("font-size");
});
