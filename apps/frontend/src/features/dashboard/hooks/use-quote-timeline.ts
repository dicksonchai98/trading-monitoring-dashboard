import { useEffect, useMemo, useState } from "react";
import { DEFAULT_ORDER_FLOW_CODE, getQuoteToday } from "@/features/dashboard/api/market-overview";
import { minuteKeyFromEpochMs } from "@/features/dashboard/lib/market-overview-mapper";
import { useQuoteLatest } from "@/features/realtime/hooks/use-quote-latest";
import { useAuthStore } from "@/lib/store/auth-store";

interface QuoteMinuteMaps {
  mainChipByMinute: Record<number, number>;
  longShortForceByMinute: Record<number, number>;
}

interface UseQuoteTimelineResult extends QuoteMinuteMaps {
  loading: boolean;
  error: string | null;
}

function resolvePointTs(point: { ts?: number; event_ts?: string }): number | null {
  if (typeof point.ts === "number" && Number.isFinite(point.ts)) {
    return point.ts;
  }
  if (typeof point.event_ts === "string") {
    const parsed = Date.parse(point.event_ts);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function resolveErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "quote_today_load_failed";
}

export function useQuoteTimeline(
  code: string = DEFAULT_ORDER_FLOW_CODE,
): UseQuoteTimelineResult {
  const token = useAuthStore((state) => state.token);
  const resolved = useAuthStore((state) => state.resolved);
  const role = useAuthStore((state) => state.role);
  const quoteLatest = useQuoteLatest(code);

  const [baseMaps, setBaseMaps] = useState<QuoteMinuteMaps>({
    mainChipByMinute: {},
    longShortForceByMinute: {},
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!resolved) {
      setLoading(true);
      setError(null);
      setBaseMaps({ mainChipByMinute: {}, longShortForceByMinute: {} });
      return () => {
        cancelled = true;
      };
    }

    if (!token || role === "visitor") {
      setLoading(false);
      setError(null);
      setBaseMaps({ mainChipByMinute: {}, longShortForceByMinute: {} });
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    setError(null);

    void getQuoteToday(token, code)
      .then((rows) => {
        if (cancelled) {
          return;
        }
        const mainChipByMinute: Record<number, number> = {};
        const longShortForceByMinute: Record<number, number> = {};

        for (const row of rows) {
          const ts = resolvePointTs(row);
          if (ts === null) {
            continue;
          }
          const minuteTs = minuteKeyFromEpochMs(ts);
          if (typeof row.main_chip === "number" && Number.isFinite(row.main_chip)) {
            mainChipByMinute[minuteTs] = row.main_chip;
          }
          if (
            typeof row.long_short_force === "number" &&
            Number.isFinite(row.long_short_force)
          ) {
            longShortForceByMinute[minuteTs] = row.long_short_force;
          }
        }

        setBaseMaps({ mainChipByMinute, longShortForceByMinute });
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) {
          return;
        }
        setBaseMaps({ mainChipByMinute: {}, longShortForceByMinute: {} });
        setError(resolveErrorMessage(err));
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [code, resolved, role, token]);

  const mergedMaps = useMemo(() => {
    const mainChipByMinute = { ...baseMaps.mainChipByMinute };
    const longShortForceByMinute = { ...baseMaps.longShortForceByMinute };

    const latestTs = resolvePointTs(quoteLatest ?? {});
    if (latestTs !== null) {
      const minuteTs = minuteKeyFromEpochMs(latestTs);
      if (
        typeof quoteLatest?.main_chip === "number" &&
        Number.isFinite(quoteLatest.main_chip)
      ) {
        mainChipByMinute[minuteTs] = quoteLatest.main_chip;
      }
      if (
        typeof quoteLatest?.long_short_force === "number" &&
        Number.isFinite(quoteLatest.long_short_force)
      ) {
        longShortForceByMinute[minuteTs] = quoteLatest.long_short_force;
      }
    }

    return { mainChipByMinute, longShortForceByMinute };
  }, [baseMaps.longShortForceByMinute, baseMaps.mainChipByMinute, quoteLatest]);

  return {
    ...mergedMaps,
    loading,
    error,
  };
}

