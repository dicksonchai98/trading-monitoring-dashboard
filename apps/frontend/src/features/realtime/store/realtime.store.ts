import { create } from "zustand";
import type {
  KbarCurrentPayload,
  MarketSummaryLatestPayload,
  MetricLatestPayload,
  SseConnectionStatus,
} from "@/features/realtime/types/realtime.types";

interface RealtimeStore {
  connectionStatus: SseConnectionStatus;
  errorReason: string | null;
  kbarCurrentByCode: Record<string, KbarCurrentPayload>;
  metricLatestByCode: Record<string, MetricLatestPayload>;
  marketSummaryLatestByCode: Record<string, MarketSummaryLatestPayload>;
  lastHeartbeatTs: number | null;
  setConnectionStatus: (status: SseConnectionStatus, errorReason?: string | null) => void;
  upsertKbarCurrent: (payload: KbarCurrentPayload) => void;
  upsertMetricLatest: (code: string, payload: MetricLatestPayload) => void;
  upsertMarketSummaryLatest: (code: string, payload: MarketSummaryLatestPayload) => void;
  setHeartbeat: (ts: number) => void;
  resetRealtime: () => void;
}

const initialState = {
  connectionStatus: "idle" as SseConnectionStatus,
  errorReason: null as string | null,
  kbarCurrentByCode: {} as Record<string, KbarCurrentPayload>,
  metricLatestByCode: {} as Record<string, MetricLatestPayload>,
  marketSummaryLatestByCode: {} as Record<string, MarketSummaryLatestPayload>,
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
  setHeartbeat: (ts) => set({ lastHeartbeatTs: ts }),
  resetRealtime: () => set(initialState),
}));
