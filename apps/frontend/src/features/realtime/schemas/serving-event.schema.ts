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
