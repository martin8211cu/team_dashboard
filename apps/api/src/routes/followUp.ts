import { Hono } from "hono";
import type {
  AuthUser,
  CreateFollowUpSessionInput,
  FollowUpAssistInput,
  UpdateFollowUpReportInput,
  UpdateFollowUpSessionInput,
  UpsertFollowUpAgreementsInput,
  UpsertFollowUpEvaluationInput,
} from "@team-dashboard/shared";
import {
  FollowUpError,
  assistSession,
  completeSession,
  createSession,
  generateReport,
  getPeriodOverview,
  getReport,
  getReportPdf,
  getSessionDetail,
  updateReport,
  updateSession,
  upsertAgreements,
  upsertEvaluation,
} from "../services/followUpService";

type Env = {
  Variables: {
    user: AuthUser;
  };
};

export const followUpRoutes = new Hono<Env>();

function getUser(c: { get: (key: "user") => AuthUser }): AuthUser {
  return c.get("user");
}

function handleError(err: unknown) {
  if (err instanceof FollowUpError) {
    return { error: err.message, status: err.status };
  }
  const message = err instanceof Error ? err.message : "Unexpected error";
  return { error: message, status: 500 as const };
}

followUpRoutes.get("/", async (c) => {
  const period = c.req.query("period") ?? "";
  try {
    return c.json(await getPeriodOverview(period, getUser(c)));
  } catch (err) {
    const { error, status } = handleError(err);
    return c.json({ error }, status);
  }
});

followUpRoutes.post("/sessions", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as CreateFollowUpSessionInput;
  try {
    const session = await createSession(body, getUser(c));
    return c.json(session, 201);
  } catch (err) {
    const { error, status } = handleError(err);
    return c.json({ error }, status);
  }
});

followUpRoutes.get("/sessions/:id", async (c) => {
  const id = Number.parseInt(c.req.param("id"), 10);
  if (Number.isNaN(id)) {
    return c.json({ error: "Invalid id" }, 400);
  }
  try {
    return c.json(await getSessionDetail(id, getUser(c)));
  } catch (err) {
    const { error, status } = handleError(err);
    return c.json({ error }, status);
  }
});

followUpRoutes.patch("/sessions/:id", async (c) => {
  const id = Number.parseInt(c.req.param("id"), 10);
  if (Number.isNaN(id)) {
    return c.json({ error: "Invalid id" }, 400);
  }
  const body = (await c.req.json().catch(() => ({}))) as UpdateFollowUpSessionInput;
  try {
    return c.json(await updateSession(id, body, getUser(c)));
  } catch (err) {
    const { error, status } = handleError(err);
    return c.json({ error }, status);
  }
});

followUpRoutes.put("/sessions/:id/evaluation", async (c) => {
  const id = Number.parseInt(c.req.param("id"), 10);
  if (Number.isNaN(id)) {
    return c.json({ error: "Invalid id" }, 400);
  }
  const body = (await c.req.json().catch(() => ({}))) as UpsertFollowUpEvaluationInput;
  try {
    return c.json(await upsertEvaluation(id, body, getUser(c)));
  } catch (err) {
    const { error, status } = handleError(err);
    return c.json({ error }, status);
  }
});

followUpRoutes.put("/sessions/:id/agreements", async (c) => {
  const id = Number.parseInt(c.req.param("id"), 10);
  if (Number.isNaN(id)) {
    return c.json({ error: "Invalid id" }, 400);
  }
  const body = (await c.req.json().catch(() => ({}))) as UpsertFollowUpAgreementsInput;
  try {
    return c.json(await upsertAgreements(id, body, getUser(c)));
  } catch (err) {
    const { error, status } = handleError(err);
    return c.json({ error }, status);
  }
});

followUpRoutes.post("/sessions/:id/complete", async (c) => {
  const id = Number.parseInt(c.req.param("id"), 10);
  if (Number.isNaN(id)) {
    return c.json({ error: "Invalid id" }, 400);
  }
  try {
    return c.json(await completeSession(id, getUser(c)));
  } catch (err) {
    const { error, status } = handleError(err);
    return c.json({ error }, status);
  }
});

followUpRoutes.post("/sessions/:id/assist", async (c) => {
  const id = Number.parseInt(c.req.param("id"), 10);
  if (Number.isNaN(id)) {
    return c.json({ error: "Invalid id" }, 400);
  }
  const body = (await c.req.json().catch(() => ({}))) as FollowUpAssistInput;
  try {
    return c.json(await assistSession(id, body.kind, getUser(c)));
  } catch (err) {
    const { error, status } = handleError(err);
    return c.json({ error }, status);
  }
});

followUpRoutes.get("/reports/:period", async (c) => {
  const period = c.req.param("period");
  try {
    return c.json(await getReport(period, getUser(c)));
  } catch (err) {
    const { error, status } = handleError(err);
    return c.json({ error }, status);
  }
});

followUpRoutes.patch("/reports/:period", async (c) => {
  const period = c.req.param("period");
  const body = (await c.req.json().catch(() => ({}))) as UpdateFollowUpReportInput;
  try {
    return c.json(await updateReport(period, body, getUser(c)));
  } catch (err) {
    const { error, status } = handleError(err);
    return c.json({ error }, status);
  }
});

followUpRoutes.get("/reports/:period/pdf/:lang", async (c) => {
  const period = c.req.param("period");
  const lang = c.req.param("lang");
  try {
    const { buffer, filename } = await getReportPdf(period, lang, getUser(c));
    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    const { error, status } = handleError(err);
    return c.json({ error }, status);
  }
});

followUpRoutes.post("/reports/:period/generate", async (c) => {
  const period = c.req.param("period");
  try {
    return c.json(await generateReport(period, getUser(c)));
  } catch (err) {
    const { error, status } = handleError(err);
    return c.json({ error }, status);
  }
});
