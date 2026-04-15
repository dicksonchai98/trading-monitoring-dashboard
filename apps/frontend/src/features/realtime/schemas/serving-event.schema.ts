import { z } from "zod";

export const KbarCurrentSchema = z.object({
  code: z.string().min(1),
  trade_date: z.string().min(1),
  minute_ts: z.number(),
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
  volume: z.number(),
  day_amplitude: z.number().nullable().optional(),
});

export const MetricLatestSchema = z.object({
  bid: z.number().optional(),
  ask: z.number().optional(),
  mid: z.number().optional(),
  spread: z.number().optional(),
  bid_size: z.number().optional(),
  ask_size: z.number().optional(),
  main_force_big_order: z.number().optional(),
  main_force_big_order_strength: z.number().nullable().optional(),
  event_ts: z.string().optional(),
  ts: z.number().optional(),
});

export const HeartbeatSchema = z.object({
  ts: z.number(),
});

export const IndexContributionRankingRowSchema = z.object({
  rank_no: z.number().int().positive(),
  symbol: z.string().min(1),
  contribution_points: z.number(),
});

export const IndexContributionRankingSchema = z.object({
  index_code: z.string().min(1),
  trade_date: z.string().min(1),
  top: z.array(IndexContributionRankingRowSchema),
  bottom: z.array(IndexContributionRankingRowSchema),
  ts: z.number(),
});

export const IndexContributionSectorItemSchema = z.object({
  name: z.string().min(1),
  size: z.number(),
  contribution_points: z.number(),
});

export const IndexContributionSectorGroupSchema = z.object({
  name: z.string().min(1),
  children: z.array(IndexContributionSectorItemSchema),
});

export const IndexContributionSectorSchema = z.object({
  index_code: z.string().min(1),
  trade_date: z.string().min(1),
  sectors: z.array(IndexContributionSectorGroupSchema),
  ts: z.number(),
});

export const MarketSummaryLatestSchema = z.object({
  code: z.string().trim().min(1).optional(),
  market_code: z.string().trim().min(1).optional(),
  minute_ts: z.number().optional(),
  event_ts: z.number().optional(),
  spread: z.number().nullable().optional(),
  estimated_turnover: z.number().nullable().optional(),
  yesterday_estimated_turnover: z.number().nullable().optional(),
  estimated_turnover_diff: z.number().nullable().optional(),
  estimated_turnover_ratio: z.number().nullable().optional(),
  cumulative_turnover: z.number().nullable().optional(),
});

export const OtcSummaryLatestSchema = z.object({
  code: z.string().trim().min(1).optional(),
  minute_ts: z.number().optional(),
  event_ts: z.number().optional(),
  index_value: z.number().nullable().optional(),
});

export const QuoteLatestSchema = z.object({
  code: z.string().trim().min(1).optional(),
  event_ts: z.union([z.number(), z.string()]).optional(),
  ts: z.union([z.number(), z.string()]).optional(),
  main_chip: z.number().nullable().optional(),
  long_short_force: z.number().nullable().optional(),
  main_chip_strength: z.number().nullable().optional(),
  long_short_force_strength: z.number().nullable().optional(),
});

export const SpotLatestListSchema = z.object({
  ts: z.number(),
  market_strength_score: z.number().nullable().optional(),
  market_strength_pct: z.number().nullable().optional(),
  market_strength_count: z.number().int().nonnegative().optional(),
  sector_strength: z
    .object({
      weighted: z.number().nullable().optional(),
      financial: z.number().nullable().optional(),
      tech: z.number().nullable().optional(),
    })
    .optional(),
  market_strength_breakdown: z
    .object({
      new_high: z.number().int().nonnegative().optional(),
      strong_up: z.number().int().nonnegative().optional(),
      flat: z.number().int().nonnegative().optional(),
      strong_down: z.number().int().nonnegative().optional(),
      new_low: z.number().int().nonnegative().optional(),
    })
    .optional(),
  items: z.array(
    z.object({
      symbol: z.string().trim().min(1),
      open: z.number().nullable().optional(),
      high: z.number().nullable().optional(),
      low: z.number().nullable().optional(),
      close: z.number().nullable().optional(),
      last_price: z.number().nullable().optional(),
      session_high: z.number().nullable().optional(),
      session_low: z.number().nullable().optional(),
      reference_price: z.number().nullable().optional(),
      price_chg: z.number().nullable().optional(),
      pct_chg: z.number().nullable().optional(),
      gap_value: z.number().nullable().optional(),
      gap_pct: z.number().nullable().optional(),
      is_gap_up: z.boolean().nullable().optional(),
      is_gap_down: z.boolean().nullable().optional(),
      is_new_high: z.boolean().nullable().optional(),
      is_new_low: z.boolean().nullable().optional(),
      strength_state: z
        .enum(["new_high", "strong_up", "flat", "strong_down", "new_low"])
        .nullable()
        .optional(),
      strength_score: z.number().nullable().optional(),
      strength_pct: z.number().nullable().optional(),
      updated_at: z.number().nullable().optional(),
    }),
  ),
});

export const SpotMarketDistributionBucketSchema = z.object({
  label: z.string().min(1),
  lower_pct: z.number(),
  upper_pct: z.number(),
  count: z.number().int().nonnegative(),
});

export const SpotMarketDistributionLatestSchema = z.object({
  ts: z.number(),
  up_count: z.number().int().nonnegative(),
  down_count: z.number().int().nonnegative(),
  flat_count: z.number().int().nonnegative(),
  total_count: z.number().int().nonnegative(),
  trend_index: z.number().nullable().optional(),
  bucket_width_pct: z.number().int().positive(),
  distribution_buckets: z.array(SpotMarketDistributionBucketSchema),
});

export const SpotMarketDistributionSeriesItemSchema = z.object({
  ts: z.number(),
  up_count: z.number().int().nonnegative(),
  down_count: z.number().int().nonnegative(),
  flat_count: z.number().int().nonnegative(),
  total_count: z.number().int().nonnegative(),
  trend_index: z.number().nullable().optional(),
});

export const SpotMarketDistributionSeriesSchema = z.object({
  items: z.array(SpotMarketDistributionSeriesItemSchema),
});
