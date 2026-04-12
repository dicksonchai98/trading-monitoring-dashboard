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
});

export const MetricLatestSchema = z.object({
  bid: z.number().optional(),
  ask: z.number().optional(),
  mid: z.number().optional(),
  spread: z.number().optional(),
  bid_size: z.number().optional(),
  ask_size: z.number().optional(),
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

export const IndexContributionSectorSchema = z.object({
  index_code: z.string().min(1),
  trade_date: z.string().min(1),
  sectors: z.record(z.number()),
  ts: z.number(),
});
