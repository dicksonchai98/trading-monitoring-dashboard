import type { JSX } from "react";
import { Badge } from "@/components/ui/badge";
import { BentoGridSection } from "@/components/ui/bento-grid";
import { PanelCard } from "@/components/ui/panel-card";
import { PageLayout } from "@/components/ui/page-layout";
import { MetricNeedleChart } from "@/features/dashboard/components/DashboardMetricPanels";

interface StockPanelData {
  code: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  sparkPoints: string;
  heatState: "newHigh" | "newLow" | "neutral";
}

const stockNames = [
  "台積電",
  "聯發科",
  "鴻海",
  "台達電",
  "廣達",
  "日月光投控",
  "中信金",
  "富邦金",
  "國泰金",
  "長榮",
];

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

function buildStockPanels(count: number): StockPanelData[] {
  const panels: StockPanelData[] = [];

  for (let i = 0; i < count; i += 1) {
    const basePrice = 60 + (i % 10) * 48 + Math.floor(i / 10) * 18;
    const change = Number((Math.sin((i + 2) * 0.9) * 8.4).toFixed(1));
    const price = Number((basePrice + change).toFixed(1));
    const changePercent = Number(((change / basePrice) * 100).toFixed(2));
    const code = `${2000 + i}`;
    const name = stockNames[i % stockNames.length] ?? `個股${i + 1}`;
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

const marketHeatPanels = buildStockPanels(50);

export function MarketThermometerPage(): JSX.Element {
  return (
    <PageLayout
      title="大盤溫度計"
      actions={<Badge variant="success">SSE Connected</Badge>}
      bodyClassName="space-y-[var(--section-gap)]"
    >
      <BentoGridSection
        title="MARKET THERMOMETER"
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
                    <p className="text-xs font-medium text-foreground">
                      {panel.code} {panel.name}
                    </p>
                    <span
                      className="text-[11px] font-semibold"
                      style={{ color: tone }}
                    >
                      {signedPercent}
                    </span>
                  </div>
                  <p className="mt-1 text-lg font-semibold tracking-tight text-foreground">
                    {panel.price.toFixed(1)}
                  </p>
                  <p className="text-[11px]" style={{ color: tone }}>
                    {signedChange}
                  </p>
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
            title="權值股"
            note="Pie-with-needle metric A."
            span={12}
            units={1}
          >
            <MetricNeedleChart index={0} />
          </PanelCard>
          <PanelCard
            title="科技股"
            note="Pie-with-needle metric B."
            span={12}
            units={1}
          >
            <MetricNeedleChart index={1} />
          </PanelCard>
          <PanelCard
            title="金融股"
            note="Pie-with-needle metric C."
            span={12}
            units={1}
          >
            <MetricNeedleChart index={2} />
          </PanelCard>
        </div>
      </BentoGridSection>
    </PageLayout>
  );
}
