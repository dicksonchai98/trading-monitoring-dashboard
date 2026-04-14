import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import { PageLayout } from "@/components/ui/page-layout";
import { PanelCard } from "@/components/ui/panel-card";
import { Typography } from "@/components/ui/typography";
import { getAnalyticsMetrics, getDistributionStats } from "@/features/analytics/api/analytics";
import { AnalyticsEmptyState } from "@/features/analytics/components/AnalyticsEmptyState";
import { AnalyticsErrorState } from "@/features/analytics/components/AnalyticsErrorState";
import { AnalyticsFilterBar } from "@/features/analytics/components/AnalyticsFilterBar";
import {
  analyticsMetricsRegistryQueryKey,
  buildDistributionQueryKey,
} from "@/features/analytics/lib/query-keys";
import { useT } from "@/lib/i18n";
import { ApiError } from "@/lib/api/client";
import { useAuthStore } from "@/lib/store/auth-store";

export function DistributionAnalyticsPage(): JSX.Element {
  const t = useT();
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
    <PageLayout title={t("analytics.distribution.title")} bodyClassName="space-y-[var(--section-gap)]">
      <PanelCard title={t("analytics.filters.title")} span={12}>
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
          <Typography as="p" variant="body" className="mt-2 text-danger">
            {t("analytics.filters.invalidDateRange")}
          </Typography>
        ) : null}
      </PanelCard>

      {apiStatus && apiStatus >= 400 && apiStatus !== 401 && apiStatus !== 403 ? (
        <AnalyticsErrorState status={apiStatus} onRetry={() => void distributionQuery.refetch()} />
      ) : null}
      {hasInvalidDateRange ? <AnalyticsErrorState status={400} /> : null}

      <PanelCard title={t("analytics.summary.title")} span={6}>
        {distributionQuery.isLoading ? (
          <div className="space-y-2" data-testid="distribution-summary-skeleton">
            <div className="h-4 w-32 animate-pulse rounded bg-muted" />
            <div className="h-4 w-36 animate-pulse rounded bg-muted" />
            <div className="h-4 w-40 animate-pulse rounded bg-muted" />
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            <Typography as="p" variant="body">{t("analytics.distribution.sampleCount")}: {distributionQuery.data?.sample_count ?? 0}</Typography>
            <Typography as="p" variant="body">{t("analytics.distribution.mean")}: {distributionQuery.data?.mean ?? 0}</Typography>
            <Typography as="p" variant="body">{t("analytics.distribution.median")}: {distributionQuery.data?.median ?? 0}</Typography>
            <Typography as="p" variant="body">{t("analytics.distribution.percentiles")}: {distributionQuery.data?.p75 ?? 0} / {distributionQuery.data?.p90 ?? 0} / {distributionQuery.data?.p95 ?? 0}</Typography>
            <Typography as="p" variant="body">{t("analytics.distribution.minMax")}: {distributionQuery.data?.min ?? 0} / {distributionQuery.data?.max ?? 0}</Typography>
          </div>
        )}
      </PanelCard>

      <PanelCard title={t("analytics.distribution.histogram")} span={6}>
        {distributionQuery.isLoading ? (
          <div className="h-32 animate-pulse rounded bg-muted" data-testid="distribution-histogram-skeleton" />
        ) : !histogram || histogram.counts.length === 0 ? (
          <AnalyticsEmptyState title={t("analytics.distribution.emptyTitle")} description={t("analytics.distribution.emptyDescription")} />
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

      <PanelCard title={t("analytics.distribution.metricDefinition")} span={12}>
        <div className="space-y-1 text-sm">
          <Typography as="p" variant="body">{t("analytics.distribution.metricId")}: {(selectedMetric?.id ?? metricId) || "-"}</Typography>
          <Typography as="p" variant="body">{t("analytics.distribution.formula")}: {selectedMetric?.formula ?? t("analytics.common.notAvailable")}</Typography>
        </div>
      </PanelCard>
    </PageLayout>
  );
}
