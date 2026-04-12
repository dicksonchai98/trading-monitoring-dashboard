import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import { PageLayout } from "@/components/ui/page-layout";
import { PanelCard } from "@/components/ui/panel-card";
import { getAnalyticsMetrics, getDistributionStats } from "@/features/analytics/api/analytics";
import { AnalyticsEmptyState } from "@/features/analytics/components/AnalyticsEmptyState";
import { AnalyticsErrorState } from "@/features/analytics/components/AnalyticsErrorState";
import { AnalyticsFilterBar } from "@/features/analytics/components/AnalyticsFilterBar";
import {
  analyticsMetricsRegistryQueryKey,
  buildDistributionQueryKey,
} from "@/features/analytics/lib/query-keys";
import { ApiError } from "@/lib/api/client";
import { useAuthStore } from "@/lib/store/auth-store";

export function DistributionAnalyticsPage(): JSX.Element {
  const { token } = useAuthStore();
  const [code, setCode] = useState("TXF");
  const [startDate, setStartDate] = useState("2026-01-01");
  const [endDate, setEndDate] = useState("2026-01-31");
  const [metricId, setMetricId] = useState("");
  const version = "latest";
  const hasInvalidDateRange = startDate > endDate;

  const metricsQuery = useQuery({
    queryKey: analyticsMetricsRegistryQueryKey,
    queryFn: () => getAnalyticsMetrics(token),
  });
  const metrics = metricsQuery.data?.metrics ?? [];
  const selectedMetric = metrics.find((item) => item.id === metricId);
  useEffect(() => {
    if (!metricId && metrics.length > 0) {
      setMetricId(metrics[0].id);
    }
  }, [metricId, metrics]);

  const distributionQuery = useQuery({
    queryKey: buildDistributionQueryKey({
      metricId,
      code,
      startDate,
      endDate,
      version,
    }),
    queryFn: () =>
      getDistributionStats(token, {
        metricId,
        code,
        startDate,
        endDate,
        version,
      }),
    enabled: Boolean(metricId) && !hasInvalidDateRange,
  });

  const apiStatus = useMemo(() => {
    const err = distributionQuery.error ?? metricsQuery.error;
    if (err instanceof ApiError) {
      return err.status;
    }
    return undefined;
  }, [distributionQuery.error, metricsQuery.error]);

  if (apiStatus === 401) {
    return <Navigate to="/login" replace />;
  }
  if (apiStatus === 403) {
    return <Navigate to="/forbidden" replace />;
  }

  const histogram = distributionQuery.data?.histogram_json;

  return (
    <PageLayout title="Distribution Analytics" bodyClassName="space-y-[var(--section-gap)]">
      <PanelCard title="Filters" span={12}>
        <AnalyticsFilterBar
          code={code}
          startDate={startDate}
          endDate={endDate}
          metricId={metricId}
          metrics={metrics}
          onCodeChange={(value) => setCode(value)}
          onStartDateChange={(value) => setStartDate(value)}
          onEndDateChange={(value) => setEndDate(value)}
          onMetricIdChange={(value) => setMetricId(value)}
        />
        {hasInvalidDateRange ? (
          <p className="mt-2 text-sm text-danger">Invalid date range: start date must be before or equal to end date.</p>
        ) : null}
      </PanelCard>

      {apiStatus && apiStatus >= 400 && apiStatus !== 401 && apiStatus !== 403 ? (
        <AnalyticsErrorState status={apiStatus} onRetry={() => void distributionQuery.refetch()} />
      ) : null}
      {hasInvalidDateRange ? <AnalyticsErrorState status={400} /> : null}

      <PanelCard title="Summary" span={6}>
        {distributionQuery.isLoading ? (
          <div className="space-y-2" data-testid="distribution-summary-skeleton">
            <div className="h-4 w-32 animate-pulse rounded bg-muted" />
            <div className="h-4 w-36 animate-pulse rounded bg-muted" />
            <div className="h-4 w-40 animate-pulse rounded bg-muted" />
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            <p>Sample Count: {distributionQuery.data?.sample_count ?? 0}</p>
            <p>Mean: {distributionQuery.data?.mean ?? 0}</p>
            <p>Median: {distributionQuery.data?.median ?? 0}</p>
            <p>P75 / P90 / P95: {distributionQuery.data?.p75 ?? 0} / {distributionQuery.data?.p90 ?? 0} / {distributionQuery.data?.p95 ?? 0}</p>
            <p>Min / Max: {distributionQuery.data?.min ?? 0} / {distributionQuery.data?.max ?? 0}</p>
          </div>
        )}
      </PanelCard>

      <PanelCard title="Histogram" span={6}>
        {distributionQuery.isLoading ? (
          <div className="h-32 animate-pulse rounded bg-muted" data-testid="distribution-histogram-skeleton" />
        ) : !histogram || histogram.counts.length === 0 ? (
          <AnalyticsEmptyState title="No distribution data" description="No histogram buckets for current filter." />
        ) : (
          <ul className="space-y-1 text-sm">
            {histogram.bins.map((bin, index) => (
              <li key={`${bin}-${index}`}>
                {bin}: {histogram.counts[index] ?? 0}
              </li>
            ))}
          </ul>
        )}
      </PanelCard>

      <PanelCard title="Metric Definition" span={12}>
        <div className="space-y-1 text-sm">
          <p>Metric ID: {(selectedMetric?.id ?? metricId) || "-"}</p>
          <p>Formula: {selectedMetric?.formula ?? "N/A"}</p>
        </div>
      </PanelCard>
    </PageLayout>
  );
}
