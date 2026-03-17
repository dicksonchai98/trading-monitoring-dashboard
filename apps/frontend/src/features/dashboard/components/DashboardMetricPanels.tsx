import type { CSSProperties, JSX } from "react";
import type { PieProps, PieSectorDataItem } from "recharts";
import { Cell, Pie, PieChart, Tooltip } from "recharts";
import metricsConfig from "../../../../test.json";
import { BentoGridSection } from "@/components/ui/bento-grid";
import { PanelCard } from "@/components/ui/panel-card";

interface MetricPanelConfig {
  key: string;
  label: string;
}

interface GaugeSegment {
  name: string;
  value: number;
  fill: string;
}

interface HalfGaugeGeometry {
  width: number;
  height: number;
  cx: number;
  cy: number;
  innerRadius: number;
  outerRadius: number;
}

const NEEDLE_BASE_RADIUS_PX = 4;
const gaugeValues = [74, 66, 58, 82, 63];
const numericValues = ["1.82%", "24.6K", "12"];

export function getHalfGaugeGeometry(): HalfGaugeGeometry {
  return {
    width: 144,
    height: 60,
    cx: 67,
    cy: 40,
    innerRadius: 24,
    outerRadius: 40,
  };
}

export function getNeedleStyle(
  midAngle: number,
  cx: number,
  cy: number,
): CSSProperties {
  return {
    transform: `rotate(-${midAngle}deg)`,
    transformOrigin: `${cx}px ${cy}px`,
  };
}

function getMetricConfigs(): MetricPanelConfig[] {
  return metricsConfig as MetricPanelConfig[];
}

function Needle({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
}: PieSectorDataItem): JSX.Element | null {
  if (
    typeof cx !== "number" ||
    typeof cy !== "number" ||
    typeof midAngle !== "number" ||
    typeof innerRadius !== "number" ||
    typeof outerRadius !== "number"
  ) {
    return null;
  }

  const needleLength = innerRadius + (outerRadius - innerRadius) / 2;

  return (
    <g>
      <circle
        cx={cx}
        cy={cy}
        r={NEEDLE_BASE_RADIUS_PX}
        fill="hsl(var(--foreground))"
        stroke="none"
      />
      <path
        d={`M${cx},${cy}l${needleLength},0`}
        strokeWidth={2}
        stroke="hsl(var(--foreground))"
        fill="hsl(var(--foreground))"
        style={getNeedleStyle(midAngle, cx, cy)}
      />
    </g>
  );
}

function HalfPie({
  data,
  isAnimationActive = false,
  ...props
}: PieProps & { data: GaugeSegment[] }): JSX.Element {
  const geometry = getHalfGaugeGeometry();

  return (
    <Pie
      {...props}
      stroke="none"
      dataKey="value"
      startAngle={180}
      endAngle={0}
      data={data}
      cx={geometry.cx}
      cy={geometry.cy}
      innerRadius={geometry.innerRadius}
      outerRadius={geometry.outerRadius}
      isAnimationActive={isAnimationActive}
    >
      {data.map((entry) => (
        <Cell key={entry.name} fill={entry.fill} />
      ))}
    </Pie>
  );
}

function MetricNeedleChart({ index }: { index: number }): JSX.Element {
  const value = gaugeValues[index] ?? 50;
  const geometry = getHalfGaugeGeometry();
  const chartData: GaugeSegment[] = [
    { name: "active", value, fill: "hsl(var(--primary))" },
    { name: "rest", value: 100 - value, fill: "hsl(var(--muted))" },
  ];
  const needleLayerData: GaugeSegment[] = chartData.map((entry) => ({
    ...entry,
    fill: "transparent",
  }));

  return (
    <div
      className="flex min-h-0 flex-1 flex-col justify-center"
      data-testid="metric-needle-chart"
    >
      <div
        data-testid="panel-chart"
        className="flex min-h-0 flex-1 flex-col items-center justify-center py-2"
      >
        <div
          className="pointer-events-none absolute h-0 w-0 opacity-0"
          data-testid="metric-needle-track"
        />
        <div
          className="pointer-events-none absolute h-0 w-0 opacity-0"
          data-testid="metric-needle-active"
        />
        <div className="flex w-full justify-center">
          <div
            className="relative h-[60px] w-[144px] shrink-0"
            data-testid="metric-half-gauge"
          >
            <PieChart width={geometry.width} height={geometry.height}>
              <HalfPie data={chartData} />
              <HalfPie
                data={needleLayerData}
                activeIndex={0}
                activeShape={Needle}
              />
              <Tooltip defaultIndex={0} content={() => null} active />
            </PieChart>
          </div>
        </div>
        <div
          className="mt-1.5 text-center text-xs font-semibold leading-none text-foreground"
          data-testid="metric-needle-value"
        >
          {value}
        </div>
      </div>
    </div>
  );
}

function MetricValueCard({ index }: { index: number }): JSX.Element {
  const value = numericValues[index] ?? "--";

  return (
    <div
      className="flex min-h-0 flex-1 flex-col items-center justify-center py-2 text-center"
      data-testid="metric-value-card"
    >
      <div className="text-2xl font-semibold tracking-tight text-foreground">
        {value}
      </div>
    </div>
  );
}

export function DashboardMetricPanels(): JSX.Element {
  let gaugeIndex = 0;
  let valueIndex = 0;

  return (
    <BentoGridSection
      title="LIVE METRICS"
      gridClassName="h-full auto-rows-fr lg:grid-cols-8"
    >
      {getMetricConfigs().map((panel) => {
        const content =
          panel.key === "piechart with needle" ? (
            <MetricNeedleChart index={gaugeIndex++} />
          ) : (
            <MetricValueCard index={valueIndex++} />
          );

        return (
          <PanelCard
            key={panel.label}
            title={panel.label}
            span={1}
            units={1}
            className="h-full"
            contentClassName="pt-[var(--panel-gap)]"
            data-testid="dashboard-metric-panel"
          >
            {content}
          </PanelCard>
        );
      })}
    </BentoGridSection>
  );
}
