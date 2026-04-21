import { useEffect, useRef, useState } from 'react';
import { useRealtimeStore } from '@/features/realtime/store/realtime.store';

export function useThrottledSubscription<T>(selector: (s: any) => T, ms = 100): T {
  const selectorRef = useRef(selector);
  selectorRef.current = selector;

  const latestRef = useRef<T>(selectorRef.current(useRealtimeStore.getState()));
  const [, setTick] = useState(0);

  useEffect(() => {
    const unsub = useRealtimeStore.subscribe((state) => {
      try {
        latestRef.current = selectorRef.current(state);
      } catch {
        // swallow selector errors
      }
    });

    const id = setInterval(() => setTick((t) => t + 1), ms);
    return () => {
      unsub();
      clearInterval(id);
    };
  }, [ms]);

  useEffect(() => {
    try {
      latestRef.current = selector(useRealtimeStore.getState());
    } catch {
      // swallow selector errors
    }
  }, [selector]);

  return latestRef.current as T;
}
