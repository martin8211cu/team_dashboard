import { loadDefaultTeamSettings, loadTeamSettings } from "@team-dashboard/shared";
import { Hono } from "hono";
import { createLogger } from "./lib/logger";
import { registerGracefulShutdown } from "./lib/shutdown";
import { cors } from "hono/cors";
import { closeDb } from "./db/connection";
import { deleteSprintSnapshotsBelow } from "./db/sprintCleanup";
import { requireAdmin } from "./middleware/requireAdmin";
import { requireAuth } from "./middleware/requireAuth";
import { authRoutes } from "./routes/auth";
import { healthRoutes } from "./routes/health";
import { exportRoutes } from "./routes/export";
import { jiraRoutes } from "./routes/jira";
import { kpiRoutes } from "./routes/kpis";
import { memberRoutes } from "./routes/members";
import { retroRoutes } from "./routes/retros";
import { backfillMissingPasswords, ensureAdminMember } from "./services/authService";
const log = createLogger("api");

function loadTeamSettingsForStartup() {
  const configPath = process.env.TEAM_CONFIG_PATH;
  return configPath ? loadTeamSettings(configPath) : loadDefaultTeamSettings();
}

const minSprintNumber = loadTeamSettingsForStartup().minSprintNumber;
if (minSprintNumber != null) {
  const pruned = await deleteSprintSnapshotsBelow(minSprintNumber);
  if (pruned.taskSnapshots > 0 || pruned.metricsSnapshots > 0) {
    log.info(
      `pruned sprint snapshots before ${minSprintNumber}: ${pruned.taskSnapshots} task, ${pruned.metricsSnapshots} metrics`,
    );
  }
}

await ensureAdminMember();
await backfillMissingPasswords();

const app = new Hono();

const webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:5173";

app.use(
  "*",
  cors({
    origin: webOrigin,
    credentials: true,
  }),
);

app.route("/health", healthRoutes);
app.route("/api/auth", authRoutes);

app.use("/api/*", async (c, next) => {
  if (c.req.path.startsWith("/api/auth")) {
    return next();
  }
  return requireAuth(c, next);
});

app.use("/api/*", async (c, next) => {
  if (c.req.path.startsWith("/api/auth")) {
    return next();
  }
  // Authenticated members may mutate retros; fine-grained rules live in retroService.
  if (c.req.path.startsWith("/api/retros")) {
    return next();
  }
  if (c.req.method === "GET" || c.req.method === "HEAD" || c.req.method === "OPTIONS") {
    return next();
  }
  return requireAdmin(c, next);
});

app.route("/api/kpis", kpiRoutes);
app.route("/api/members", memberRoutes);
app.route("/api/jira", jiraRoutes);
app.route("/api/export", exportRoutes);
app.route("/api/retros", retroRoutes);

app.get("/", (c) => c.json({ name: "team-dashboard-api", version: "0.0.0" }));

const port = Number(process.env.PORT ?? 8090);

const server = Bun.serve({
  port,
  fetch: app.fetch,
  // Sprint metrics fetches Jira changlogs for every issue (1–3 min).
  // Bun defaults to 10s idleTimeout which causes "socket hang up" in the Vite proxy.
  idleTimeout: 255,
});

registerGracefulShutdown({
  logger: log,
  handlers: [
    () => {
      log.info("stopping HTTP server...");
      server.stop(false);
    },
    async () => {
      log.info("closing database...");
      await closeDb();
    },
  ],
});

log.info(`listening on http://localhost:${port}`);
