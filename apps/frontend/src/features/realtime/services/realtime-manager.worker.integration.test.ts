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

  test('merges worker batch and applies on flush', () => {
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

    expect(spy).not.toHaveBeenCalled();
    (manager as any).flushPendingBatch();
    expect(spy).toHaveBeenCalledWith(batch);
    spy.mockRestore();
  });

  test('disconnect tears down worker and clears pending batch without stale flush', () => {
    vi.useFakeTimers();
    const applySpy = vi.spyOn(useRealtimeStore.getState(), 'applySseBatch');
    const fakeWorker = {
      postMessage: vi.fn(),
      terminate: vi.fn(),
      onmessage: null as any,
    } as unknown as Worker;

    (manager as any).worker = fakeWorker;
    (manager as any).handleWorkerMessage({
      data: { type: 'batch', batch: { metricLatestMap: { A: { code: 'A', ts: Date.now() } } } },
    } as MessageEvent);

    manager.disconnect();
    vi.advanceTimersByTime(200);

    expect(fakeWorker.postMessage).toHaveBeenCalledWith({ type: 'teardown' });
    expect(fakeWorker.terminate).toHaveBeenCalledTimes(1);
    expect((manager as any).pendingBatch).toBeNull();
    expect((manager as any).pendingBatchTimer).toBeNull();
    expect(applySpy).not.toHaveBeenCalled();
    applySpy.mockRestore();
    vi.useRealTimers();
  });
});
