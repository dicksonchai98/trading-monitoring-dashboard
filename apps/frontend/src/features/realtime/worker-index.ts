// worker-index.ts - factory for creating SSE worker
export function createSseWorker(): Worker {
  // Vite supports importing Worker modules via new URL(..., import.meta.url)
  // Keep this wrapper to centralize worker creation and make it testable/mocked.
  // If Worker is not available (e.g., test environment), return a minimal stub that
  // implements the Worker interface enough for manager interaction.
  if (typeof Worker === 'undefined') {
    const stub = {
      postMessage: (_: any) => {},
      terminate: () => {},
      onmessage: null,
      addEventListener: () => {},
      removeEventListener: () => {},
    } as unknown as Worker;
    return stub;
  }
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  return new Worker(new URL('./sse-worker.ts', import.meta.url), { type: 'module' });
}
