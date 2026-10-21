import { Hono } from "hono";
import type {
  AuthUser,
  CreateRetroCardInput,
  CreateRetroSessionInput,
  SetRetroReactionInput,
} from "@team-dashboard/shared";
import {
  RetroError,
  addCard,
  closeSession,
  createSession,
  editCard,
  getSessionBySprint,
  getSessionDetail,
  joinSession,
  listSessions,
  removeCard,
  reopenSession,
  toggleCardReaction,
} from "../services/retroService";

type Env = {
  Variables: {
    user: AuthUser;
  };
};

export const retroRoutes = new Hono<Env>();

function getUser(c: { get: (key: "user") => AuthUser }): AuthUser {
  return c.get("user");
}

function handleRetroError(err: unknown) {
  if (err instanceof RetroError) {
    return { error: err.message, status: err.status as 400 | 403 | 404 | 409 };
  }
  const message = err instanceof Error ? err.message : "Unexpected error";
  return { error: message, status: 500 as const };
}

retroRoutes.get("/", async (c) => {
  return c.json(await listSessions());
});

retroRoutes.get("/by-sprint/:sprintNumber", async (c) => {
  const sprintNumber = Number.parseInt(c.req.param("sprintNumber"), 10);
  if (Number.isNaN(sprintNumber)) {
    return c.json({ error: "Invalid sprint number" }, 400);
  }
  const session = await getSessionBySprint(sprintNumber);
  if (!session) {
    return c.json({ error: "Retro session not found" }, 404);
  }
  return c.json(session);
});

retroRoutes.post("/", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as CreateRetroSessionInput;
  try {
    const session = await createSession(Number(body.sprintNumber), getUser(c));
    return c.json(session, 201);
  } catch (err) {
    const { error, status } = handleRetroError(err);
    return c.json({ error }, status);
  }
});

retroRoutes.get("/:id", async (c) => {
  const id = Number.parseInt(c.req.param("id"), 10);
  if (Number.isNaN(id)) {
    return c.json({ error: "Invalid id" }, 400);
  }
  try {
    return c.json(await getSessionDetail(id, getUser(c)));
  } catch (err) {
    const { error, status } = handleRetroError(err);
    return c.json({ error }, status);
  }
});

retroRoutes.post("/:id/join", async (c) => {
  const id = Number.parseInt(c.req.param("id"), 10);
  if (Number.isNaN(id)) {
    return c.json({ error: "Invalid id" }, 400);
  }
  try {
    return c.json(await joinSession(id, getUser(c)));
  } catch (err) {
    const { error, status } = handleRetroError(err);
    return c.json({ error }, status);
  }
});

retroRoutes.post("/:id/close", async (c) => {
  const id = Number.parseInt(c.req.param("id"), 10);
  if (Number.isNaN(id)) {
    return c.json({ error: "Invalid id" }, 400);
  }
  try {
    return c.json(await closeSession(id, getUser(c)));
  } catch (err) {
    const { error, status } = handleRetroError(err);
    return c.json({ error }, status);
  }
});

retroRoutes.post("/:id/reopen", async (c) => {
  const id = Number.parseInt(c.req.param("id"), 10);
  if (Number.isNaN(id)) {
    return c.json({ error: "Invalid id" }, 400);
  }
  try {
    return c.json(await reopenSession(id, getUser(c)));
  } catch (err) {
    const { error, status } = handleRetroError(err);
    return c.json({ error }, status);
  }
});

retroRoutes.post("/:id/cards", async (c) => {
  const id = Number.parseInt(c.req.param("id"), 10);
  if (Number.isNaN(id)) {
    return c.json({ error: "Invalid id" }, 400);
  }
  const body = (await c.req.json().catch(() => ({}))) as CreateRetroCardInput;
  try {
    const card = await addCard(id, body, getUser(c));
    return c.json(card, 201);
  } catch (err) {
    const { error, status } = handleRetroError(err);
    return c.json({ error }, status);
  }
});

retroRoutes.patch("/:id/cards/:cardId", async (c) => {
  const id = Number.parseInt(c.req.param("id"), 10);
  const cardId = Number.parseInt(c.req.param("cardId"), 10);
  if (Number.isNaN(id) || Number.isNaN(cardId)) {
    return c.json({ error: "Invalid id" }, 400);
  }
  const body = (await c.req.json().catch(() => ({}))) as { body?: unknown };
  const text = typeof body.body === "string" ? body.body : "";
  try {
    return c.json(await editCard(id, cardId, text, getUser(c)));
  } catch (err) {
    const { error, status } = handleRetroError(err);
    return c.json({ error }, status);
  }
});

retroRoutes.delete("/:id/cards/:cardId", async (c) => {
  const id = Number.parseInt(c.req.param("id"), 10);
  const cardId = Number.parseInt(c.req.param("cardId"), 10);
  if (Number.isNaN(id) || Number.isNaN(cardId)) {
    return c.json({ error: "Invalid id" }, 400);
  }
  try {
    await removeCard(id, cardId, getUser(c));
    return c.json({ ok: true });
  } catch (err) {
    const { error, status } = handleRetroError(err);
    return c.json({ error }, status);
  }
});

retroRoutes.post("/:id/cards/:cardId/reactions", async (c) => {
  const id = Number.parseInt(c.req.param("id"), 10);
  const cardId = Number.parseInt(c.req.param("cardId"), 10);
  if (Number.isNaN(id) || Number.isNaN(cardId)) {
    return c.json({ error: "Invalid id" }, 400);
  }
  const body = (await c.req.json().catch(() => ({}))) as SetRetroReactionInput;
  try {
    return c.json(await toggleCardReaction(id, cardId, body.reaction, getUser(c)));
  } catch (err) {
    const { error, status } = handleRetroError(err);
    return c.json({ error }, status);
  }
});
