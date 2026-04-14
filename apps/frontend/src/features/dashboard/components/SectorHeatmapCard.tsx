import type { JSX } from "react";
import { Badge } from "@/components/ui/badge";
import { PanelCard } from "@/components/ui/panel-card";
import {
  formatContributionPoints,
  formatWeightPct,
  type SectorHeatmapSectorViewModel,
} from "@/features/dashboard/lib/sector-heatmap";
import { SectorHeatmapTreemap } from "@/features/dashboard/components/SectorHeatmapTreemap";
import { useT } from "@/lib/i18n";

interface SectorHeatmapCardProps {
  sector: SectorHeatmapSectorViewModel;
  mockMode?: boolean;
}

export function SectorHeatmapCard({
  sector,
  mockMode = false,
}: SectorHeatmapCardProps): JSX.Element {
  const t = useT();

  return (
    <PanelCard
      title={sector.label}
      data-testid={`sector-heatmap-card-${sector.sector}`}
      span={6}
      units={2}
      contentClassName="gap-4"
    >
      <div className="flex items-start justify-between gap-3 px-6">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">
            {t("dashboard.sectorHeatmap.totalWeight")}
          </p>
          <p
            className="text-lg font-semibold text-foreground"
            data-testid={`sector-heatmap-total-weight-${sector.sector}`}
          >
            {formatWeightPct(sector.totalWeightPct)}
          </p>
        </div>
        <div className="space-y-1 text-right">
          <p className="text-xs text-muted-foreground">
            {t("dashboard.sectorHeatmap.totalPoints")}
          </p>
          <p
            className="text-lg font-semibold text-foreground"
            data-testid={`sector-heatmap-total-points-${sector.sector}`}
          >
            {formatContributionPoints(sector.totalContributionPoints)}
          </p>
        </div>
        {mockMode ? (
          <Badge variant="neutral">{t("dashboard.sectorHeatmap.mock")}</Badge>
        ) : null}
      </div>

      {sector.tiles.length === 0 ? (
        <div
          className="mx-6 rounded-md border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground"
          data-testid={`sector-heatmap-empty-${sector.sector}`}
        >
          {t("dashboard.sectorHeatmap.empty")}
        </div>
      ) : (
        <div className="px-4 pb-4">
          <SectorHeatmapTreemap sector={sector} />
        </div>
      )}
    </PanelCard>
  );
}
