export type MarketThermometerSector = "weighted" | "financial" | "tech";

interface MarketThermometerSectorConfig {
  symbol: string;
  sector: MarketThermometerSector;
}

export const MARKET_THERMOMETER_SECTOR_CONFIG: readonly MarketThermometerSectorConfig[] = [
  { symbol: "2330", sector: "weighted" },
  { symbol: "2317", sector: "weighted" },
  { symbol: "2881", sector: "financial" },
  { symbol: "6505", sector: "financial" },
  { symbol: "2454", sector: "tech" },
  { symbol: "2308", sector: "tech" },
] as const;

export const MARKET_THERMOMETER_SECTOR_LABEL: Record<MarketThermometerSector, string> = {
  weighted: "權值股強度",
  financial: "金融股強度",
  tech: "科技股強度",
};

export function buildMarketThermometerSectorSymbolMap(): Record<MarketThermometerSector, Set<string>> {
  const map: Record<MarketThermometerSector, Set<string>> = {
    weighted: new Set<string>(),
    financial: new Set<string>(),
    tech: new Set<string>(),
  };

  for (const item of MARKET_THERMOMETER_SECTOR_CONFIG) {
    map[item.sector].add(item.symbol);
  }

  return map;
}
