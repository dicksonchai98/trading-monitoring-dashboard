import { useEffect, useRef, useState } from 'react';
import { useRealtimeStore } from '@/features/realtime/store/realtime.store';

export function useThrottledSubscription<T>(selector: (s: any) => T, ms = 100): T {
  // initialize with current store value so hook returns stable value immediately
  const latestRef = useRef<T>(selector(useRealtimeStore.getState()));
  const [, setTick] = useState(0);

  useEffect(() => {
    const unsub = useRealtimeStore.subscribe((state) => {
      try {
        latestRef.current = selector(state);
      } catch (e) {
        // swallow selector errors
      }
    });

    const id = setInterval(() => setTick((t) => t + 1), ms);
    return () => {
      unsub();
      clearInterval(id);
    };
  }, [selector, ms]);

  return latestRef.current as T;
}
