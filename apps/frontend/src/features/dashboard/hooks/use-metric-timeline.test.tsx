import React from 'react';
import { render, screen } from '@testing-library/react';
import { act } from 'react-dom/test-utils';
import { vi } from 'vitest';

const metricLatestRef: { value: any } = { value: null };
vi.mock('@/features/realtime/hooks/use-metric-latest', () => ({
  useMetricLatest: () => metricLatestRef.value,
}));

import { useMetricTimelineFromBaseline } from './use-metric-timeline';

function Probe({ baseline }: any) {
  const res = useMetricTimelineFromBaseline(baseline);
  return <div data-testid="out">{JSON.stringify(res.chipDeltaByMinuteTs)}</div>;
}

test('baseline maps metricToday to latest per minute', () => {
  const t1 = Date.parse('2026-04-18T09:30:10+08:00');
  const t2 = Date.parse('2026-04-18T09:30:40+08:00');
  const baseline = { metricToday: [{ ts: t1, main_force_big_order: 5 }, { ts: t2, main_force_big_order: 8 }], loading: false, error: null, baselineReady: true };
  render(<Probe baseline={baseline} />);
  expect(screen.getByTestId('out').textContent).toContain('5');
  expect(screen.getByTestId('out').textContent).toContain('8');
});

test('realtime sample appends and replace behavior', () => {
  const baseline = { metricToday: [], loading: false, error: null, baselineReady: true };
  const { rerender } = render(<Probe baseline={baseline} />);

  const rt1 = Date.parse('2026-04-18T09:31:05+08:00');
  act(() => { metricLatestRef.value = { ts: rt1, main_force_big_order: 10 }; });
  rerender(<Probe baseline={baseline} />);
  expect(screen.getByTestId('out').textContent).toContain('10');

  // updated value for same minute
  act(() => { metricLatestRef.value = { ts: rt1 + 1000, main_force_big_order: 12 }; });
  rerender(<Probe baseline={baseline} />);
  expect(screen.getByTestId('out').textContent).toContain('12');
});

test('same-minute same-value refresh keeps map identity stable', () => {
  let latestMapRef: Record<string, number> | null = null;
  function IdentityProbe({ baseline }: any) {
    const res = useMetricTimelineFromBaseline(baseline);
    latestMapRef = res.chipDeltaByMinuteTs as unknown as Record<string, number>;
    return <div data-testid="identity-out">{JSON.stringify(res.chipDeltaByMinuteTs)}</div>;
  }

  const baseline = { metricToday: [], loading: false, error: null, baselineReady: true };
  const { rerender } = render(<IdentityProbe baseline={baseline} />);

  const rt1 = Date.parse('2026-04-18T09:31:05+08:00');
  act(() => { metricLatestRef.value = { ts: rt1, main_force_big_order: 10 }; });
  rerender(<IdentityProbe baseline={baseline} />);
  const previousMapRef = latestMapRef;

  act(() => { metricLatestRef.value = { ts: rt1 + 1000, main_force_big_order: 10 }; });
  rerender(<IdentityProbe baseline={baseline} />);

  expect(latestMapRef).toBe(previousMapRef);
});
