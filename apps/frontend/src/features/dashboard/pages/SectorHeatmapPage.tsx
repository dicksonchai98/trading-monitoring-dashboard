import type { JSX } from "react";
import { useMemo } from "react";
import { PageLayout } from "@/components/ui/page-layout";
import { SectorHeatmapCard } from "@/features/dashboard/components/SectorHeatmapCard";
import {
  buildSectorHeatmapViewModel,
  SECTOR_HEATMAP_LABEL_KEY,
  type SectorHeatmapSectorViewModel,
} from "@/features/dashboard/lib/sector-heatmap";
import { sectorHeatmapMockRows } from "@/features/dashboard/lib/sector-heatmap.mock";
import { useT } from "@/lib/i18n";

interface SectorHeatmapPageProps {
  initialData?: SectorHeatmapSectorViewModel[];
}

export function SectorHeatmapPage({
  initialData,
}: SectorHeatmapPageProps): JSX.Element {
  const t = useT();
  const sectors = useMemo(
    () => initialData ?? buildSectorHeatmapViewModel(sectorHeatmapMockRows),
    [initialData],
  );
  const localizedSectors = useMemo(
    () =>
      sectors.map((sector) => ({
        ...sector,
        label: t(SECTOR_HEATMAP_LABEL_KEY[sector.sector]),
      })),
    [sectors, t],
  );

  return (
    <PageLayout
      title={t("dashboard.sectorHeatmap.title")}
      bodyClassName="space-y-4"
    >
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {t("dashboard.sectorHeatmap.sectionTitle")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("dashboard.sectorHeatmap.description")}
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {localizedSectors.map((sector) => (
          <SectorHeatmapCard key={sector.sector} sector={sector} mockMode />
        ))}
      </div>
    </PageLayout>
  );
}
