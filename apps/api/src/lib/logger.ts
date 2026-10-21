export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export type Logger = {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  child: (namespace: string) => Logger;
};

function parseLogLevel(): LogLevel {
  const raw = process.env.LOG_LEVEL?.toLowerCase();
  if (raw && raw in LEVEL_RANK) {
    return raw as LogLevel;
  }
  return "info";
}

function formatPrefix(namespace?: string): string {
  return namespace ? `[${namespace}]` : "";
}

function write(
  level: LogLevel,
  minLevel: LogLevel,
  namespace: string | undefined,
  args: unknown[],
): void {
  if (LEVEL_RANK[level] < LEVEL_RANK[minLevel]) {
    return;
  }

  const prefix = formatPrefix(namespace);
  const message = prefix ? [prefix, ...args] : args;

  switch (level) {
    case "debug":
    case "info":
      console.log(...message);
      break;
    case "warn":
      console.warn(...message);
      break;
    case "error":
      console.error(...message);
      break;
  }
}

export function createLogger(namespace?: string, minLevel = parseLogLevel()): Logger {
  const log =
    (level: LogLevel) =>
    (...args: unknown[]) =>
      write(level, minLevel, namespace, args);

  return {
    debug: log("debug"),
    info: log("info"),
    warn: log("warn"),
    error: log("error"),
    child: (childNamespace: string) => {
      const combined = namespace ? `${namespace}:${childNamespace}` : childNamespace;
      return createLogger(combined, minLevel);
    },
  };
}

export const logger = createLogger();
