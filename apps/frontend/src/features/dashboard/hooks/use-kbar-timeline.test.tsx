import React from 'react';
import { render, screen } from '@testing-library/react';
import { act } from 'react-dom/test-utils';
import { vi } from 'vitest';

// mock the realtime hook via its alias
const kbarCurrentRef: { value: any } = { value: null };
vi.mock('@/features/realtime/hooks/use-kbar-current', () => ({
  useKbarCurrent: () => kbarCurrentRef.value,
}));

import { useKbarTimelineFromBaseline } from './use-kbar-timeline';

function Probe({ baseline }: any) {
  const res = useKbarTimelineFromBaseline(baseline);
  return <div data-testid="out">{JSON.stringify(res.indexPriceByMinuteTs)}</div>;
}

test('baseline maps kbarToday to minute keys', () => {
  const minuteTs = Date.parse('2026-04-18T09:30:00+08:00');
  const baseline = { kbarToday: [{ minute_ts: minuteTs, close: 123 }], loading: false, error: null, baselineReady: true };
  render(<Probe baseline={baseline} />);
  expect(screen.getByTestId('out').textContent).toContain(String(minuteTs));
  expect(screen.getByTestId('out').textContent).toContain('123');
});

test('realtime append updates map and no-op when identical', () => {
  const minuteTs = Date.parse('2026-04-18T09:30:00+08:00');
  const baseline = { kbarToday: [{ minute_ts: minuteTs, close: 100 }], loading: false, error: null, baselineReady: true };
  const { rerender } = render(<Probe baseline={baseline} />);

  // append new minute
  const newMinute = Date.parse('2026-04-18T09:31:00+08:00');
  act(() => { kbarCurrentRef.value = { minute_ts: newMinute, close: 200 }; });
  rerender(<Probe baseline={baseline} />);
  expect(screen.getByTestId('out').textContent).toContain('200');

  // identical update should be no-op (render still shows same value)
  act(() => { kbarCurrentRef.value = { minute_ts: newMinute, close: 200 }; });
  rerender(<Probe baseline={baseline} />);
  expect(screen.getByTestId('out').textContent).toContain('200');
});
