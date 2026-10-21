import { createLogger, type Logger } from "./logger";

const DEFAULT_TIMEOUT_MS = 30_000;

function readShutdownTimeoutMs(): number {
  const raw = process.env.GRACEFUL_SHUTDOWN_TIMEOUT_MS;
  if (raw == null || raw.trim() === "") {
    return DEFAULT_TIMEOUT_MS;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return DEFAULT_TIMEOUT_MS;
  }
  return parsed;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type GracefulShutdownOptions = {
  logger?: Logger;
  handlers?: Array<() => void | Promise<void>>;
  timeoutMs?: number;
};

let registered = false;

export function registerGracefulShutdown(options: GracefulShutdownOptions = {}): void {
  if (registered) {
    return;
  }
  registered = true;

  const logger = options.logger ?? createLogger("app");
  const timeoutMs = options.timeoutMs ?? readShutdownTimeoutMs();
  const handlers = options.handlers ?? [];
  let shuttingDown = false;

  const shutdown = async (signal: string, code: number) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    logger.info(`received ${signal}, shutting down gracefully...`);

    const deadline = Date.now() + timeoutMs;

    for (const [index, handler] of handlers.entries()) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        logger.warn("shutdown timeout reached before all handlers completed");
        break;
      }

      try {
        await Promise.race([
          Promise.resolve(handler()),
          sleep(remaining).then(() => {
            throw new Error(`shutdown handler ${index + 1} timed out`);
          }),
        ]);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.warn(message);
      }
    }

    logger.info("shutdown complete");
    process.exit(code);
  };

  process.on("SIGINT", () => {
    void shutdown("SIGINT", 130);
  });
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM", 143);
  });
}
