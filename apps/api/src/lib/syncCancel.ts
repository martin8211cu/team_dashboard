export class SyncCancelledError extends Error {
  constructor() {
    super("Sync cancelled");
    this.name = "SyncCancelledError";
  }
}

export function assertNotCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new SyncCancelledError();
  }
}

export function cancellableSleep(ms: number, signal?: AbortSignal): Promise<void> {
  assertNotCancelled(signal);

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    const onAbort = () => {
      clearTimeout(timer);
      reject(new SyncCancelledError());
    };

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
