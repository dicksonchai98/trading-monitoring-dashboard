import type { JSX } from "react";
import { BentoGridSection } from "@/components/ui/bento-grid";
import { PageLayout } from "@/components/ui/page-layout";
import { useRealtimeStore } from "@/features/realtime/store/realtime.store";
import { useI18n } from "@/lib/i18n";
import { ResponsiveContainer, Treemap, type TreemapNode } from "recharts";

const data = [
  {
    name: "semiconductor",
    children: [
      { name: "2330", size: 34.5, contribution_points: 5.42 },
      { name: "2454", size: 5.2, contribution_points: 2.61 },
      { name: "2303", size: 2.2, contribution_points: 0.97 },
      { name: "3711", size: 1.9, contribution_points: 0.58 },
      { name: "3035", size: 1.4, contribution_points: -0.24 },
    ],
  },
  {
    name: "financial",
    children: [
      { name: "2881", size: 7.8, contribution_points: 1.24 },
      { name: "2882", size: 4.3, contribution_points: -1.56 },
      { name: "2884", size: 4.1, contribution_points: -0.69 },
      { name: "2891", size: 2.7, contribution_points: 0.36 },
      { name: "2892", size: 2.1, contribution_points: -0.43 },
    ],
  },

  {
    name: "traditional",
    children: [
      { name: "1301", size: 2.8, contribution_points: -1.31 },
      { name: "1303", size: 1.6, contribution_points: -0.52 },
      { name: "2002", size: 1.5, contribution_points: -0.88 },
      { name: "2207", size: 1.4, contribution_points: 0.41 },
      { name: "2412", size: 3.3, contribution_points: -1.92 },
    ],
  },
  {
    name: "other",
    children: [
      { name: "2317", size: 4.5, contribution_points: 1.88 },
      { name: "2382", size: 2.2, contribution_points: 0.73 },
      { name: "2603", size: 1.8, contribution_points: -0.73 },
      { name: "2615", size: 1.3, contribution_points: -0.35 },
      { name: "3045", size: 1.4, contribution_points: 0.26 },
    ],
  },
];

const COLORS = [
  "#8889DD",
  "#9597E4",
  "#8DC77B",
  "#A5D297",
  "#E2CF45",
  "#F8C12D",
];

const MOCK_INDEX_CONTRIB_RANKING = {
  top: [
    { rank_no: 1, symbol: "2330", contribution_points: 5.42 },
    { rank_no: 2, symbol: "2454", contribution_points: 2.61 },
    { rank_no: 3, symbol: "2317", contribution_points: 1.88 },
    { rank_no: 4, symbol: "2881", contribution_points: 1.24 },
    { rank_no: 5, symbol: "2303", contribution_points: 0.97 },
  ],
  bottom: [
    { rank_no: 1, symbol: "2412", contribution_points: -1.92 },
    { rank_no: 2, symbol: "2882", contribution_points: -1.56 },
    { rank_no: 3, symbol: "1301", contribution_points: -1.31 },
    { rank_no: 4, symbol: "2002", contribution_points: -0.88 },
    { rank_no: 5, symbol: "2603", contribution_points: -0.73 },
  ],
};

const STOCK_NAME_MAP: Record<string, { en: string; zh: string }> = {
  "1301": { en: "Formosa Plastics", zh: "台塑" },
  "1303": { en: "Nan Ya Plastics", zh: "南亞" },
  "2002": { en: "China Steel", zh: "中鋼" },
  "2207": { en: "Hotai Motor", zh: "和泰車" },
  "2303": { en: "UMC", zh: "聯電" },
  "2317": { en: "Hon Hai", zh: "鴻海" },
  "2330": { en: "TSMC", zh: "台積電" },
  "2382": { en: "Quanta", zh: "廣達" },
  "2412": { en: "Chunghwa Telecom", zh: "中華電信" },
  "2454": { en: "MediaTek", zh: "聯發科" },
  "2603": { en: "Evergreen Marine", zh: "長榮" },
  "2615": { en: "Wan Hai", zh: "萬海" },
  "2881": { en: "Fubon Financial", zh: "富邦金" },
  "2882": { en: "Cathay Financial", zh: "國泰金" },
  "2884": { en: "E.Sun Financial", zh: "玉山金" },
  "2891": { en: "CTBC Financial", zh: "中信金" },
  "2892": { en: "First Financial", zh: "第一金" },
  "3035": { en: "Alchip", zh: "智原" },
  "3045": { en: "Taiwan Mobile", zh: "台灣大" },
  "3711": { en: "ASE Technology", zh: "日月光投控" },
};

const TREEMAP_PANEL_HEIGHT_CLASS = "h-[520px]";

function getStockName(symbol: string, locale: string): string | null {
  const stockInfo = STOCK_NAME_MAP[symbol];
  if (!stockInfo) {
    return null;
  }
  return locale === "zh-TW" ? stockInfo.zh : stockInfo.en;
}

function formatStockLabel(symbol: string, locale: string): string {
  const stockName = getStockName(symbol, locale);
  return stockName ? `${symbol} ${stockName}` : symbol;
}

