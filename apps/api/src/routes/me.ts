import { Hono } from "hono";
import type { AuthUser } from "@team-dashboard/shared";
import { FollowUpError } from "../services/followUpService";
import { getPersonalSprintView } from "../services/personalSprintService";

type Env = {
  Variables: {
    user: AuthUser;
  };
};

export const meRoutes = new Hono<Env>();

function handleError(err: unknown) {
  if (err instanceof FollowUpError) {
    return { error: err.message, status: err.status };
  }
  const message = err instanceof Error ? err.message : "Unexpected error";
  return { error: message, status: 500 as const };
}

meRoutes.get("/sprint", async (c) => {
  const user = c.get("user");
  const memberRaw = c.req.query("memberId");
  const sprintRaw = c.req.query("sprint");
  const memberId = memberRaw ? Number.parseInt(memberRaw, 10) : undefined;
  const sprintNumber = sprintRaw ? Number.parseInt(sprintRaw, 10) : undefined;

  if (memberRaw && Number.isNaN(memberId)) {
    return c.json({ error: "Invalid memberId" }, 400);
  }
  if (sprintRaw && Number.isNaN(sprintNumber)) {
    return c.json({ error: "Invalid sprint" }, 400);
  }

  try {
    return c.json(
      await getPersonalSprintView(user, {
        memberId,
        sprintNumber,
      }),
    );
  } catch (err) {
    const { error, status } = handleError(err);
    return c.json({ error }, status);
  }
});
