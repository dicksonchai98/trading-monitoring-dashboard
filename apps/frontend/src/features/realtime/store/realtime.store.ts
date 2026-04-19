import { create } from "zustand";
import type {
  IndexContributionRankingPayload,
  IndexContributionSectorPayload,
  KbarCurrentPayload,
  MarketSummaryLatestPayload,
  MetricLatestPayload,
  OtcSummaryLatestPayload,
  QuoteLatestPayload,
  SpotMarketDistributionLatestPayload,
  SpotMarketDistributionSeriesPayload,
  SseConnectionStatus,
  SpotLatestListPayload,
} from "@/features/realtime/types/realtime.types";

type SpotMarketDistributionSeriesItem =
  SpotMarketDistributionSeriesPayload["items"][number];

interface RealtimeStore {
  connectionStatus: SseConnectionStatus;
  errorReason: string | null;
  kbarCurrentByCode: Record<string, KbarCurrentPayload>;
  metricLatestByCode: Record<string, MetricLatestPayload>;
  indexContribRanking: IndexContributionRankingPayload | null;
  indexContribSector: IndexContributionSectorPayload | null;
  marketSummaryLatestByCode: Record<string, MarketSummaryLatestPayload>;
  otcSummaryLatestByCode: Record<string, OtcSummaryLatestPayload>;
  quoteLatestByCode: Record<string, QuoteLatestPayload>;
  spotLatestList: SpotLatestListPayload | null;
  spotMarketDistributionLatest: SpotMarketDistributionLatestPayload | null;
  spotMarketDistributionSeries: SpotMarketDistributionSeriesPayload | null;
  lastHeartbeatTs: number | null;
  setConnectionStatus: (status: SseConnectionStatus, errorReason?: string | null) => void;
  upsertKbarCurrent: (payload: KbarCurrentPayload) => void;
  upsertMetricLatest: (code: string, payload: MetricLatestPayload) => void;
  setIndexContribRanking: (payload: IndexContributionRankingPayload) => void;
  setIndexContribSector: (payload: IndexContributionSectorPayload) => void;
  upsertMarketSummaryLatest: (code: string, payload: MarketSummaryLatestPayload) => void;
  upsertOtcSummaryLatest: (code: string, payload: OtcSummaryLatestPayload) => void;
  upsertQuoteLatest: (code: string, payload: QuoteLatestPayload) => void;
  applySseBatch: (batch: {
    kbarCurrent?: KbarCurrentPayload;
    metricLatest?: { code: string; payload: MetricLatestPayload };
    metricLatestMap?: Record<string, MetricLatestPayload>;
    marketSummaryLatest?: { code: string; payload: MarketSummaryLatestPayload };
    marketSummaryMap?: Record<string, MarketSummaryLatestPayload>;
    otcSummaryLatest?: { code: string; payload: OtcSummaryLatestPayload };
    otcSummaryMap?: Record<string, OtcSummaryLatestPayload>;
    quoteLatest?: { code: string; payload: QuoteLatestPayload };
    quoteLatestMap?: Record<string, QuoteLatestPayload>;
    spotLatestList?: SpotLatestListPayload;
    spotMarketDistributionLatest?: SpotMarketDistributionLatestPayload;
    spotMarketDistributionSeries?: SpotMarketDistributionSeriesPayload;
    indexContribRanking?: IndexContributionRankingPayload | null;
    indexContribSector?: IndexContributionSectorPayload | null;
    heartbeatTs?: number;
  }) => void;
  setHeartbeat: (ts: number) => void;
  resetRealtime: () => void;
}

const SPOT_MARKET_DISTRIBUTION_SERIES_CAP = 600;

const initialState = {
  connectionStatus: "idle" as SseConnectionStatus,
  errorReason: null as string | null,
  kbarCurrentByCode: {} as Record<string, KbarCurrentPayload>,
  metricLatestByCode: {} as Record<string, MetricLatestPayload>,
  indexContribRanking: null as IndexContributionRankingPayload | null,
  indexContribSector: null as IndexContributionSectorPayload | null,
  marketSummaryLatestByCode: {} as Record<string, MarketSummaryLatestPayload>,
  otcSummaryLatestByCode: {} as Record<string, OtcSummaryLatestPayload>,
  quoteLatestByCode: {} as Record<string, QuoteLatestPayload>,
  spotLatestList: null as SpotLatestListPayload | null,
  spotMarketDistributionLatest: null as SpotMarketDistributionLatestPayload | null,
  spotMarketDistributionSeries: null as SpotMarketDistributionSeriesPayload | null,
  lastHeartbeatTs: null as number | null,
};

function toSpotMarketDistributionSeriesItem(
  payload: SpotMarketDistributionLatestPayload,
): SpotMarketDistributionSeriesItem {
  return {
    ts: payload.ts,
    up_count: payload.up_count,
    down_count: payload.down_count,
    flat_count: payload.flat_count,
    total_count: payload.total_count,
    trend_index: payload.trend_index,
  };
}

