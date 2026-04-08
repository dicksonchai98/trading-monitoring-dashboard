import type { z } from "zod";
import type {
  HeartbeatSchema,
  KbarCurrentSchema,
  MarketSummaryLatestSchema,
  MetricLatestSchema,
} from "@/features/realtime/schemas/serving-event.schema";

export type SseConnectionStatus = "idle" | "connecting" | "connected" | "retrying" | "error";

export type KbarCurrentPayload = z.infer<typeof KbarCurrentSchema>;
export type MetricLatestPayload = z.infer<typeof MetricLatestSchema>;
export type MarketSummaryLatestPayload = z.infer<typeof MarketSummaryLatestSchema>;
export type HeartbeatPayload = z.infer<typeof HeartbeatSchema>;

export type ServingSseEventName =
  | "kbar_current"
  | "metric_latest"
  | "market_summary_latest"
  | "heartbeat";
