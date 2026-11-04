import { createFileRoute } from "@tanstack/react-router";
import { PersonalSprintPage } from "../components/PersonalSprintPage";

export const Route = createFileRoute("/me/")({
  component: MeIndexPage,
});

function MeIndexPage() {
  return <PersonalSprintPage />;
}
