import { Hono } from "hono";
import { isJiraConfigured } from "../lib/jiraClient";
import { createLogger } from "../lib/logger";
import { jiraService } from "../services/jiraService";

const log = createLogger("jira");

export const jiraRoutes = new Hono();

jiraRoutes.use("*", async (c, next) => {
  if (!isJiraConfigured()) {
    return c.json(
      {
        error: "Jira not configured",
        message: "Set JIRA_BASE_URL, JIRA_EMAIL, and JIRA_API_TOKEN in .env at the project root",
      },
      503,
    );
  }
  await next();
});

jiraRoutes.get("/config", async (c) => c.json(await jiraService.getConfig()));

jiraRoutes.onError((err, c) => {
  log.error(err);
  return c.json({ error: "Jira request failed", message: err.message }, 502);
});

jiraRoutes.get("/sprints", async (c) => {
  log.info("listing sprints...");
  const sprints = await jiraService.listSprints();
  log.info(`${sprints.length} sprints`);
  return c.json({ sprints });
});

jiraRoutes.get("/sprints/tasks/compare", async (c) => {
  const raw = c.req.query("sprints") ?? "";
  const sprintNumbers = raw
    .split(",")
    .map((value) => Number.parseInt(value.trim(), 10))
    .filter((value) => !Number.isNaN(value) && value > 0);

  if (sprintNumbers.length === 0) {
    return c.json({ error: "Provide sprints query param, e.g. ?sprints=73,74" }, 400);
  }

  const result = await jiraService.compareSprintTasks(sprintNumbers);
  return c.json(result);
});

jiraRoutes.get("/sprints/metrics/compare", async (c) => {
  const raw = c.req.query("sprints") ?? "";
  const sprintNumbers = raw
    .split(",")
    .map((value) => Number.parseInt(value.trim(), 10))
    .filter((value) => !Number.isNaN(value) && value > 0);

  if (sprintNumbers.length === 0) {
    return c.json({ error: "Provide sprints query param, e.g. ?sprints=73,74" }, 400);
  }

  const result = await jiraService.compareSprintMetrics(sprintNumbers);
  return c.json(result);
});

jiraRoutes.post("/sprints/:sprintNumber/load", async (c) => {
  const sprintNumber = Number.parseInt(c.req.param("sprintNumber"), 10);
  if (Number.isNaN(sprintNumber)) {
    return c.json({ error: "Invalid sprint number" }, 400);
  }

  try {
    const result = await jiraService.loadSprint(sprintNumber);
    return c.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load sprint";
    const status = message.includes("not found") ? 404 : 502;
    return c.json({ error: message }, status);
  }
});

jiraRoutes.post("/sprints/:sprintNumber/tasks/load", async (c) => {
  const sprintNumber = Number.parseInt(c.req.param("sprintNumber"), 10);
  if (Number.isNaN(sprintNumber)) {
    return c.json({ error: "Invalid sprint number" }, 400);
  }

  try {
    const result = await jiraService.loadSprintTasks(sprintNumber);
    return c.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load sprint tasks";
    const status = message.includes("not found") ? 404 : 502;
    return c.json({ error: message }, status);
  }
});

jiraRoutes.get("/sprints/:sprintNumber/tasks", async (c) => {
  const sprintNumber = Number.parseInt(c.req.param("sprintNumber"), 10);
  if (Number.isNaN(sprintNumber)) {
    return c.json({ error: "Invalid sprint number" }, 400);
  }

  try {
    const result = await jiraService.getSprintTasks(sprintNumber);
    return c.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to get sprint tasks";
    return c.json({ error: message }, 404);
  }
});

jiraRoutes.post("/sprints/:sprintNumber/metrics/load", async (c) => {
  const sprintNumber = Number.parseInt(c.req.param("sprintNumber"), 10);
  if (Number.isNaN(sprintNumber)) {
    return c.json({ error: "Invalid sprint number" }, 400);
  }

  try {
    const result = await jiraService.loadSprintMetrics(sprintNumber);
    return c.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load sprint metrics";
    const status = message.includes("not found") ? 404 : 502;
    return c.json({ error: message }, status);
  }
});

jiraRoutes.get("/sprints/:sprintNumber/metrics", async (c) => {
  const sprintNumber = Number.parseInt(c.req.param("sprintNumber"), 10);
  if (Number.isNaN(sprintNumber)) {
    return c.json({ error: "Invalid sprint number" }, 400);
  }

  try {
    const result = await jiraService.getSprintMetrics(sprintNumber);
    return c.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to get sprint metrics";
    return c.json({ error: message }, 404);
  }
});

jiraRoutes.get("/epics/status-times", async (c) => {
  const result = await jiraService.getEpicStatusTimes();
  return c.json(result);
});
