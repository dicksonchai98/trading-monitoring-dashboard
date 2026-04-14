import type {
  SectorHeatmapMockRow,
  SectorHeatmapSector,
} from "@/features/dashboard/lib/sector-heatmap.mock";
import type { TranslationKey } from "@/lib/i18n";

export const SECTOR_HEATMAP_ORDER: SectorHeatmapSector[] = [
  "semiconductor",
  "finance",
  "traditional",
  "other",
];

export const SECTOR_HEATMAP_LABEL: Record<SectorHeatmapSector, string> = {
  semiconductor: "Semiconductor",
  finance: "Finance",
  traditional: "Traditional",
  other: "Other",
};

export const SECTOR_HEATMAP_LABEL_KEY: Record<
  SectorHeatmapSector,
  TranslationKey
> = {
  semiconductor: "dashboard.sectorHeatmap.sector.semiconductor",
  finance: "dashboard.sectorHeatmap.sector.finance",
  traditional: "dashboard.sectorHeatmap.sector.traditional",
  other: "dashboard.sectorHeatmap.sector.other",
};

export const SECTOR_HEATMAP_PALETTE: Record<SectorHeatmapSector, string> = {
  semiconductor: "#7c83fd",
  finance: "#5cab7d",
  traditional: "#f0ad4e",
  other: "#6b7a90",
};

export interface SectorHeatmapTileNode {
  name: string;
  size: number;
  symbol: string;
  weightPct: number;
  contributionPoints: number;
  sector: SectorHeatmapSector;
  [key: string]: unknown;
}

export interface SectorHeatmapSectorViewModel {
  sector: SectorHeatmapSector;
  label: string;
  color: string;
  totalWeightPct: number;
  totalContributionPoints: number;
  tiles: SectorHeatmapTileNode[];
}

export function formatWeightPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function formatContributionPoints(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)} pts`;
}

export function buildSectorHeatmapViewModel(
  rows: SectorHeatmapMockRow[],
): SectorHeatmapSectorViewModel[] {
  return SECTOR_HEATMAP_ORDER.map((sector) => {
    const sectorRows = rows.filter((row) => row.sector === sector);
    const totalWeightPct = sectorRows.reduce(
      (sum, row) => sum + row.weightPct,
      0,
    );
    const totalContributionPoints = sectorRows.reduce(
      (sum, row) => sum + row.contributionPoints,
      0,
    );

    return {
      sector,
      label: SECTOR_HEATMAP_LABEL[sector],
      color: SECTOR_HEATMAP_PALETTE[sector],
      totalWeightPct,
      totalContributionPoints,
      tiles: sectorRows.map((row) => ({
        name: row.symbol,
        size: row.weightPct,
        symbol: row.symbol,
        weightPct: row.weightPct,
        contributionPoints: row.contributionPoints,
        sector: row.sector,
      })),
    };
  });
}
