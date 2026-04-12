import type { JSX } from "react";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { BentoGridSection } from "@/components/ui/bento-grid";
import { PageLayout } from "@/components/ui/page-layout";
import { PanelCard } from "@/components/ui/panel-card";
import { StrengthGaugePanelCard } from "@/features/dashboard/components/StrengthGaugePanelCard";
import {
  buildMarketThermometerSectorSymbolMap,
  MARKET_THERMOMETER_SECTOR_LABEL,
  type MarketThermometerSector,
} from "@/features/dashboard/lib/market-thermometer-sectors";
import { useSpotLatestList } from "@/features/realtime/hooks/use-spot-latest-list";

interface SpotPanelData {
  symbol: string;
  price: number;
  priceChg: number | null;
  pctChg: number | null;
  strengthPct: number | null;
  isNewHigh: boolean;
  isNewLow: boolean;
}

type HeatStrengthState =
  | "new_high"
  | "strong_up"
  | "flat"
  | "strong_down"
  | "new_low";

const HEAT_STATE_SCORE: Record<HeatStrengthState, number> = {
  new_high: 2,
  strong_up: 1,
  flat: 0,
  strong_down: -1,
  new_low: -2,
};

const MARKET_THERMOMETER_SECTOR_SYMBOL_MAP =
  buildMarketThermometerSectorSymbolMap();

function formatLastPrice(value: number): string {
  return value.toFixed(2);
}

