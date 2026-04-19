import type { JSX } from "react";
import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TooltipContentProps } from "recharts";
import { MarketOverviewChartCard } from "@/features/dashboard/components/MarketOverviewChartCard";
import {
  ChartShell,
  timeSeriesAxisTick,
} from "@/features/dashboard/components/PanelCharts";
import { useSpotMarketDistributionBaseline } from "@/features/dashboard/hooks/use-spot-market-distribution";
import { useRealtimeStore } from "@/features/realtime/store/realtime.store";
import { useT } from "@/lib/i18n";
import { mapSpotMarketDistributionToTrendData } from "@/features/dashboard/lib/trend-index-mapper";

interface TrendIndexDatum {
  timeLabel: string;
  trendDelta: number;
  trendRatio: number;
  ts: number;
}


function resolveTrendRatioDomain([dataMin, dataMax]: [number, number]): [
  number,
  number,
] {
  const lowerBound = Math.min(dataMin, 0);
  const upperBound = Math.max(dataMax, 0);
  const padding = Math.max(
    5,
    Math.ceil(Math.max(Math.abs(lowerBound), Math.abs(upperBound)) * 0.1),
  );

  return [Math.floor(lowerBound - padding), Math.ceil(upperBound + padding)];
}

export function TrendIndexCard(): JSX.Element {
  const t = useT();
  const { loading, error } = useSpotMarketDistributionBaseline();
  const spotMarketDistributionLatest = useRealtimeStore(
    (state) => state.spotMarketDistributionLatest,
  );
  const spotMarketDistributionSeries = useRealtimeStore(
    (state) => state.spotMarketDistributionSeries,
  );

  const chartData = useMemo<TrendIndexDatum[]>(() => {
    return mapSpotMarketDistributionToTrendData(spotMarketDistributionSeries?.items, spotMarketDistributionLatest);
  }, [
    spotMarketDistributionLatest?.up_count,
    spotMarketDistributionLatest?.down_count,
    spotMarketDistributionLatest?.total_count,
    spotMarketDistributionLatest?.ts,
    spotMarketDistributionSeries?.items,
  ]);

  const renderTrendTooltip = ({
    active,
    label,
    payload,
  }: TooltipContentProps<number, string>): JSX.Element | null => {
    if (!active || !payload?.[0]?.payload) {
      return null;
    }

    const point = payload[0].payload;

    return (
      <div
        className="rounded border border-border bg-card px-3 py-2 text-xs text-foreground shadow-md"
        data-testid="trend-index-tooltip"
      >
        <div className="mb-1 font-medium">
          {String(label ?? point.timeLabel)}
        </div>
        <div className="flex items-center justify-between gap-3">
          <span>{t("dashboard.realtime.trendIndex.tooltip.delta")}</span>
          <span>{point.trendDelta}</span>
        </div>
        <div className="flex items-center justify-between gap-3 text-subtle-foreground">
          <span>{t("dashboard.realtime.trendIndex.tooltip.ratio")}</span>
          <span>{`${point.trendRatio.toFixed(1)}%`}</span>
        </div>
      </div>
    );
  };

  return (
    <MarketOverviewChartCard
      title={t("dashboard.realtime.trendIndex.title")}
      testId="trend-index-card"
      span={4}
      meta={t("dashboard.realtime.trendIndex.meta")}
      loading={loading}
      error={error}
      hasData={chartData.length > 0}
      loadingText={t("dashboard.realtime.trendIndex.loading")}
      errorText={t("dashboard.realtime.trendIndex.error")}
      emptyText={t("dashboard.realtime.trendIndex.empty")}
    >
      <ChartShell testId="trend-index-chart">
        <ResponsiveContainer
          width="100%"
          height="100%"
          minWidth={0}
          minHeight={180}
        >
          <LineChart
            data={chartData}
            margin={{ top: 18, right: 8, bottom: 0, left: -14 }}
          >
            <CartesianGrid
              vertical={false}
              stroke="hsl(var(--border-strong))"
              strokeDasharray="3 3"
            />
            <XAxis
              axisLine={false}
              dataKey="timeLabel"
              // interval={14}
              tick={timeSeriesAxisTick}
              tickLine={false}
              height={52}
              type="category"
            />
            <YAxis
              axisLine={false}
              domain={resolveTrendRatioDomain as any}
              orientation="left"
              tick={{
                fill: "hsl(var(--subtle-foreground))",
                fontSize: 10,
              }}
              tickFormatter={(value) => `${Number(value)}`}
              tickLine={false}
              width={44}
              label={{
                value: t("dashboard.realtime.trendIndex.ratioAxis"),
                angle: -90,
                position: "insideLeft",
                offset: 0,
                fill: "hsl(var(--subtle-foreground))",
                fontSize: 10,
              }}
            />
            <Tooltip content={renderTrendTooltip as any} />
            <Line
              dataKey="trendRatio"
              dot={false}
              stroke="#38bdf8"
              strokeWidth={2}
              type="linear"
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartShell>
    </MarketOverviewChartCard>
  );
}
