import type { z } from "zod";
import type {
  HeartbeatSchema,
  IndexContributionRankingSchema,
  IndexContributionSectorSchema,
  KbarCurrentSchema,
  MetricLatestSchema,
} from "@/features/realtime/schemas/serving-event.schema";

export type SseConnectionStatus = "idle" | "connecting" | "connected" | "retrying" | "error";

export type KbarCurrentPayload = z.infer<typeof KbarCurrentSchema>;
export type MetricLatestPayload = z.infer<typeof MetricLatestSchema>;
export type HeartbeatPayload = z.infer<typeof HeartbeatSchema>;
export type IndexContributionRankingPayload = z.infer<typeof IndexContributionRankingSchema>;
export type IndexContributionSectorPayload = z.infer<typeof IndexContributionSectorSchema>;

export type ServingSseEventName =
  | "kbar_current"
  | "metric_latest"
  | "heartbeat"
  | "index_contrib_ranking"
  | "index_contrib_sector";
