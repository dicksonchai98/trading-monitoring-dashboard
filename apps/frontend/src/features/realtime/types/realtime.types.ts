import type { z } from "zod";
import type {
  HeartbeatSchema,
  KbarCurrentSchema,
  MarketSummaryLatestSchema,
  MetricLatestSchema,
  OtcSummaryLatestSchema,
  QuoteLatestSchema,
  SpotLatestListSchema,
} from "@/features/realtime/schemas/serving-event.schema";

export type SseConnectionStatus = "idle" | "connecting" | "connected" | "retrying" | "error";

export type KbarCurrentPayload = z.infer<typeof KbarCurrentSchema>;
export type MetricLatestPayload = z.infer<typeof MetricLatestSchema>;
export type MarketSummaryLatestPayload = z.infer<typeof MarketSummaryLatestSchema>;
export type OtcSummaryLatestPayload = z.infer<typeof OtcSummaryLatestSchema>;
export type QuoteLatestPayload = z.infer<typeof QuoteLatestSchema>;
export type HeartbeatPayload = z.infer<typeof HeartbeatSchema>;
export type SpotLatestListPayload = z.infer<typeof SpotLatestListSchema>;

export type ServingSseEventName =
  | "kbar_current"
  | "metric_latest"
  | "market_summary_latest"
  | "otc_summary_latest"
  | "quote_latest"
  | "spot_latest_list"
  | "heartbeat";
