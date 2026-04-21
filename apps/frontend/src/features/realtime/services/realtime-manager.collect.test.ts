import { collectServingSseEvent } from '@/features/realtime/services/realtime-manager';

describe('collectServingSseEvent', () => {
  it('collects multiple metric_latest into metricLatestMap', () => {
    const batch: any = {};
    collectServingSseEvent('metric_latest', { code: 'A', ts: 1 }, batch);
    collectServingSseEvent('metric_latest', { code: 'B', ts: 2 }, batch);
    expect(Object.keys(batch.metricLatestMap || {}).sort()).toEqual(['A', 'B']);
  });
});
