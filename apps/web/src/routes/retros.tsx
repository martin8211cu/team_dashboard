import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/retros")({
  component: RetrosLayout,
});

function RetrosLayout() {
  return <Outlet />;
}