function appendSpotMarketDistributionSeries(
  current: SpotMarketDistributionSeriesPayload | null,
  next: SpotMarketDistributionSeriesItem,
): SpotMarketDistributionSeriesPayload | null {
  if (!current) {
    return { items: [next] };
  }
  const items = current.items;
  const last = items[items.length - 1];
  // If last item has same ts and same values, no-op (no allocation)
  if (
    last &&
    last.ts === next.ts &&
    last.up_count === next.up_count &&
    last.down_count === next.down_count &&
    last.flat_count === next.flat_count &&
    last.total_count === next.total_count &&
    last.trend_index === next.trend_index
  ) {
    return current;
  }

  // Mutate items in-place to avoid allocating a new array copy.
  if (last && last.ts === next.ts) {
    // replace last item in-place
    items[items.length - 1] = next;
  } else {
    items.push(next);
    if (items.length > SPOT_MARKET_DISTRIBUTION_SERIES_CAP) {
      // remove oldest excess items in-place
      items.splice(0, items.length - SPOT_MARKET_DISTRIBUTION_SERIES_CAP);
    }
  }

  // Return a new wrapper object so store subscribers see a changed reference,
  // but reuse the mutated items array to avoid copying its contents.
  return { items };
}

function shallowEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const k of aKeys) {
    if ((a as any)[k] !== (b as any)[k]) return false;
  }
  return true;
}

