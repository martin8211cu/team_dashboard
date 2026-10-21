import { createLogger } from "../lib/logger";
import { loadWorkerConfig } from "./config";
import { registerWorkerShutdown } from "./lifecycle";
import { runDailySyncSafely } from "./runSync";

const log = createLogger("worker");

const config = loadWorkerConfig();

const serveOptions = {
  port: config.port,
  idleTimeout: 255,
  fetch() {
    return Response.json({ status: "ok", job: "sprint-sync", cron: config.cron });
  },
  cron: {
    [config.cron]: () => {
      void runDailySyncSafely();
    },
  },
};

// Bun.serve cron is supported at runtime but not yet in @types/bun.
const server = Bun.serve(serveOptions as Parameters<typeof Bun.serve>[0]);

registerWorkerShutdown(async () => {
  log.info("stopping HTTP server...");
  server.stop(false);
});

log.info(`listening on http://localhost:${config.port}`);
log.info(`sprint sync cron: ${config.cron}`);

if (config.runOnStart) {
  log.info("SYNC_RUN_ON_START=true — running sync now...");
  void runDailySyncSafely();
}
