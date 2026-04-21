import type { JSX } from "react";
import { useMemo } from "react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PanelCard } from "@/components/ui/panel-card";
import { CardDataState } from "@/features/dashboard/components/CardDataState";
import {
  ChartShell,
  axisTick,
  timeSeriesAxisTick,
  tooltipStyle,
} from "@/features/dashboard/components/PanelCharts";
import { useSpotMarketDistributionBaseline } from "@/features/dashboard/hooks/use-spot-market-distribution";
import { useRealtimeStore } from "@/features/realtime/store/realtime.store";
import { useT } from "@/lib/i18n";

interface MarketDistributionChartDatum {
  bucketLabel: string;
  count: number;
  lowerPct: number;
  upperPct: number;
}

function bucketFill(lowerPct: number, upperPct: number): string {
  if (upperPct <= 0) {
    return "#22c55e";
  }
  if (lowerPct >= 0) {
    return "#ef4444";
  }
  return "#f59e0b";
}

export function SpotMarketDistributionCard(): JSX.Element {
  const t = useT();
  const { loading, error } = useSpotMarketDistributionBaseline();
  const spotMarketDistributionLatest = useRealtimeStore(
    (state) => state.spotMarketDistributionLatest,
  );

  const chartData = useMemo<MarketDistributionChartDatum[]>(() => {
    const buckets = spotMarketDistributionLatest?.distribution_buckets ?? [];
    return buckets
      .slice()
      .sort((left, right) => left.lower_pct - right.lower_pct)
      .map((bucket) => ({
        bucketLabel: bucket.label,
        count: bucket.count,
        lowerPct: bucket.lower_pct,
        upperPct: bucket.upper_pct,
      }));
  }, [spotMarketDistributionLatest?.distribution_buckets]);

  const hasData = chartData.length > 0;
  const state = hasData
    ? "ready"
    : loading
      ? "loading"
      : error
        ? "error"
        : "empty";

  return (
    <PanelCard
      title={t("dashboard.realtime.breadth.title")}
      meta={t("dashboard.realtime.breadth.meta")}
      note={t("dashboard.realtime.breadth.note")}
      span={4}
      units={2}
      data-testid="spot-market-distribution-card"
    >
      {state === "loading" ? (
        <CardDataState text={t("dashboard.realtime.breadth.loading")} />
      ) : null}
      {state === "error" ? (
        <CardDataState text={t("dashboard.realtime.breadth.error")} />
      ) : null}
      {state === "empty" ? (
        <CardDataState text={t("dashboard.realtime.breadth.empty")} />
      ) : null}
      {state === "ready" ? (
        <div className="mt-[var(--panel-gap)] flex flex-col gap-4">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>{t("dashboard.realtime.breadth.summary", { total: spotMarketDistributionLatest?.total_count ?? 0 })}</span>
            <span>{t("dashboard.realtime.breadth.up", { count: spotMarketDistributionLatest?.up_count ?? 0 })}</span>
            <span>{t("dashboard.realtime.breadth.down", { count: spotMarketDistributionLatest?.down_count ?? 0 })}</span>
            <span>{t("dashboard.realtime.breadth.flat", { count: spotMarketDistributionLatest?.flat_count ?? 0 })}</span>
          </div>
          <ChartShell testId="spot-market-distribution-chart">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <ComposedChart
                data={chartData}
                margin={{ top: 8, right: 10, bottom: 0, left: -8 }}
              >
                <CartesianGrid
                  vertical={false}
                  stroke="hsl(var(--border-strong))"
                  strokeDasharray="3 3"
                />
                <XAxis
                  axisLine={false}
                  dataKey="bucketLabel"
                  height={52}
                  interval={0}
                  tick={timeSeriesAxisTick}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="count"
                  axisLine={false}
                  tick={{ ...axisTick, fontSize: 10 }}
                  tickLine={false}
                  width={36}
                  tickFormatter={(value) => {
                    try {
                      return Intl.NumberFormat(undefined, { notation: "compact" }).format(
                        Number(value ?? 0),
                      );
                    } catch {
                      return String(value ?? "");
                    }
                  }}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                  formatter={(value) => {
                    const normalized =
                      typeof value === "number" ? value : Number(value ?? 0);
                    return [normalized, t("dashboard.realtime.breadth.count")];
                  }}
                />
                <Bar
                  yAxisId="count"
                  dataKey="count"
                  barSize={16}
                  radius={[2, 2, 0, 0]}
                  isAnimationActive={false}
                >
                  {chartData.map((entry) => (
                    <Cell
                      key={entry.bucketLabel}
                      fill={bucketFill(entry.lowerPct, entry.upperPct)}
                    />
                  ))}
                  <LabelList
                    dataKey="count"
                    position="top"
                    offset={6}
                    fill="hsl(var(--foreground))"
                    fontSize={10}
                  />
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          </ChartShell>
        </div>
      ) : null}
    </PanelCard>
  );
}