export const useRealtimeStore = create<RealtimeStore>((set) => ({
  ...initialState,
  setConnectionStatus: (status, errorReason = null) => set({ connectionStatus: status, errorReason }),
  upsertKbarCurrent: (payload) =>
    set((state) => ({
      kbarCurrentByCode: {
        ...state.kbarCurrentByCode,
        [payload.code]: payload,
      },
    })),
  upsertMetricLatest: (code, payload) =>
    set((state) => ({
      metricLatestByCode: {
        ...state.metricLatestByCode,
        [code]: payload,
      },
    })),
  setIndexContribRanking: (payload) => set({ indexContribRanking: payload }),
  setIndexContribSector: (payload) => set({ indexContribSector: payload }),
  upsertMarketSummaryLatest: (code, payload) =>
    set((state) => ({
      marketSummaryLatestByCode: {
        ...state.marketSummaryLatestByCode,
        [code]: payload,
      },
    })),
  upsertOtcSummaryLatest: (code, payload) =>
    set((state) => ({
      otcSummaryLatestByCode: {
        ...state.otcSummaryLatestByCode,
        [code]: payload,
      },
    })),
  upsertQuoteLatest: (code, payload) =>
    set((state) => ({
      quoteLatestByCode: {
        ...state.quoteLatestByCode,
        [code]: payload,
      },
    })),
  applySseBatch: (batch) =>
    set((state) => {
      const nextState: Partial<RealtimeStore> = {};
      let changed = false;

      if (batch.kbarCurrent) {
        const code = batch.kbarCurrent.code;
        const existing = state.kbarCurrentByCode[code];
        const existingTs = (existing as any)?.ts;
        const incomingTs = (batch.kbarCurrent as any)?.ts;
        if (!existing || incomingTs !== existingTs || existing !== batch.kbarCurrent) {
          nextState.kbarCurrentByCode = {
            ...state.kbarCurrentByCode,
            [code]: batch.kbarCurrent,
          };
          changed = true;
        }
      }

      // Support both single-item shape and map shape in batch for backward compatibility
      const metricEntries: Array<[string, MetricLatestPayload]> = [];
      if ((batch as any).metricLatest) {
        metricEntries.push([(batch as any).metricLatest.code, (batch as any).metricLatest.payload]);
      }
      if (batch.metricLatestMap) {
        for (const k of Object.keys(batch.metricLatestMap)) {
          metricEntries.push([k, batch.metricLatestMap[k] as MetricLatestPayload]);
        }
      }

      for (const [code, payload] of metricEntries) {
        const existing = state.metricLatestByCode[code];
        const existingTs = (existing as any)?.ts;
        const incomingTs = (payload as any)?.ts;
        if (!existing || incomingTs !== existingTs || !shallowEqual(existing, payload)) {
          if (!nextState.metricLatestByCode) nextState.metricLatestByCode = { ...state.metricLatestByCode };
          (nextState.metricLatestByCode as Record<string, MetricLatestPayload>)[code] = payload;
          changed = true;
        }
      }

      const marketEntries: Array<[string, MarketSummaryLatestPayload]> = [];
      if ((batch as any).marketSummaryLatest) {
        marketEntries.push([(batch as any).marketSummaryLatest.code, (batch as any).marketSummaryLatest.payload]);
      }
      if (batch.marketSummaryMap) {
        for (const k of Object.keys(batch.marketSummaryMap)) {
          marketEntries.push([k, batch.marketSummaryMap[k] as MarketSummaryLatestPayload]);
        }
      }

      for (const [code, payload] of marketEntries) {
        const existing = state.marketSummaryLatestByCode[code];
        const existingTs = (existing as any)?.ts;
        const incomingTs = (payload as any)?.ts;
        if (!existing || incomingTs !== existingTs || !shallowEqual(existing, payload)) {
          if (!nextState.marketSummaryLatestByCode) nextState.marketSummaryLatestByCode = { ...state.marketSummaryLatestByCode };
          (nextState.marketSummaryLatestByCode as Record<string, MarketSummaryLatestPayload>)[code] = payload;
          changed = true;
        }
      }

      const otcEntries: Array<[string, OtcSummaryLatestPayload]> = [];
      if ((batch as any).otcSummaryLatest) {
        otcEntries.push([(batch as any).otcSummaryLatest.code, (batch as any).otcSummaryLatest.payload]);
      }
      if (batch.otcSummaryMap) {
        for (const k of Object.keys(batch.otcSummaryMap)) {
          otcEntries.push([k, batch.otcSummaryMap[k] as OtcSummaryLatestPayload]);
        }
      }

      for (const [code, payload] of otcEntries) {
        const existing = state.otcSummaryLatestByCode[code];
        const existingTs = (existing as any)?.ts;
        const incomingTs = (payload as any)?.ts;
        if (!existing || incomingTs !== existingTs || !shallowEqual(existing, payload)) {
          if (!nextState.otcSummaryLatestByCode) nextState.otcSummaryLatestByCode = { ...state.otcSummaryLatestByCode };
          (nextState.otcSummaryLatestByCode as Record<string, OtcSummaryLatestPayload>)[code] = payload;
          changed = true;
        }
      }

      const quoteEntries: Array<[string, QuoteLatestPayload]> = [];
      if ((batch as any).quoteLatest) {
        quoteEntries.push([(batch as any).quoteLatest.code, (batch as any).quoteLatest.payload]);
      }
      if (batch.quoteLatestMap) {
        for (const k of Object.keys(batch.quoteLatestMap)) {
          quoteEntries.push([k, batch.quoteLatestMap[k] as QuoteLatestPayload]);
        }
      }

      for (const [code, payload] of quoteEntries) {
        const existing = state.quoteLatestByCode[code];
        const existingTs = (existing as any)?.ts;
        const incomingTs = (payload as any)?.ts;
        if (!existing || incomingTs !== existingTs || !shallowEqual(existing, payload)) {
          if (!nextState.quoteLatestByCode) nextState.quoteLatestByCode = { ...state.quoteLatestByCode };
          (nextState.quoteLatestByCode as Record<string, QuoteLatestPayload>)[code] = payload;
          changed = true;
        }
      }

      if (batch.spotLatestList) {
        if (!shallowEqual(state.spotLatestList, batch.spotLatestList)) {
          nextState.spotLatestList = batch.spotLatestList;
          changed = true;
        }
      }

      if (batch.spotMarketDistributionLatest) {
        if (!shallowEqual(state.spotMarketDistributionLatest, batch.spotMarketDistributionLatest)) {
          nextState.spotMarketDistributionLatest = batch.spotMarketDistributionLatest;
          if (!batch.spotMarketDistributionSeries) {
            const nextItem = toSpotMarketDistributionSeriesItem(batch.spotMarketDistributionLatest);
            const appended = appendSpotMarketDistributionSeries(state.spotMarketDistributionSeries, nextItem);
            if (appended && appended !== state.spotMarketDistributionSeries) {
              nextState.spotMarketDistributionSeries = appended;
            }
          }
          changed = true;
        }
      }

      if (batch.spotMarketDistributionSeries) {
        if (!shallowEqual(state.spotMarketDistributionSeries, batch.spotMarketDistributionSeries)) {
          nextState.spotMarketDistributionSeries = batch.spotMarketDistributionSeries;
          changed = true;
        }
      }

      if (batch.indexContribRanking !== undefined) {
        if (!shallowEqual(state.indexContribRanking, batch.indexContribRanking)) {
          nextState.indexContribRanking = batch.indexContribRanking;
          changed = true;
        }
      }

      if (batch.indexContribSector !== undefined) {
        if (!shallowEqual(state.indexContribSector, batch.indexContribSector)) {
          nextState.indexContribSector = batch.indexContribSector;
          changed = true;
        }
      }

      if (typeof batch.heartbeatTs === "number" && Number.isFinite(batch.heartbeatTs)) {
        if (state.lastHeartbeatTs !== batch.heartbeatTs) {
          nextState.lastHeartbeatTs = batch.heartbeatTs;
          changed = true;
        }
      }

      if (!changed) {
        return state;
      }

      return nextState as Partial<RealtimeStore>;
    }),
  setHeartbeat: (ts) => set({ lastHeartbeatTs: ts }),
  resetRealtime: () => set(initialState),
}));
