// worker-index.ts - factory for creating SSE worker
export function createSseWorker(): Worker | null {
  if (typeof Worker === "undefined") {
    return null;
  }
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  return new Worker(new URL("./sse-worker.ts", import.meta.url), {
    type: "module",
  });
}
