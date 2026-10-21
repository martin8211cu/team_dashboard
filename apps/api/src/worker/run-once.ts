import { registerWorkerShutdown } from "./lifecycle";
import { runDailySyncSafely } from "./runSync";

registerWorkerShutdown();

await runDailySyncSafely();
