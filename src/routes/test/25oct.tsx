import { createFileRoute, redirect } from "@tanstack/react-router";

// Backward-compatible shortcut for the same assessment round.
export const Route = createFileRoute("/test/25oct")({
  beforeLoad: () => {
    throw redirect({ to: "/test/icc-dsa-round" });
  },
});
