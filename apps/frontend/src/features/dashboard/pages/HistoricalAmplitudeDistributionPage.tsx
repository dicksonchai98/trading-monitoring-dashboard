import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Navigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { BentoGridSection } from "@/components/ui/bento-grid";
import { PageLayout } from "@/components/ui/page-layout";
import { PanelCard } from "@/components/ui/panel-card";
import { getAnalyticsMetrics, getDistributionStats } from "@/features/analytics/api/analytics";
import { ApiError } from "@/lib/api/client";
import { useAuthStore } from "@/lib/store/auth-store";

interface HistogramRow {
  label: string;
  count: number;
  start: number;
  end: number;
}

function parseBinRange(raw: string): { start: number; end: number } {
  const [startRaw, endRaw] = raw.split("~");
  const start = Number(startRaw);
  const end = Number(endRaw);
  return {
    start: Number.isFinite(start) ? start : 0,
    end: Number.isFinite(end) ? end : 0,
  };
}

function toHistogramRows(bins: string[], counts: number[]): HistogramRow[] {
  return bins.map((bin, index) => {
    const { start, end } = parseBinRange(bin);
    return {
      label: bin,
      count: counts[index] ?? 0,
      start,
      end,
    };
  });
}

export function HistoricalAmplitudeDistributionPage(): JSX.Element {
  const { token } = useAuthStore();
  const [code, setCode] = useState("TXF");
  const [startDate, setStartDate] = useState("2026-01-01");
  const [endDate, setEndDate] = useState("2026-01-31");
  const [metricId, setMetricId] = useState("");
  const version = "latest";
  const hasInvalidDateRange = startDate > endDate;

  const metricsQuery = useQuery({
    queryKey: ["historical-amplitude-metrics"],
    queryFn: () => getAnalyticsMetrics(token),
  });
  const metrics = metricsQuery.data?.metrics ?? [];

  useEffect(() => {
    if (!metricId && metrics.length > 0) {
      setMetricId(metrics[0].id);
    }
  }, [metricId, metrics]);

  const distributionQuery = useQuery({
    queryKey: ["historical-amplitude-distribution", metricId, code, startDate, endDate, version],
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
  const histogramRows = histogram ? toHistogramRows(histogram.bins, histogram.counts) : [];
  const upDays = histogramRows
    .filter((row) => row.start >= 0)
    .reduce((sum, row) => sum + row.count, 0);
  const downDays = histogramRows
    .filter((row) => row.end <= 0)
    .reduce((sum, row) => sum + row.count, 0);

  return (
    <PageLayout
      title="Historical Amplitude Distribution"
      actions={<Badge variant="info">Histogram</Badge>}
      bodyClassName="space-y-[var(--section-gap)]"
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
            Code
          </span>
          <select
            className="h-9 rounded-sm border border-border bg-card px-3 text-sm text-foreground"
            onChange={(event) => setCode(event.target.value)}
            value={code}
          >
            <option value="TXFR1">TXFR1</option>
            <option value="TXFD1">TXFD1</option>
            <option value="TXF">TXF</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 md:col-span-2">
          <span className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
            Metric
          </span>
          <select
            className="h-9 rounded-sm border border-border bg-card px-3 text-sm text-foreground"
            onChange={(event) => setMetricId(event.target.value)}
            value={metricId}
          >
            {metrics.map((metric) => (
              <option key={metric.id} value={metric.id}>
                {metric.label ?? metric.id}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
            From
          </span>
          <input
            className="h-9 rounded-sm border border-border bg-card px-2 text-sm text-foreground"
            onChange={(event) => setStartDate(event.target.value)}
            type="date"
            value={startDate}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
            To
          </span>
          <input
            className="h-9 rounded-sm border border-border bg-card px-2 text-sm text-foreground"
            onChange={(event) => setEndDate(event.target.value)}
            type="date"
            value={endDate}
          />
        </label>
      </div>

      <BentoGridSection title="HISTORICAL AMPLITUDE DISTRIBUTION">
        <PanelCard
          title="Distribution Histogram"
          span={12}
          note="Center(0): neutral. Left side: down days. Right side: up days."
          meta={`${distributionQuery.data?.sample_count ?? 0} samples`}
          units={2}
        >
          <div className="mt-[var(--panel-gap)] space-y-3">
            {hasInvalidDateRange ? (
              <div className="rounded-sm border border-[#ef4444]/40 bg-[#ef4444]/10 px-3 py-2 text-sm text-[#ef4444]">
                Invalid date range: start date must be before or equal to end date.
              </div>
            ) : null}

            {apiStatus && apiStatus >= 400 && apiStatus !== 401 && apiStatus !== 403 ? (
              <div className="rounded-sm border border-[#ef4444]/40 bg-[#ef4444]/10 px-3 py-2 text-sm text-[#ef4444]">
                Failed to load distribution data (HTTP {apiStatus}).
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="success">Up Days: {upDays}</Badge>
              <Badge variant="danger">Down Days: {downDays}</Badge>
              <Badge variant="neutral">Net: {upDays - downDays}</Badge>
            </div>

            {distributionQuery.isLoading ? (
              <div className="h-[300px] w-full animate-pulse rounded bg-muted" data-testid="amplitude-histogram-loading" />
            ) : histogramRows.length === 0 ? (
              <div className="rounded-sm border border-border px-3 py-2 text-sm text-muted-foreground" data-testid="amplitude-histogram-empty">
                No histogram data for current filters.
              </div>
            ) : (
              <div className="h-[300px] w-full" data-testid="amplitude-histogram-chart">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <BarChart barCategoryGap="0%" data={histogramRows} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                    <XAxis
                      axisLine={false}
                      dataKey="label"
                      interval={1}
                      tick={{ fill: "hsl(var(--subtle-foreground))", fontSize: 10 }}
                      tickLine={false}
                    />
                    <YAxis
                      axisLine={false}
                      allowDecimals={false}
                      tick={{ fill: "hsl(var(--subtle-foreground))", fontSize: 11 }}
                      tickLine={false}
                      width={44}
                    />
                    <ReferenceLine stroke="#94a3b8" strokeDasharray="2 2" x="0~0" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "4px",
                        color: "hsl(var(--foreground))",
                      }}
                      formatter={(value) => [`${Number(value ?? 0)} days`, "Count"]}
                      labelFormatter={(label) => `Amplitude bucket: ${label} pts`}
                    />
                    <Bar dataKey="count">
                      {histogramRows.map((bin) => {
                        const color =
                          bin.end <= 0
                            ? "#22c55e"
                            : bin.start >= 0
                              ? "#ef4444"
                              : "#94a3b8";
                        return <Cell fill={color} key={bin.label} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </PanelCard>
      </BentoGridSection>
    </PageLayout>
  );
}