function CustomizedContent(
  props: TreemapNode & { stockName?: string | null },
): JSX.Element {
  const { root, depth, x, y, width, height, index, name, stockName } = props;

  // contribution_points is directly on props, not in payload
  const contributionPoints = (props as any).contribution_points;

  const showSectorLabel = depth === 1 && width > 80 && height > 28;
  const showSymbolLabel = depth === 2 && width > 34 && height > 18;
  const showStockNameLabel =
    depth === 2 && Boolean(stockName) && width > 72 && height > 42;
  const showContributionLabel =
    depth === 2 && showSymbolLabel && typeof contributionPoints === "number";
  const contributionColor =
    contributionPoints > 0
      ? "#ef4444"
      : contributionPoints < 0
        ? "#22c55e"
        : "#94a3b8";
  const contributionText =
    typeof contributionPoints !== "number"
      ? "--"
      : `${contributionPoints > 0 ? "+" : ""}${contributionPoints.toFixed(2)}`;

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        style={{
          fill:
            depth < 2
              ? COLORS[Math.floor((index / (root?.children?.length ?? 1)) * 6)]
              : "#ffffff00",
          stroke: "#fff",
          strokeWidth: 2 / (depth + 1e-10),
          strokeOpacity: 1 / (depth + 1e-10),
        }}
      />
      {showSectorLabel ? (
        <text
          x={x + width / 2}
          y={y + height / 2 + 7}
          textAnchor="middle"
          fill="#fff"
          fontSize={14}
        >
          {name}
        </text>
      ) : null}
      {showSymbolLabel ? (
        <text
          x={x + width / 2}
          y={
            y +
            height / 2 +
            (showContributionLabel
              ? showStockNameLabel
                ? -14
                : -8
              : showStockNameLabel
                ? -4
                : 4)
          }
          textAnchor="middle"
          fill="#f8fafc"
          fontSize={13}
          fontWeight={200}
        >
          {name}
        </text>
      ) : null}
      {showStockNameLabel ? (
        <text
          x={x + width / 2}
          y={y + height / 2 + (showContributionLabel ? 0 : 12)}
          textAnchor="middle"
          fill="#f8fafc"
          fontSize={10}
          fontWeight={400}
        >
          {stockName}
        </text>
      ) : null}
      {showContributionLabel ? (
        <text
          x={x + width / 2}
          y={y + height / 2 + (showStockNameLabel ? 16 : 12)}
          textAnchor="middle"
          fill={contributionColor}
          stroke="none"
          fontSize={12}
          fontWeight={9000}
        >
          {contributionText}
        </text>
      ) : null}
    </g>
  );
}

export function TreemapDemoPage(): JSX.Element {
  const { locale } = useI18n();
  const indexContribRanking = useRealtimeStore((state) => state.indexContribRanking);
  const indexContribSector = useRealtimeStore((state) => state.indexContribSector);

  const topFive = (indexContribRanking?.top ?? []).slice(0, 5);
  const bottomFive = (indexContribRanking?.bottom ?? []).slice(0, 5);
  const displayTopFive =
    topFive.length > 0 ? topFive : MOCK_INDEX_CONTRIB_RANKING.top;
  const displayBottomFive =
    bottomFive.length > 0 ? bottomFive : MOCK_INDEX_CONTRIB_RANKING.bottom;

  // Use SSE data if available, otherwise fallback to mock data
  const treemapData =
    indexContribSector?.sectors && indexContribSector.sectors.length > 0
      ? indexContribSector.sectors
      : data;

  const formatContribution = (value: number): string => {
    const sign = value > 0 ? "+" : "";
    return `${sign}${value.toFixed(2)}`;
  };

  return (
    <PageLayout
      title="Treemap Demo"
      bodyClassName="space-y-[var(--section-gap)]"
    >
      <BentoGridSection
        title="Industry Weight Treemap"
        tooltip="Mock data (20 symbols / 4 sectors)"
      >
        <div
          className={`lg:col-span-9 rounded-sm p-3 ${TREEMAP_PANEL_HEIGHT_CLASS}`}
          data-testid="treemap-demo-container"
        >
          <div
            className="mx-auto h-full w-full"
            data-testid="treemap-demo-chart"
          >
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <Treemap
                data={treemapData}
                dataKey="size"
                aspectRatio={4 / 3}
                stroke="#fff"
                fill="#8884d8"
                content={(props) => (
                  <CustomizedContent
                    {...props}
                    stockName={
                      typeof props.name === "string"
                        ? getStockName(props.name, locale)
                        : null
                    }
                  />
                )}
                isAnimationActive={false}
              />
            </ResponsiveContainer>
          </div>
        </div>
        <div
          className={`lg:col-span-3 rounded-sm p-3 ${TREEMAP_PANEL_HEIGHT_CLASS} flex flex-col gap-3`}
          data-testid="treemap-ranking-panel"
        >
          <div className="flex min-h-0 flex-1 flex-col rounded-sm border border-border bg-card p-3">
            <p className="text-sm font-semibold text-foreground">
              Top Contributors
            </p>
            <div className="mt-2 h-full space-y-2 overflow-y-auto">
              {displayTopFive.map((item) => (
                <div
                  key={`top-${item.rank_no}-${item.symbol}`}
                  className="flex items-center justify-between rounded-xs border border-border px-2 py-1.5 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-4 text-muted-foreground">
                      {item.rank_no}
                    </span>
                    <span className="font-medium text-foreground">
                      {formatStockLabel(item.symbol, locale)}
                    </span>
                  </div>
                  <span className="font-medium text-rose-500">
                    {formatContribution(item.contribution_points)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col rounded-sm border border-border bg-card p-3">
            <p className="text-sm font-semibold text-foreground">
              Bottom Contributors
            </p>
            <div className="mt-2 h-full space-y-2 overflow-y-auto">
              {displayBottomFive.map((item) => (
                <div
                  key={`bottom-${item.rank_no}-${item.symbol}`}
                  className="flex items-center justify-between rounded-xs border border-border px-2 py-1.5 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-4 text-muted-foreground">
                      {item.rank_no}
                    </span>
                    <span className="font-medium text-foreground">
                      {formatStockLabel(item.symbol, locale)}
                    </span>
                  </div>
                  <span className="font-medium text-emerald-500">
                    {formatContribution(item.contribution_points)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </BentoGridSection>
    </PageLayout>
  );
}
