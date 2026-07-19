import { Service as AuthService } from "@bindings/auth";
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const session = await AuthService.Status();
    throw redirect({
      to: session.authenticated ? "/panel/collections" : "/auth",
      replace: true,
    });
  },
});
