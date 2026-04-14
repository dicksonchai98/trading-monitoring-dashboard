import type { JSX } from "react";
import { Treemap, type TreemapNode } from "recharts";
import {
  formatContributionPoints,
  formatWeightPct,
  type SectorHeatmapSectorViewModel,
} from "@/features/dashboard/lib/sector-heatmap";

interface SectorHeatmapTreemapProps {
  sector: SectorHeatmapSectorViewModel;
}

function CustomizedSectorHeatmapNode(props: TreemapNode): JSX.Element {
  const { x, y, width, height, name, color, contributionPoints, weightPct } =
    props as TreemapNode & {
      color?: string;
      contributionPoints?: number;
      weightPct?: number;
    };

  const resolvedX = x ?? 0;
  const resolvedY = y ?? 0;
  const resolvedWidth = width ?? 0;
  const resolvedHeight = height ?? 0;
  const showFullLabel = resolvedWidth >= 96 && resolvedHeight >= 72;
  const showSymbolOnly = resolvedWidth >= 48 && resolvedHeight >= 28;

  return (
    <g>
      <rect
        x={resolvedX}
        y={resolvedY}
        width={resolvedWidth}
        height={resolvedHeight}
        rx={6}
        ry={6}
        fill={color ?? "#6b7a90"}
        fillOpacity={0.9}
        stroke="rgba(255,255,255,0.9)"
        strokeWidth={2}
      />
      {showFullLabel ? (
        <>
          <text
            x={resolvedX + 10}
            y={resolvedY + 20}
            fill="#ffffff"
            fontSize={14}
            fontWeight={700}
          >
            {name}
          </text>
          <text x={resolvedX + 10} y={resolvedY + 40} fill="#ffffff" fontSize={12}>
            {formatWeightPct(weightPct ?? 0)}
          </text>
          <text x={resolvedX + 10} y={resolvedY + 58} fill="#ffffff" fontSize={12}>
            {formatContributionPoints(contributionPoints ?? 0)}
          </text>
        </>
      ) : null}
      {!showFullLabel && showSymbolOnly ? (
        <text
          x={resolvedX + 8}
          y={resolvedY + 20}
          fill="#ffffff"
          fontSize={13}
          fontWeight={700}
        >
          {name}
        </text>
      ) : null}
    </g>
  );
}

export function SectorHeatmapTreemap({
  sector,
}: SectorHeatmapTreemapProps): JSX.Element {
  return (
    <Treemap
      style={{ width: "100%", maxHeight: 260, aspectRatio: 16 / 10 }}
      data={sector.tiles}
      dataKey="size"
      stroke="rgba(255,255,255,0.8)"
      fill={sector.color}
      isAnimationActive={false}
      content={CustomizedSectorHeatmapNode}
    />
  );
}
