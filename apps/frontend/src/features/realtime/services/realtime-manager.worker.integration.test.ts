import { RealtimeManager } from './realtime-manager';
import { useRealtimeStore } from '@/features/realtime/store/realtime.store';
import { afterEach, beforeEach, describe, test, expect, vi } from 'vitest';

describe('realtime-manager worker integration', () => {
  let manager: RealtimeManager;

  beforeEach(() => {
    try { useRealtimeStore.getState().resetRealtime(); } catch (e) { /* ignore */ }
    manager = new RealtimeManager();
  });

  afterEach(() => {
    try { manager.disconnect(); } catch (e) { /* ignore */ }
    vi.restoreAllMocks();
  });

  test('applies batches from fake worker to store', () => {
    const spy = vi.spyOn(useRealtimeStore.getState(), 'applySseBatch');
    const fakeWorker = {
      postMessage: vi.fn(),
      terminate: vi.fn(),
      onmessage: null as any,
    } as unknown as Worker;

    // attach fake worker to manager
    (manager as any).worker = fakeWorker;

    const batch = { metricLatestMap: { A: { code: 'A', ts: Date.now() } } };

    // simulate worker message via manager handler if available
    if ((manager as any).handleWorkerMessage) {
      (manager as any).handleWorkerMessage({ data: { type: 'batch', batch } } as MessageEvent);
    } else if ((manager as any).worker && (manager as any).worker.onmessage) {
      (manager as any).worker.onmessage({ data: { type: 'batch', batch } } as MessageEvent);
    }

    expect(spy).toHaveBeenCalledWith(batch);
    spy.mockRestore();
  });
});