function formatSigned(value: number | null, suffix = ""): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "--";
  }
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}${suffix}`;
}

function computePositionStrengthPct(
  sessionLow: number | null,
  sessionHigh: number | null,
  price: number,
): number | null {
  if (
    typeof sessionLow !== "number" ||
    !Number.isFinite(sessionLow) ||
    typeof sessionHigh !== "number" ||
    !Number.isFinite(sessionHigh)
  ) {
    return null;
  }

  const range = sessionHigh - sessionLow;
  if (!Number.isFinite(range) || range <= 0) {
    return null;
  }

  const raw = ((price - sessionLow) / range) * 100;
  return Math.max(0, Math.min(100, raw));
}

function normalizeStrengthPct(value: number | null): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return Math.max(0, Math.min(100, value));
}

function resolveHeatStrengthState(
  strengthPct: number | null,
  isNewHigh: boolean,
  isNewLow: boolean,
): HeatStrengthState {
  if (isNewHigh) {
    return "new_high";
  }
  if (isNewLow) {
    return "new_low";
  }
  if (typeof strengthPct !== "number" || !Number.isFinite(strengthPct)) {
    return "flat";
  }
  if (strengthPct >= 80) {
    return "strong_up";
  }
  if (strengthPct <= 20) {
    return "strong_down";
  }
  return "flat";
}

function resolvePanelToneByStrengthState(state: HeatStrengthState): {
  cardClassName: string;
  accentClassName: string;
  cardStyle: { backgroundColor: string };
} {
  const score = resolveHeatStrengthScore(state);
  if (score === 2) {
    return {
      cardClassName: "",
      accentClassName: "",
      cardStyle: { backgroundColor: "crimson" },
    };
  }
  if (score === -2) {
    return {
      cardClassName: "",
      accentClassName: "",
      cardStyle: { backgroundColor: "green" },
    };
  }
  if (score === 1) {
    return {
      cardClassName: "",
      accentClassName: "",
      cardStyle: { backgroundColor: "red" },
    };
  }
  if (score === -1) {
    return {
      cardClassName: "",
      accentClassName: "",
      cardStyle: { backgroundColor: "forestgreen" },
    };
  }
  return {
    cardClassName: "",
    accentClassName: "text-muted-foreground",
    cardStyle: { backgroundColor: "var(--card)" },
  };
}

function resolveHeatStrengthScore(state: HeatStrengthState): number {
  return HEAT_STATE_SCORE[state];
}

function resolvePanelToneByStrength(
  strengthPct: number | null,
  isNewHigh: boolean,
  isNewLow: boolean,
): {
  cardClassName: string;
  accentClassName: string;
  cardStyle: { backgroundColor: string };
} {
  const state = resolveHeatStrengthState(strengthPct, isNewHigh, isNewLow);
  return resolvePanelToneByStrengthState(state);
}

export function MarketThermometerPage(): JSX.Element {
  const spotLatestList = useSpotLatestList();

  const marketStrengthPct =
    typeof spotLatestList?.market_strength_pct === "number" &&
    Number.isFinite(spotLatestList.market_strength_pct)
      ? spotLatestList.market_strength_pct
      : null;

  const marketStrengthCount =
    typeof spotLatestList?.market_strength_count === "number" &&
    Number.isFinite(spotLatestList.market_strength_count)
      ? spotLatestList.market_strength_count
      : 0;

  const backendSectorStrength = spotLatestList?.sector_strength;

  const panels = useMemo<SpotPanelData[]>(() => {
    return (spotLatestList?.items ?? [])
      .map((item) => {
        const lastPrice =
          typeof item.last_price === "number" &&
          Number.isFinite(item.last_price)
            ? item.last_price
            : null;
        const close =
          typeof item.close === "number" && Number.isFinite(item.close)
            ? item.close
            : null;
        const price = lastPrice ?? close;
        if (price === null) {
          return null;
        }

        const sessionLow =
          typeof item.session_low === "number" &&
          Number.isFinite(item.session_low)
            ? item.session_low
            : null;
        const sessionHigh =
          typeof item.session_high === "number" &&
          Number.isFinite(item.session_high)
            ? item.session_high
            : null;
        const priceChg =
          typeof item.price_chg === "number" && Number.isFinite(item.price_chg)
            ? item.price_chg
            : null;
        const pctChg =
          typeof item.pct_chg === "number" && Number.isFinite(item.pct_chg)
            ? item.pct_chg
            : null;

        const backendStrengthPct = normalizeStrengthPct(
          typeof item.strength_pct === "number" ? item.strength_pct : null,
        );

        return {
          symbol: item.symbol,
          price,
          priceChg,
          pctChg,
          strengthPct:
            backendStrengthPct ??
            computePositionStrengthPct(sessionLow, sessionHigh, price),
          isNewHigh: item.is_new_high === true,
          isNewLow: item.is_new_low === true,
        };
      })
      .filter((item): item is SpotPanelData => item !== null);
  }, [spotLatestList]);

  const sectorStrengthByType = useMemo<
    Record<MarketThermometerSector, number | null>
  >(() => {
    const getSectorStrength = (
      sector: MarketThermometerSector,
    ): number | null => {
      const backendValue = normalizeStrengthPct(
        typeof backendSectorStrength?.[sector] === "number"
          ? backendSectorStrength[sector]
          : null,
      );
      if (backendValue !== null) {
        return backendValue / 100;
      }

      const symbols = MARKET_THERMOMETER_SECTOR_SYMBOL_MAP[sector];
      const values = panels
        .filter((panel) => symbols.has(panel.symbol))
        .map((panel) => panel.strengthPct)
        .filter((value): value is number => value !== null);

      if (values.length === 0) {
        return null;
      }

      const avgPct =
        values.reduce((acc, value) => acc + value, 0) / values.length;
      return Math.max(0, Math.min(100, avgPct)) / 100;
    };

    return {
      weighted: getSectorStrength("weighted"),
      financial: getSectorStrength("financial"),
      tech: getSectorStrength("tech"),
    };
  }, [backendSectorStrength, panels]);

  return (
    <PageLayout
      title="Market Thermometer"
      actions={<Badge variant="success">SSE Connected</Badge>}
      bodyClassName="space-y-[var(--section-gap)]"
    >
      <BentoGridSection
        title={t("dashboard.thermometer.sectionTitle")}
        gridClassName="h-full auto-rows-fr lg:grid-cols-12"
      >
        <div className="space-y-2 lg:col-span-10">
          <div
            className="grid grid-cols-10 gap-2"
            data-testid="market-heat-grid"
          >
            {panels.length === 0 ? (
              <div
                className="col-span-10 rounded-md border border-border bg-card p-4 text-sm text-muted-foreground"
                data-testid="market-heat-empty"
              >
                Waiting for spot latest data...
              </div>
            ) : (
              panels.map((panel) => {
                const tone = resolvePanelToneByStrength(
                  panel.strengthPct,
                  panel.isNewHigh,
                  panel.isNewLow,
                );
                return (
                  <div
                    key={panel.symbol}
                    className={`col-span-1 rounded-md border border-border p-2 ${tone.cardClassName}`}
                    style={tone.cardStyle}
                    data-testid="market-heat-stock-panel"
                  >
                    <div className="flex flex-col items-start">
                      <p className="text-xs font-medium text-foreground">
                        {panel.symbol}
                      </p>
                    </div>
                    <p className="mt-1 text-lg font-semibold tracking-tight text-foreground">
                      {formatLastPrice(panel.price)}
                    </p>
                    <div
                      className={`mt-1 flex flex-col gap-0.5 text-[11px] ${tone.accentClassName}`}
                    >
                      <span>{formatSigned(panel.priceChg)}</span>
                      <span>{formatSigned(panel.pctChg, "%")}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="space-y-2 lg:col-span-2">
          <StrengthGaugePanelCard
            title={MARKET_THERMOMETER_SECTOR_LABEL.weighted}
            note="Backend sector strength for weighted stocks."
            strength={sectorStrengthByType.weighted}
            span={12}
            units={1}
            panelTestId="market-thermometer-weighted-strength-panel"
            gaugeTestId="market-thermometer-weighted-strength-gauge"
            strengthTestId="market-thermometer-weighted-strength-value"
            gaugeWidth={220}
            gaugeHeight={124}
            gaugeContainerClassName="mx-auto w-full max-w-[220px]"
          />
          <StrengthGaugePanelCard
            title={MARKET_THERMOMETER_SECTOR_LABEL.financial}
            note="Backend sector strength for financial stocks."
            strength={sectorStrengthByType.financial}
            span={12}
            units={1}
            panelTestId="market-thermometer-financial-strength-panel"
            gaugeTestId="market-thermometer-financial-strength-gauge"
            strengthTestId="market-thermometer-financial-strength-value"
            gaugeWidth={220}
            gaugeHeight={124}
            gaugeContainerClassName="mx-auto w-full max-w-[220px]"
          />
          <StrengthGaugePanelCard
            title={MARKET_THERMOMETER_SECTOR_LABEL.tech}
            note="Backend sector strength for tech stocks."
            strength={sectorStrengthByType.tech}
            span={12}
            units={1}
            panelTestId="market-thermometer-tech-strength-panel"
            gaugeTestId="market-thermometer-tech-strength-gauge"
            strengthTestId="market-thermometer-tech-strength-value"
            gaugeWidth={220}
            gaugeHeight={124}
            gaugeContainerClassName="mx-auto w-full max-w-[220px]"
          />
          <PanelCard
            title="Market Meter"
            note="Aggregate spot strength percentage."
            span={12}
            units={2}
          >
            <div className="mt-[var(--panel-gap)] flex h-full min-h-[130px] flex-col items-center justify-center text-center">
              <p className="text-xs text-muted-foreground">
                Meter = market strength %
              </p>
              <p
                className="mt-2 text-4xl font-semibold tracking-tight text-foreground"
                data-testid="market-thermometer-strength-score"
              >
                {marketStrengthPct === null
                  ? "--"
                  : `${formatSigned(marketStrengthPct)}%`}
              </p>
              <p
                className="mt-1 text-xs text-muted-foreground"
                data-testid="market-thermometer-strength-count"
              >
                {marketStrengthCount > 0
                  ? `${marketStrengthCount} symbols`
                  : "No symbols"}
              </p>
            </div>
          </PanelCard>
        </div>
      </BentoGridSection>
    </PageLayout>
  );
}
