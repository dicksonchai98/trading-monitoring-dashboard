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
