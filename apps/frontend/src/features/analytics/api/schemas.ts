import { z } from "zod";

export const AnalyticsRegistryItemSchema = z.object({
  id: z.string(),
  label: z.string().optional(),
  formula: z.string().optional(),
  description: z.string().optional(),
});

export const AnalyticsEventsRegistryResponseSchema = z.object({
  events: z.array(AnalyticsRegistryItemSchema),
});

export const AnalyticsMetricsRegistryResponseSchema = z.object({
  metrics: z.array(AnalyticsRegistryItemSchema),
});

export const EventStatsResponseSchema = z.object({
  event_id: z.string(),
  code: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  sample_count: z.number(),
  up_count: z.number().optional(),
  down_count: z.number().optional(),
  flat_count: z.number().optional(),
  up_probability: z.number(),
  down_probability: z.number(),
  flat_probability: z.number(),
  avg_next_day_return: z.number(),
  median_next_day_return: z.number().optional(),
  avg_next_day_range: z.number(),
  avg_next_day_gap: z.number().optional(),
  computed_at: z.string().optional(),
  version: z.union([z.string(), z.number()]).optional(),
  histogram: z
    .object({
      bins: z.array(z.string()),
      counts: z.array(z.number()),
    })
    .optional(),
});

export const EventStatsListResponseSchema = z.object({
  items: z.array(EventStatsResponseSchema),
});

export const EventSampleItemSchema = z.object({
  trade_date: z.string(),
  next_day_return: z.number(),
  next_day_category: z.string(),
});

export const EventSamplesResponseSchema = z.object({
  items: z.array(EventSampleItemSchema),
  page: z.number().int(),
  page_size: z.number().int(),
  total: z.number().int(),
});

export const DistributionStatsResponseSchema = z.object({
  metric_id: z.string(),
  sample_count: z.number(),
  mean: z.number(),
  median: z.number(),
  min: z.number(),
  max: z.number(),
  p75: z.number(),
  p90: z.number(),
  p95: z.number(),
  version: z.union([z.string(), z.number()]).optional(),
  computed_at: z.string().optional(),
  histogram_json: z
    .object({
      bins: z.array(z.union([z.string(), z.number()])),
      counts: z.array(z.number()),
      min: z.number().optional(),
      max: z.number().optional(),
      bucket_size: z.number().optional(),
    })
    .optional(),
});

