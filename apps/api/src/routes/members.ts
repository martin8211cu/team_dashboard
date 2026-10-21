import { Hono } from "hono";
import type { JiraUser } from "@team-dashboard/shared";
import {
  addMember,
  deleteMember,
  listMembers,
  removeMember,
  updateMember,
} from "../db/members";
import { isJiraConfigured } from "../lib/jiraClient";
import { requireAdmin } from "../middleware/requireAdmin";
import {
  assignDefaultPasswordIfMissing,
  setMemberPassword,
} from "../services/authService";
import {
  addMemberFromJiraUser,
  resolveMemberInJira,
  searchJiraUsers,
} from "../services/memberJiraService";

export const memberRoutes = new Hono();

memberRoutes.get("/", async (c) => {
  const activeOnly = c.req.query("active") === "true";
  return c.json(await listMembers({ activeOnly }));
});

// Mutations and Jira search are admin-only; list above stays available to all authed users.
memberRoutes.use("*", requireAdmin);

memberRoutes.get("/search/jira", async (c) => {
  if (!isJiraConfigured()) {
    return c.json(
      { error: "Jira not configured", message: "Set JIRA_* in .env at the project root" },
      503,
    );
  }

  const q = c.req.query("q")?.trim() ?? "";
  if (q.length < 2) {
    return c.json({ error: "Query must be at least 2 characters" }, 400);
  }

  try {
    const users = await searchJiraUsers(q);
    return c.json(users);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Jira search failed";
    return c.json({ error: message }, 502);
  }
});

memberRoutes.post("/from-jira", async (c) => {
  const body = await c.req.json<JiraUser>();
  if (!body.accountId || !body.displayName) {
    return c.json({ error: "accountId and displayName are required" }, 400);
  }

  try {
    const member = await addMemberFromJiraUser(body);
    await assignDefaultPasswordIfMissing(member.id);
    return c.json(member, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to add member";
    return c.json({ error: message }, 409);
  }
});

memberRoutes.post("/", async (c) => {
  const body = await c.req.json<{ name?: string; email?: string | null }>();
  if (!body.name?.trim()) {
    return c.json({ error: "name is required" }, 400);
  }

  try {
    const member = await addMember(body.name, body.email);
    await assignDefaultPasswordIfMissing(member.id);
    return c.json(member, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to add member";
    return c.json({ error: message }, 409);
  }
});

memberRoutes.patch("/:id/password", async (c) => {
  const id = Number.parseInt(c.req.param("id"), 10);
  if (Number.isNaN(id)) {
    return c.json({ error: "Invalid id" }, 400);
  }

  const body = (await c.req.json().catch(() => ({}))) as { password?: unknown };
  const password = typeof body.password === "string" ? body.password : "";

  try {
    await setMemberPassword(id, password);
    return c.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update password";
    const status = message.includes("not found")
      ? 404
      : message.includes("at least")
        ? 400
        : 400;
    return c.json({ error: message }, status);
  }
});

memberRoutes.patch("/:id", async (c) => {
  const id = Number.parseInt(c.req.param("id"), 10);
  if (Number.isNaN(id)) {
    return c.json({ error: "Invalid id" }, 400);
  }

  const body = await c.req.json<{ name?: string; email?: string | null }>();

  try {
    const member = await updateMember(id, body);
    return c.json(member);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update member";
    const status = message.includes("not found") ? 404 : 409;
    return c.json({ error: message }, status);
  }
});

memberRoutes.post("/:id/resolve-jira", async (c) => {
  const id = Number.parseInt(c.req.param("id"), 10);
  if (Number.isNaN(id)) {
    return c.json({ error: "Invalid id" }, 400);
  }

  try {
    const member = await resolveMemberInJira(id);
    return c.json(member);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to resolve in Jira";
    const status = message.includes("not found") ? 404 : 502;
    return c.json({ error: message }, status);
  }
});

memberRoutes.patch("/:id/deactivate", async (c) => {
  const id = Number.parseInt(c.req.param("id"), 10);
  if (Number.isNaN(id)) {
    return c.json({ error: "Invalid id" }, 400);
  }

  try {
    await removeMember(id);
    return c.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to deactivate member";
    return c.json({ error: message }, 404);
  }
});

memberRoutes.delete("/:id", async (c) => {
  const id = Number.parseInt(c.req.param("id"), 10);
  if (Number.isNaN(id)) {
    return c.json({ error: "Invalid id" }, 400);
  }

  try {
    await deleteMember(id);
    return c.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete member";
    return c.json({ error: message }, 404);
  }
});
