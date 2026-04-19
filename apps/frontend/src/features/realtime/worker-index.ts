// worker-index.ts - factory for creating SSE worker
export function createSseWorker(): Worker {
  // Vite supports importing Worker modules via new URL(..., import.meta.url)
  // Keep this wrapper to centralize worker creation and make it testable/mocked
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  return new Worker(new URL('./sse-worker.ts', import.meta.url), { type: 'module' });
}
