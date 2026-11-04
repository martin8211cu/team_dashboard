import { createFileRoute, redirect } from "@tanstack/react-router";
import { PersonalSprintPage } from "../components/PersonalSprintPage";

export const Route = createFileRoute("/me/$memberId")({
  beforeLoad: ({ context, params }) => {
    const memberId = Number.parseInt(params.memberId, 10);
    const user = context.authUser;
    if (!user) {
      return;
    }
    if (user.role !== "admin") {
      throw redirect({ to: "/me" });
    }
    if (Number.isNaN(memberId)) {
      throw redirect({ to: "/me" });
    }
    if (memberId === user.id) {
      throw redirect({ to: "/me" });
    }
  },
  component: MeMemberPage,
});

function MeMemberPage() {
  const { memberId: memberIdParam } = Route.useParams();
  const memberId = Number.parseInt(memberIdParam, 10);
  return <PersonalSprintPage memberId={memberId} />;
}
