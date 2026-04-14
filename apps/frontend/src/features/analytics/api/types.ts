import type { z } from "zod";
import {
  AnalyticsEventsRegistryResponseSchema,
  AnalyticsMetricsRegistryResponseSchema,
  AnalyticsRegistryItemSchema,
  DistributionStatsResponseSchema,
  EventSampleItemSchema,
  EventStatsListResponseSchema,
  EventSamplesResponseSchema,
  EventStatsResponseSchema,
} from "@/features/analytics/api/schemas";

export type AnalyticsRegistryItem = z.infer<typeof AnalyticsRegistryItemSchema>;
export type AnalyticsEventsRegistryResponse = z.infer<typeof AnalyticsEventsRegistryResponseSchema>;
export type AnalyticsMetricsRegistryResponse = z.infer<typeof AnalyticsMetricsRegistryResponseSchema>;
export type EventStatsResponse = z.infer<typeof EventStatsResponseSchema>;
export type EventStatsListResponse = z.infer<typeof EventStatsListResponseSchema>;
export type EventSampleItem = z.infer<typeof EventSampleItemSchema>;
export type EventSamplesResponse = z.infer<typeof EventSamplesResponseSchema>;
export type DistributionStatsResponse = z.infer<typeof DistributionStatsResponseSchema>;
