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
  sample_count: z.number(),
  up_probability: z.number(),
  down_probability: z.number(),
  flat_probability: z.number(),
  avg_next_day_return: z.number(),
  avg_next_day_range: z.number(),
  computed_at: z.string().optional(),
  version: z.string().optional(),
  histogram: z
    .object({
      bins: z.array(z.string()),
      counts: z.array(z.number()),
    })
    .optional(),
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
  version: z.string().optional(),
  computed_at: z.string().optional(),
  histogram_json: z
    .object({
      bins: z.array(z.string()),
      counts: z.array(z.number()),
      min: z.number().optional(),
      max: z.number().optional(),
      bucket_size: z.number().optional(),
    })
    .optional(),
});

