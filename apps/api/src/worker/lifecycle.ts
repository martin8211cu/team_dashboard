import { closeDb } from "../db/connection";
import { createLogger } from "../lib/logger";
import { registerGracefulShutdown } from "../lib/shutdown";
import { requestSyncAbort, waitForSyncIdle } from "./runSync";

const log = createLogger("worker");

export function registerWorkerShutdown(onShutdown?: () => void | Promise<void>): void {
  const handlers: Array<() => void | Promise<void>> = [
    () => {
      log.info("cancelling in-flight sprint sync...");
      requestSyncAbort();
    },
    async () => {
      const idle = await waitForSyncIdle();
      if (!idle) {
        log.warn("sprint sync did not finish before shutdown timeout");
      }
    },
    async () => {
      log.info("closing database...");
      await closeDb();
    },
  ];

  if (onShutdown) {
    handlers.splice(2, 0, onShutdown);
  }

  registerGracefulShutdown({ logger: log, handlers });
}
