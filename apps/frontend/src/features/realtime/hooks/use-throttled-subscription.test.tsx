import React from 'react';
import { render, act } from '@testing-library/react';
import { useThrottledSubscription } from '@/hooks/use-throttled-subscription';
import { useRealtimeStore } from '@/features/realtime/store/realtime.store';

function TestHarness({ ms = 100 }: { ms?: number }) {
  const val = useThrottledSubscription((s: any) => s.__test_value ?? null, ms);
  return <div data-testid="val">{val === null ? 'null' : String(val)}</div>;
}

describe('useThrottledSubscription', () => {
  beforeEach(() => {
    // ensure baseline
    (useRealtimeStore as any).setState({ __test_value: null });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('throttles updates to interval', () => {
    const { getByTestId } = render(<TestHarness ms={100} />);
    expect(getByTestId('val').textContent).toBe('null');

    act(() => {
      (useRealtimeStore as any).setState({ __test_value: 1 });
    });

    // before tick, hook should still show old value
    expect(getByTestId('val').textContent).toBe('null');

    act(() => {
      vi.advanceTimersByTime(100);
    });

    // after interval, the hook should reflect new value
    expect(getByTestId('val').textContent).toBe('1');
  });
});
