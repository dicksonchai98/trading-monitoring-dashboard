import type { z } from "zod";
import type {
  HeartbeatSchema,
  IndexContributionRankingSchema,
  IndexContributionSectorSchema,
  KbarCurrentSchema,
  MarketSummaryLatestSchema,
  MetricLatestSchema,
  OtcSummaryLatestSchema,
  QuoteLatestSchema,
  SpotMarketDistributionLatestSchema,
  SpotMarketDistributionSeriesSchema,
  SpotLatestListSchema,
} from "@/features/realtime/schemas/serving-event.schema";

export type SseConnectionStatus = "idle" | "connecting" | "connected" | "retrying" | "error";

export type KbarCurrentPayload = z.infer<typeof KbarCurrentSchema>;
export type MetricLatestPayload = z.infer<typeof MetricLatestSchema>;
export type MarketSummaryLatestPayload = z.infer<typeof MarketSummaryLatestSchema>;
export type OtcSummaryLatestPayload = z.infer<typeof OtcSummaryLatestSchema>;
export type QuoteLatestPayload = z.infer<typeof QuoteLatestSchema>;
export type HeartbeatPayload = z.infer<typeof HeartbeatSchema>;
export type IndexContributionRankingPayload = z.infer<typeof IndexContributionRankingSchema>;
export type IndexContributionSectorPayload = z.infer<typeof IndexContributionSectorSchema>;
export type SpotLatestListPayload = z.infer<typeof SpotLatestListSchema>;
export type SpotMarketDistributionLatestPayload = z.infer<
  typeof SpotMarketDistributionLatestSchema
>;
export type SpotMarketDistributionSeriesPayload = z.infer<
  typeof SpotMarketDistributionSeriesSchema
>;

export type ServingSseEventName =
  | "kbar_current"
  | "metric_latest"
  | "index_contrib_ranking"
  | "index_contrib_sector"
  | "market_summary_latest"
  | "otc_summary_latest"
  | "quote_latest"
  | "spot_latest_list"
  | "spot_market_distribution_latest"
  | "spot_market_distribution_series"
  | "heartbeat";
