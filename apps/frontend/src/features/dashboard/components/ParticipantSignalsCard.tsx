import type { JSX } from "react";
import { useMemo } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PanelCard } from "@/components/ui/panel-card";
import { axisTick } from "@/features/dashboard/components/PanelCharts";
import type {
  ParticipantSignalBasePoint,
  ParticipantSignalWithMaPoint,
} from "@/features/dashboard/lib/participant-signals";
import { withAmplitudeMovingAverages } from "@/features/dashboard/lib/participant-signals";
import { useT } from "@/lib/i18n";

interface CandleShapeProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  payload?: ParticipantSignalWithMaPoint;
}

interface ParticipantSignalsCardProps {
  series: ParticipantSignalBasePoint[];
  loading: boolean;
  error: string | null;
}

function renderCandleShape({
  x,
  y,
  width,
  height,
  payload,
}: CandleShapeProps): JSX.Element | null {
  if (
    typeof x !== "number" ||
    typeof y !== "number" ||
    typeof width !== "number" ||
    typeof height !== "number" ||
    !payload
  ) {
    return null;
  }

  const ampHigh = payload.ampHigh ?? payload.amplitude;
  const ampLow = payload.ampLow ?? payload.amplitude;
  const ampOpen = payload.ampOpen ?? payload.amplitude;
  const ampClose = payload.ampClose ?? payload.amplitude;

  const range = Math.max(ampHigh - ampLow, 1);
  const bodyHigh = Math.max(ampOpen, ampClose);
  const bodyLow = Math.min(ampOpen, ampClose);
  const bodyTop = y + ((ampHigh - bodyHigh) / range) * height;
  const bodyBottom = y + ((ampHigh - bodyLow) / range) * height;
  const bodyHeight = Math.max(2, bodyBottom - bodyTop);
  const centerX = x + width / 2;
  const bodyWidth = Math.max(25, Math.min(30, width * 0.44));
  const bodyX = centerX - bodyWidth / 2;
  const color = "#ef4444";

  return (
    <g>
      <line
        x1={centerX}
        x2={centerX}
        y1={y}
        y2={y + height}
        stroke={color}
        strokeWidth={1.4}
      />
      <rect
        x={bodyX}
        y={bodyTop}
        width={bodyWidth}
        height={bodyHeight}
        fill={color}
        stroke="none"
      />
    </g>
  );
}

function formatAmplitude(value: number): string {
  if (!Number.isFinite(value)) {
    return "0 點";
  }

  return `${value.toFixed(1)} 點`;
}

export function ParticipantSignalsCard({
  series,
  loading,
  error,
}: ParticipantSignalsCardProps): JSX.Element {
  const t = useT();
  const participantChartData = useMemo(
    () => withAmplitudeMovingAverages(series),
    [series],
  );
  const participantAmplitudeMax = useMemo(() => {
    const maxValue = participantChartData.reduce((currentMax, point) => {
      const maMax = Math.max(point.ma3 ?? 0, point.ma5 ?? 0, point.ma10 ?? 0);
      return Math.max(currentMax, point.ampHigh, maMax);
    }, 0);
    return Math.max(10, Math.ceil(maxValue + 5));
  }, [participantChartData]);

  return (
    <PanelCard
      title={t("dashboard.realtime.participantSignals.title")}
      span={10}
      units={2}
      meta={t("dashboard.realtime.participantSignals.meta")}
      data-testid="participant-signals-card"
    >
      <div
        className="mt-[var(--panel-gap)] w-full"
        data-testid="participant-amplitude-chart"
      >
        {loading ? (
          <div className="flex h-[240px] items-center justify-center text-xs text-muted-foreground">
            {t("dashboard.realtime.participantSignals.loading")}
          </div>
        ) : error ? (
          <div className="flex h-[240px] items-center justify-center text-xs text-muted-foreground">
            {t("dashboard.realtime.participantSignals.error")}
          </div>
        ) : (
          <div data-testid="panel-chart" className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <ComposedChart
                data={participantChartData}
                margin={{ top: 8, right: 12, bottom: 0, left: -14 }}
                barCategoryGap="60%"
              >
                <CartesianGrid
                  vertical={false}
                  stroke="hsl(var(--border-strong))"
                  strokeDasharray="3 3"
                />
                <XAxis
                  axisLine={false}
                  dataKey="day"
                  tick={{
                    fill: "hsl(var(--subtle-foreground))",
                    fontSize: 11,
                  }}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="amp"
                  axisLine={false}
                  tick={{
                    fill: "hsl(var(--subtle-foreground))",
                    fontSize: 11,
                  }}
                  tickFormatter={(value) => `${value}`}
                  tickLine={false}
                  width={56}
                  type="number"
                  domain={[0, participantAmplitudeMax]}
                  tickCount={8}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "4px",
                    color: "hsl(var(--foreground))",
                  }}
                  formatter={(value, name) => {
                    const normalized =
                      typeof value === "number" ? value : Number(value ?? 0);
                    if (name === "ma3") {
                      return [
                        formatAmplitude(normalized),
                        t(
                          "dashboard.realtime.participantSignals.legend.threeDay",
                        ),
                      ];
                    }
                    if (name === "ma5") {
                      return [
                        formatAmplitude(normalized),
                        t(
                          "dashboard.realtime.participantSignals.legend.fiveDay",
                        ),
                      ];
                    }
                    if (name === "ma10") {
                      return [
                        formatAmplitude(normalized),
                        t(
                          "dashboard.realtime.participantSignals.legend.tenDay",
                        ),
                      ];
                    }
                    return [
                      formatAmplitude(normalized),
                      t("dashboard.realtime.participantSignals.legend.daily"),
                    ];
                  }}
                />
                <Bar
                  yAxisId="amp"
                  dataKey="ampHigh"
                  shape={renderCandleShape}
                  isAnimationActive={false}
                  barSize={30}
                  maxBarSize={30}
                />
                <Line
                  yAxisId="amp"
                  dataKey="ma3"
                  dot={false}
                  stroke="#38bdf8"
                  strokeWidth={1.5}
                  type="linear"
                  connectNulls
                  isAnimationActive={false}
                />
                <Line
                  yAxisId="amp"
                  dataKey="ma5"
                  dot={false}
                  stroke="#22c55e"
                  strokeWidth={1.5}
                  type="linear"
                  connectNulls
                  isAnimationActive={false}
                />
                <Line
                  yAxisId="amp"
                  dataKey="ma10"
                  dot={false}
                  stroke="#a855f7"
                  strokeWidth={1.5}
                  type="linear"
                  connectNulls
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-[6px] w-[10px] rounded-[1px] bg-[#ef4444]" />
            {t("dashboard.realtime.participantSignals.legend.daily")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-[2px] w-4 bg-[#38bdf8]" />
            {t("dashboard.realtime.participantSignals.legend.threeDay")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-[2px] w-4 bg-[#22c55e]" />
            {t("dashboard.realtime.participantSignals.legend.fiveDay")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-[2px] w-4 bg-[#a855f7]" />
            {t("dashboard.realtime.participantSignals.legend.tenDay")}
          </span>
        </div>
      </div>
    </PanelCard>
  );
}
