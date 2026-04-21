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
import { ApiStatusAlert } from "@/components/ui/api-status-alert";
import { FilterLayer, type FilterField } from "@/components/filter-layer";
import { PageLayout } from "@/components/ui/page-layout";
import { PanelCard } from "@/components/ui/panel-card";
import { useT, type TranslationKey } from "@/lib/i18n";
import {
  getAnalyticsMetrics,
  getDistributionStats,
} from "@/features/analytics/api/analytics";
import { ApiError } from "@/lib/api/client";
import { useAuthStore } from "@/lib/store/auth-store";

interface HistogramRow {
  label: string;
  count: number;
  start: number;
  end: number;
}

const METRIC_LABEL_KEYS: Partial<Record<string, TranslationKey>> = {
  day_range: "dashboard.amplitude.metric.day_range",
  day_range_pct: "dashboard.amplitude.metric.day_range_pct",
  day_return: "dashboard.amplitude.metric.day_return",
  day_return_pct: "dashboard.amplitude.metric.day_return_pct",
  gap_from_prev_close: "dashboard.amplitude.metric.gap_from_prev_close",
  close_position: "dashboard.amplitude.metric.close_position",
};

function mapMetricLabel(
  metricId: string,
  t: ReturnType<typeof useT>,
  fallbackLabel?: string,
): string {
  const key = METRIC_LABEL_KEYS[metricId];
  return key ? t(key) : (fallbackLabel ?? metricId);
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

function toHistogramRows(
  bins: Array<string | number>,
  counts: number[],
): HistogramRow[] {
  if (bins.length === 0) {
    return [];
  }

  const toNumericEdges = (): number[] => {
    if (typeof bins[0] === "number") {
      return bins.filter((edge): edge is number => typeof edge === "number");
    }
    const stringBins = bins.filter(
      (edge): edge is string => typeof edge === "string",
    );
    const allNumeric = stringBins.every(
      (edge) => edge.includes("~") === false && Number.isFinite(Number(edge)),
    );
    if (!allNumeric) {
      return [];
    }
    return stringBins.map((edge) => Number(edge));
  };

  const edges = toNumericEdges();
  if (edges.length > 0) {
    if (edges.length < 2) {
      return [];
    }

    return counts.map((count, index) => {
      const start = edges[index] ?? edges[0];
      const end = edges[index + 1] ?? edges[edges.length - 1];
      return {
        label: `${start.toFixed(2)}~${end.toFixed(2)}`,
        count,
        start,
        end,
      };
    });
  }

  return bins.map((bin, index) => {
    const label = String(bin);
    const { start, end } = parseBinRange(label);
    return {
      label,
      count: counts[index] ?? 0,
      start,
      end,
    };
  });
}

export function HistoricalAmplitudeDistributionPage(): JSX.Element {
  const t = useT();
  const { token } = useAuthStore();
  const [code, setCode] = useState("TXFR1");
  const [metricId, setMetricId] = useState("");
  const version = "latest";

  const metricsQuery = useQuery({
    queryKey: ["historical-amplitude-metrics"],
    queryFn: ({ signal }) => getAnalyticsMetrics(token, signal),
  });
  const metrics = metricsQuery.data?.metrics ?? [];
  const firstMetricId = metrics[0]?.id ?? "";

  useEffect(() => {
    if (!metricId && firstMetricId) {
      setMetricId(firstMetricId);
    }
  }, [firstMetricId, metricId]);

  const distributionQuery = useQuery({
    queryKey: ["historical-amplitude-distribution", metricId, code, version],
    queryFn: ({ signal }) =>
      getDistributionStats(
        token,
        {
          metricId,
          code,
          version,
        },
        signal,
      ),
    enabled: Boolean(metricId),
  });
  const isMetricsLoading = metricsQuery.isLoading || metricsQuery.isFetching;

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
  const histogramRows = histogram
    ? toHistogramRows(histogram.bins, histogram.counts)
    : [];
  const upDays = histogramRows
    .filter((row) => row.start >= 0)
    .reduce((sum, row) => sum + row.count, 0);
  const downDays = histogramRows
    .filter((row) => row.end <= 0)
    .reduce((sum, row) => sum + row.count, 0);
  const filterFields: FilterField[] = [
    {
      id: "amplitude-code",
      label: t("dashboard.amplitude.filter.code"),
      type: "select",
      value: code,
      options: [
        { value: "TXFR1", label: "TXFR1" },
        { value: "TXFD1", label: "TXFD1" },
        { value: "TXF", label: "TXF" },
      ],
      onValueChange: setCode,
      triggerTestId: "amplitude-code-trigger",
    },
    {
      id: "amplitude-metric",
      label: t("dashboard.amplitude.filter.metric"),
      className: "md:col-span-2",
      type: "select",
      value: metricId || "__none__",
      options:
        metrics.length > 0
          ? metrics.map((metric) => ({
              value: metric.id,
              label: mapMetricLabel(metric.id, t, metric.label),
            }))
          : [
              {
                value: "__none__",
                label: t("dashboard.amplitude.filter.noMetrics"),
                disabled: true,
              },
            ],
      loading: isMetricsLoading,
      onValueChange: setMetricId,
      triggerTestId: "amplitude-metric-trigger",
    },
  ];

  return (
    <PageLayout
      title={t("dashboard.amplitude.title")}
      actions={<Badge variant="info">{t("dashboard.amplitude.badge")}</Badge>}
      bodyClassName="space-y-[var(--section-gap)]"
    >
      <FilterLayer fields={filterFields} />

      <BentoGridSection
        tooltip={`此页功能显示各种振幅的统计资料`}
        title={t("dashboard.amplitude.sectionTitle")}
      >
        <PanelCard
          title={t("dashboard.amplitude.hist.title")}
          span={12}
          note={t("dashboard.amplitude.hist.note")}
          meta={t("dashboard.amplitude.meta", {
            count: String(distributionQuery.data?.sample_count ?? 0),
          })}
          units={2}
        >
          <div className="mt-[var(--panel-gap)] space-y-3">
            {apiStatus &&
            apiStatus >= 400 &&
            apiStatus !== 401 &&
            apiStatus !== 403 ? (
              <ApiStatusAlert
                message={t("dashboard.amplitude.error.fetch", {
                  status: String(apiStatus),
                })}
                status={apiStatus}
              />
            ) : null}

            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="success">
                {t("dashboard.amplitude.upDays")}: {upDays}
              </Badge>
              <Badge variant="danger">
                {t("dashboard.amplitude.downDays")}: {downDays}
              </Badge>
              <Badge variant="neutral">
                {t("dashboard.amplitude.net")}: {upDays - downDays}
              </Badge>
            </div>

            {distributionQuery.isLoading ? (
              <div
                className="h-[300px] w-full animate-pulse rounded bg-muted"
                data-testid="amplitude-histogram-loading"
              />
            ) : histogramRows.length === 0 ? (
              <div
                className="rounded-sm border border-border px-3 py-2 text-sm text-muted-foreground"
                data-testid="amplitude-histogram-empty"
              >
                {t("dashboard.amplitude.empty")}
              </div>
            ) : (
              <div
                className="h-[300px] w-full"
                data-testid="amplitude-histogram-chart"
              >
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <BarChart
                    barCategoryGap="0%"
                    data={histogramRows}
                    margin={{ top: 8, right: 12, left: -8, bottom: 0 }}
                  >
                    <XAxis
                      axisLine={false}
                      dataKey="label"
                      interval={1}
                      tick={{
                        fill: "hsl(var(--subtle-foreground))",
                        fontSize: 10,
                      }}
                      tickLine={false}
                    />
                    <YAxis
                      axisLine={false}
                      allowDecimals={false}
                      tick={{
                        fill: "hsl(var(--subtle-foreground))",
                        fontSize: 11,
                      }}
                      tickLine={false}
                      width={44}
                    />
                    <ReferenceLine
                      stroke="#94a3b8"
                      strokeDasharray="2 2"
                      x="0~0"
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "4px",
                        color: "hsl(var(--foreground))",
                      }}
                      formatter={(value) => [
                        t("dashboard.amplitude.tooltip.days", {
                          value: String(Number(value ?? 0)),
                        }),
                        t("dashboard.amplitude.tooltip.count"),
                      ]}
                      labelFormatter={(label) =>
                        t("dashboard.amplitude.tooltip.bucket", {
                          label: String(label),
                        })
                      }
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
