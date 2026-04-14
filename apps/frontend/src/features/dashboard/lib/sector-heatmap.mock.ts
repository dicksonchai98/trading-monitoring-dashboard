export type SectorHeatmapSector =
  | "semiconductor"
  | "finance"
  | "traditional"
  | "other";

export interface SectorHeatmapMockRow {
  symbol: string;
  sector: SectorHeatmapSector;
  weightPct: number;
  contributionPoints: number;
}

export const sectorHeatmapMockRows: SectorHeatmapMockRow[] = [
  {
    symbol: "2330",
    sector: "semiconductor",
    weightPct: 34.5,
    contributionPoints: 6.12,
  },
  {
    symbol: "2454",
    sector: "semiconductor",
    weightPct: 8.4,
    contributionPoints: 1.35,
  },
  {
    symbol: "2303",
    sector: "semiconductor",
    weightPct: 2.3,
    contributionPoints: 0.41,
  },
  {
    symbol: "2881",
    sector: "finance",
    weightPct: 2.6,
    contributionPoints: -0.18,
  },
  {
    symbol: "2882",
    sector: "finance",
    weightPct: 2.2,
    contributionPoints: 0.27,
  },
  {
    symbol: "2891",
    sector: "finance",
    weightPct: 1.4,
    contributionPoints: 0.09,
  },
  {
    symbol: "2603",
    sector: "traditional",
    weightPct: 1.8,
    contributionPoints: 0.33,
  },
  {
    symbol: "1301",
    sector: "traditional",
    weightPct: 1.2,
    contributionPoints: -0.07,
  },
  {
    symbol: "2002",
    sector: "traditional",
    weightPct: 1.1,
    contributionPoints: 0.05,
  },
  {
    symbol: "3231",
    sector: "other",
    weightPct: 0.9,
    contributionPoints: 0.14,
  },
  {
    symbol: "3702",
    sector: "other",
    weightPct: 0.8,
    contributionPoints: -0.03,
  },
  {
    symbol: "5871",
    sector: "other",
    weightPct: 0.7,
    contributionPoints: 0.02,
  },
];
