import type { JSX } from "react";
import { Badge } from "@/components/ui/badge";
import { BentoGridSection } from "@/components/ui/bento-grid";
import { PanelCard } from "@/components/ui/panel-card";
import { PageLayout } from "@/components/ui/page-layout";
import { Typography } from "@/components/ui/typography";
import { MetricNeedleChart } from "@/features/dashboard/components/DashboardMetricPanels";
import { useT } from "@/lib/i18n";

interface StockPanelData {
  code: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  sparkPoints: string;
  heatState: "newHigh" | "newLow" | "neutral";
}

const stockNameKeys = [
  "dashboard.thermometer.stock.tsmc",
  "dashboard.thermometer.stock.mediatek",
  "dashboard.thermometer.stock.honhai",
  "dashboard.thermometer.stock.delta",
  "dashboard.thermometer.stock.quanta",
  "dashboard.thermometer.stock.aseh",
  "dashboard.thermometer.stock.ctbc",
  "dashboard.thermometer.stock.fubon",
  "dashboard.thermometer.stock.cathay",
  "dashboard.thermometer.stock.evergreen",
] as const;

function buildSparkPoints(seed: number): string {
  const points: string[] = [];

  for (let i = 0; i <= 10; i += 1) {
    const x = i * 12;
    const y = Math.round(
      22 +
        Math.sin((i + 1 + seed) * 0.7) * 9 +
        Math.cos((i + seed) * 0.35) * 5,
    );
    points.push(`${x},${Math.max(5, Math.min(35, y))}`);
  }

  return points.join(" ");
}

function buildStockPanels(
  stockNames: string[],
  count: number,
  fallbackName: (index: number) => string,
): StockPanelData[] {
  const panels: StockPanelData[] = [];

  for (let i = 0; i < count; i += 1) {
    const basePrice = 60 + (i % 10) * 48 + Math.floor(i / 10) * 18;
    const change = Number((Math.sin((i + 2) * 0.9) * 8.4).toFixed(1));
    const price = Number((basePrice + change).toFixed(1));
    const changePercent = Number(((change / basePrice) * 100).toFixed(2));
    const code = `${2000 + i}`;
    const name =
      stockNames[i % stockNames.length] ??
      fallbackName(i + 1);
    const heatState =
      i % 5 === 0 ? "newHigh" : i % 5 === 1 ? "newLow" : "neutral";

    panels.push({
      code,
      name,
      price,
      change,
      changePercent,
      sparkPoints: buildSparkPoints(i),
      heatState,
    });
  }

  return panels;
}

const marketContributionPoints = 173;

export function MarketThermometerPage(): JSX.Element {
  const t = useT();
  const stockNames = stockNameKeys.map((key) => t(key));
  const marketHeatPanels = buildStockPanels(
    stockNames,
    50,
    (index) => t("dashboard.thermometer.stock.fallback", { index }),
  );

  return (
    <PageLayout
      title={t("dashboard.thermometer.title")}
      actions={<Badge variant="success">{t("dashboard.thermometer.connected")}</Badge>}
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
            {marketHeatPanels.map((panel) => {
              const isUp = panel.change >= 0;
              const tone = isUp ? "#ef4444" : "#22c55e";
              const panelBackground =
                panel.heatState === "newHigh"
                  ? "rgba(239, 68, 68, 0.12)"
                  : panel.heatState === "newLow"
                    ? "rgba(34, 197, 94, 0.12)"
                    : undefined;
              const signedChange = isUp ? `+${panel.change}` : `${panel.change}`;
              const signedPercent = isUp
                ? `+${panel.changePercent}%`
                : `${panel.changePercent}%`;

              return (
                <div
                  key={panel.code}
                  className="col-span-1 rounded-md border border-border bg-card p-2"
                  data-testid="market-heat-stock-panel"
                  style={{ backgroundColor: panelBackground }}
                >
                  <div className="flex flex-col items-start">
                    <Typography as="p" variant="caption" className="font-medium text-foreground">
                      {panel.code} {panel.name}
                    </Typography>
                    <Typography as="span" variant="caption" className="font-semibold" style={{ color: tone }}>
                      {signedPercent}
                    </Typography>
                  </div>
                  <Typography as="p" variant="metric" className="mt-1 text-foreground">
                    {panel.price.toFixed(1)}
                  </Typography>
                  <Typography as="p" variant="caption" style={{ color: tone }}>
                    {signedChange}
                  </Typography>
                  <svg
                    className="mt-2 h-10 w-full"
                    viewBox="0 0 120 40"
                    role="img"
                    aria-label={`${panel.code} intraday sparkline`}
                  >
                    <polyline
                      fill="none"
                      stroke={tone}
                      strokeWidth="2"
                      points={panel.sparkPoints}
                    />
                  </svg>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-2 lg:col-span-2">
          <PanelCard
            title={t("dashboard.thermometer.panel.weighted")}
            note={t("dashboard.thermometer.panel.weightedNote")}
            span={12}
            units={1}
          >
            <MetricNeedleChart index={0} />
          </PanelCard>
          <PanelCard
            title={t("dashboard.thermometer.panel.tech")}
            note={t("dashboard.thermometer.panel.techNote")}
            span={12}
            units={1}
          >
            <MetricNeedleChart index={1} />
          </PanelCard>
          <PanelCard
            title={t("dashboard.thermometer.panel.finance")}
            note={t("dashboard.thermometer.panel.financeNote")}
            span={12}
            units={1}
          >
            <MetricNeedleChart index={2} />
          </PanelCard>
          <PanelCard
            title={t("dashboard.thermometer.panel.points")}
            note={t("dashboard.thermometer.panel.pointsNote")}
            span={12}
            units={2}
          >
            <div className="mt-[var(--panel-gap)] flex h-full min-h-[130px] flex-col items-center justify-center text-center">
              <Typography as="p" variant="caption" className="text-muted-foreground">
                {t("dashboard.thermometer.panel.pointsFormula")}
              </Typography>
              <Typography as="p" variant="display" className="mt-2 text-[#ef4444]">
                +{marketContributionPoints}
              </Typography>
            </div>
          </PanelCard>
        </div>
      </BentoGridSection>
    </PageLayout>
  );
}
