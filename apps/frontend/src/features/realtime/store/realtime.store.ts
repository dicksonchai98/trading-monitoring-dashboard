import { create } from "zustand";
import type {
  KbarCurrentPayload,
  MarketSummaryLatestPayload,
  MetricLatestPayload,
  OtcSummaryLatestPayload,
  SseConnectionStatus,
  SpotLatestListPayload,
} from "@/features/realtime/types/realtime.types";

interface RealtimeStore {
  connectionStatus: SseConnectionStatus;
  errorReason: string | null;
  kbarCurrentByCode: Record<string, KbarCurrentPayload>;
  metricLatestByCode: Record<string, MetricLatestPayload>;
  marketSummaryLatestByCode: Record<string, MarketSummaryLatestPayload>;
  otcSummaryLatestByCode: Record<string, OtcSummaryLatestPayload>;
  spotLatestList: SpotLatestListPayload | null;
  lastHeartbeatTs: number | null;
  setConnectionStatus: (status: SseConnectionStatus, errorReason?: string | null) => void;
  upsertKbarCurrent: (payload: KbarCurrentPayload) => void;
  upsertMetricLatest: (code: string, payload: MetricLatestPayload) => void;
  upsertMarketSummaryLatest: (code: string, payload: MarketSummaryLatestPayload) => void;
  upsertOtcSummaryLatest: (code: string, payload: OtcSummaryLatestPayload) => void;
  applySseBatch: (batch: {
    kbarCurrent?: KbarCurrentPayload;
    metricLatest?: { code: string; payload: MetricLatestPayload };
    marketSummaryLatest?: { code: string; payload: MarketSummaryLatestPayload };
    otcSummaryLatest?: { code: string; payload: OtcSummaryLatestPayload };
    spotLatestList?: SpotLatestListPayload;
    heartbeatTs?: number;
  }) => void;
  setHeartbeat: (ts: number) => void;
  resetRealtime: () => void;
}

const initialState = {
  connectionStatus: "idle" as SseConnectionStatus,
  errorReason: null as string | null,
  kbarCurrentByCode: {} as Record<string, KbarCurrentPayload>,
  metricLatestByCode: {} as Record<string, MetricLatestPayload>,
  marketSummaryLatestByCode: {} as Record<string, MarketSummaryLatestPayload>,
  otcSummaryLatestByCode: {} as Record<string, OtcSummaryLatestPayload>,
  spotLatestList: null as SpotLatestListPayload | null,
  lastHeartbeatTs: null as number | null,
};

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
  applySseBatch: (batch) =>
    set((state) => {
      const nextState: Partial<RealtimeStore> = {};
      let changed = false;

      if (batch.kbarCurrent) {
        nextState.kbarCurrentByCode = {
          ...state.kbarCurrentByCode,
          [batch.kbarCurrent.code]: batch.kbarCurrent,
        };
        changed = true;
      }

      if (batch.metricLatest) {
        nextState.metricLatestByCode = {
          ...state.metricLatestByCode,
          [batch.metricLatest.code]: batch.metricLatest.payload,
        };
        changed = true;
      }

      if (batch.marketSummaryLatest) {
        nextState.marketSummaryLatestByCode = {
          ...state.marketSummaryLatestByCode,
          [batch.marketSummaryLatest.code]: batch.marketSummaryLatest.payload,
        };
        changed = true;
      }

      if (batch.otcSummaryLatest) {
        nextState.otcSummaryLatestByCode = {
          ...state.otcSummaryLatestByCode,
          [batch.otcSummaryLatest.code]: batch.otcSummaryLatest.payload,
        };
        changed = true;
      }

      if (batch.spotLatestList) {
        nextState.spotLatestList = batch.spotLatestList;
        changed = true;
      }

      if (typeof batch.heartbeatTs === "number" && Number.isFinite(batch.heartbeatTs)) {
        nextState.lastHeartbeatTs = batch.heartbeatTs;
        changed = true;
      }

      if (!changed) {
        return state;
      }

      return nextState as Partial<RealtimeStore>;
    }),
  setHeartbeat: (ts) => set({ lastHeartbeatTs: ts }),
  resetRealtime: () => set(initialState),
}));
