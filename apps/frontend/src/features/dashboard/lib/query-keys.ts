export function buildDashboardOrderFlowBaselineQueryKey(
  code: string,
): readonly [string, { code: string }] {
  return ["dashboard-order-flow-baseline", { code }] as const;
}

export function buildDashboardQuoteTodayQueryKey(
  code: string,
): readonly [string, { code: string }] {
  return ["dashboard-quote-today", { code }] as const;
}

export function buildDashboardEstimatedVolumeBaselineQueryKey(
  code: string,
): readonly [string, { code: string }] {
  return ["dashboard-estimated-volume-baseline", { code }] as const;
}

export function buildDashboardDailyAmplitudeQueryKey(
  code: string,
  historyLength: number,
): readonly [string, { code: string; historyLength: number }] {
  return ["dashboard-daily-amplitude-history", { code, historyLength }] as const;
}

export function buildDashboardSpotMarketDistributionBaselineQueryKey(): readonly [string] {
  return ["dashboard-spot-market-distribution-baseline"] as const;
}
