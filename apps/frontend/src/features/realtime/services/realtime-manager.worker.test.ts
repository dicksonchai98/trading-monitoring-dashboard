import { describe, test, expect, vi, beforeEach } from 'vitest';
import { RealtimeManager } from './realtime-manager';
let manager: RealtimeManager;
import { useRealtimeStore } from '@/features/realtime/store/realtime.store';

describe('realtime-manager worker integration', () => {
  beforeEach(() => {
    try { useRealtimeStore.getState().resetRealtime(); } catch (e) { /* ignore */ }
    manager = new RealtimeManager();
  });

  test('worker batch merges into pendingBatch and flush applies to store', () => {
    const spy = vi.spyOn(useRealtimeStore.getState(), 'applySseBatch');
    const batch = {
      metricLatestMap: { A: { code: 'A', ts: Date.now() } },
      indexContribRanking: { index_code: 'TSE001', top: [], bottom: [], trade_date: '2026-04-18', ts: Date.now() },
      heartbeatTs: Date.now(),
    };
    // simulate worker message
    (manager as any).handleWorkerMessage({ data: { type: 'batch', batch } });
    // pendingBatch should now contain the batch
    expect((manager as any).pendingBatch).toBeDefined();
    // force flush (call private method)
    (manager as any).flushPendingBatch();
    expect(spy).toHaveBeenCalledWith(batch);
    spy.mockRestore();
  });
});
