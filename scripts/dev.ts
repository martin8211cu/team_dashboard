/**
 * Dev runner with proper signal handling.
 *
 * `bun run --filter '*' dev` on Windows (Git Bash) often leaves orphan
 * processes (especially `bun --watch` for the API) after Ctrl+C.
 * This script forwards SIGINT/SIGTERM to all child processes and waits
 * for a graceful shutdown before force-killing stragglers.
 */
import { spawn, type Subprocess } from "bun";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const SHUTDOWN_GRACE_MS = Number(process.env.DEV_SHUTDOWN_GRACE_MS ?? 8_000);

const children: Subprocess[] = [];
let shuttingDown = false;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function spawnDev(name: string, cwd: string, script: string): Subprocess {
  console.log(`[dev] starting ${name}`);

  const proc = spawn({
    cmd: ["bun", "run", script],
    cwd,
    stdout: "inherit",
    stderr: "inherit",
    stdin: "inherit",
  });

  children.push(proc);

  proc.exited.then((code) => {
    if (shuttingDown) {
      return;
    }
    console.log(`[dev] ${name} exited with code ${code ?? 1}`);
    void shutdown(code ?? 1);
  });

  return proc;
}

async function shutdown(code = 0): Promise<void> {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;

  const pending = children.filter((child) => child.exitCode === null);
  if (pending.length === 0) {
    process.exit(code);
    return;
  }

  console.log(`[dev] stopping ${pending.length} process(es) gracefully...`);

  for (const child of pending) {
    child.kill();
  }

  await Promise.race([
    Promise.all(pending.map((child) => child.exited)),
    sleep(SHUTDOWN_GRACE_MS),
  ]);

  for (const child of pending) {
    if (child.exitCode === null) {
      console.warn("[dev] force stopping child process");
      child.kill(9);
    }
  }

  await sleep(100);
  process.exit(code);
}

spawnDev("api", join(root, "apps/api"), "dev");
spawnDev("web", join(root, "apps/web"), "dev");
spawnDev("worker", join(root, "apps/api"), "worker");

process.on("SIGINT", () => {
  console.log("\n[dev] stopping...");
  void shutdown(130);
});

process.on("SIGTERM", () => {
  void shutdown(143);
});
