import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/follow-up")({
  component: FollowUpLayout,
});

function FollowUpLayout() {
  return <Outlet />;
}
