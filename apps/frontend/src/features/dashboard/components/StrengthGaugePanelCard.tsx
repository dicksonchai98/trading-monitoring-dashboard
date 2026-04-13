import type { JSX } from "react";
import { Cell, Pie, PieChart } from "recharts";
import { PanelCard } from "@/components/ui/panel-card";

interface GaugeSegment {
  name: string;
  value: number;
  fill: string;
}

interface StrengthGaugePanelCardProps {
  title: string;
  strength: number | null;
  meta?: string;
  note?: string;
  span?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
  units?: number;
  className?: string;
  contentClassName?: string;
  panelTestId?: string;
  gaugeTestId?: string;
  strengthTestId?: string;
  gaugeWidth?: number;
  gaugeHeight?: number;
  gaugeInnerRadius?: number;
  gaugeOuterRadius?: number;
  gaugeContainerClassName?: string;
}

function formatPercentage(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function HalfGauge({
  percent,
  testId,
  width,
  height,
  innerRadius,
  outerRadius,
  containerClassName,
}: {
  percent: number | null;
  testId: string;
  width: number;
  height: number;
  innerRadius: number;
  outerRadius: number;
  containerClassName: string;
}): JSX.Element {
  const value = percent === null ? 0 : Math.max(0, Math.min(100, percent));
  const data: GaugeSegment[] = [
    { name: "active", value, fill: "#22c55e" },
    { name: "rest", value: 100 - value, fill: "rgba(148, 163, 184, 0.25)" },
  ];

  return (
    <div
      className="flex min-h-0 flex-1 flex-col justify-center overflow-hidden"
      data-testid={testId}
    >
      <div className={containerClassName}>
        <div className="flex justify-center">
          <PieChart width={width} height={height}>
            <Pie
              data={data}
              dataKey="value"
              startAngle={180}
              endAngle={0}
              cx={width / 2}
              cy={width / 2}
              innerRadius={innerRadius}
              outerRadius={outerRadius}
              stroke="none"
              isAnimationActive={false}
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.fill} />
              ))}
            </Pie>
          </PieChart>
        </div>
      </div>
    </div>
  );
}

export function StrengthGaugePanelCard({
  title,
  strength,
  meta,
  note,
  span = 1,
  units = 1,
  className = "",
  contentClassName = "pt-[var(--panel-gap)]",
  panelTestId = "strength-gauge-panel",
  gaugeTestId = "strength-gauge",
  strengthTestId,
  gaugeWidth = 240,
  gaugeHeight = 132,
  gaugeInnerRadius = 66,
  gaugeOuterRadius = 96,
  gaugeContainerClassName = "mx-auto w-full max-w-[240px]",
}: StrengthGaugePanelCardProps): JSX.Element {
  const percent = strength === null ? null : strength * 100;

  return (
    <PanelCard
      title={title}
      meta={meta}
      note={note}
      span={span}
      units={units}
      className={className}
      contentClassName={contentClassName}
      data-testid={panelTestId}
    >
      <HalfGauge
        percent={percent}
        testId={gaugeTestId}
        width={gaugeWidth}
        height={gaugeHeight}
        innerRadius={gaugeInnerRadius}
        outerRadius={gaugeOuterRadius}
        containerClassName={gaugeContainerClassName}
      />
      {strengthTestId ? (
        <p
          className="mt-0 text-center text-xs font-semibold leading-none text-muted-foreground"
          data-testid={strengthTestId}
        >
          {strength === null ? "--" : formatPercentage(strength)}
        </p>
      ) : null}
    </PanelCard>
  );
}
