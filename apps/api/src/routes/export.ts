import { Hono } from "hono";
import {
  exportSprint,
  exportSprintMetrics,
  exportSprintTasks,
  exportSprintTasksCompare,
  exportTasksStatus,
  parseTeamOnly,
} from "../services/exportService";

export const exportRoutes = new Hono();

function attachmentResponse(
  buffer: Buffer,
  filename: string,
  contentType: string,
  extraHeaders?: Record<string, string>,
) {
  const headers: Record<string, string> = {
    "Content-Type": contentType,
    "Content-Disposition": `attachment; filename="${filename}"`,
    ...extraHeaders,
  };
  return new Response(new Uint8Array(buffer), { headers });
}

exportRoutes.get("/sprints/:sprintNumber", async (c) => {
  const sprintNumber = Number.parseInt(c.req.param("sprintNumber"), 10);
  if (Number.isNaN(sprintNumber)) {
    return c.json({ error: "Invalid sprint number" }, 400);
  }

  try {
    const teamOnly = parseTeamOnly(c.req.query("team"));
    const file = await exportSprint(sprintNumber, teamOnly);
    return attachmentResponse(file.buffer, file.filename, file.contentType);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Export failed";
    return c.json({ error: message }, 404);
  }
});

exportRoutes.get("/sprints/:sprintNumber/metrics", async (c) => {
  const sprintNumber = Number.parseInt(c.req.param("sprintNumber"), 10);
  if (Number.isNaN(sprintNumber)) {
    return c.json({ error: "Invalid sprint number" }, 400);
  }

  try {
    const teamOnly = parseTeamOnly(c.req.query("team"));
    const file = await exportSprintMetrics(sprintNumber, teamOnly);
    return attachmentResponse(file.buffer, file.filename, file.contentType);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Export failed";
    return c.json({ error: message }, 404);
  }
});

exportRoutes.get("/sprints/:sprintNumber/tasks", async (c) => {
  const sprintNumber = Number.parseInt(c.req.param("sprintNumber"), 10);
  if (Number.isNaN(sprintNumber)) {
    return c.json({ error: "Invalid sprint number" }, 400);
  }

  try {
    const teamOnly = parseTeamOnly(c.req.query("team"));
    const file = await exportSprintTasks(sprintNumber, teamOnly);
    return attachmentResponse(file.buffer, file.filename, file.contentType);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Export failed";
    return c.json({ error: message }, 404);
  }
});

exportRoutes.get("/sprints/tasks/compare", async (c) => {
  const raw = c.req.query("sprints") ?? "";
  const sprintNumbers = raw
    .split(",")
    .map((value) => Number.parseInt(value.trim(), 10))
    .filter((value) => !Number.isNaN(value) && value > 0);

  if (sprintNumbers.length === 0) {
    return c.json({ error: "Provide sprints query param, e.g. ?sprints=73,74" }, 400);
  }

  try {
    const teamOnly = parseTeamOnly(c.req.query("team"));
    const file = await exportSprintTasksCompare(sprintNumbers, teamOnly);
    return attachmentResponse(file.buffer, file.filename, file.contentType);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Export failed";
    return c.json({ error: message }, 404);
  }
});

exportRoutes.get("/tasks/status", async (c) => {
  try {
    const file = await exportTasksStatus();
    const headers: Record<string, string> = {};
    if (file.epicsCsv) {
      headers["X-Epics-Csv-Available"] = "true";
    }
    return attachmentResponse(file.buffer, file.filename, file.contentType, headers);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Export failed";
    return c.json({ error: message }, 502);
  }
});
