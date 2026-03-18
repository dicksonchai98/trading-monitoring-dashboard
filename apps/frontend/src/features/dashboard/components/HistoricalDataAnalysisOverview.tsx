import type { JSX } from "react";
import { Badge } from "@/components/ui/badge";
import { BentoGridSection } from "@/components/ui/bento-grid";
import { PageLayout } from "@/components/ui/page-layout";
import { PanelCard } from "@/components/ui/panel-card";
import { DealerPositionChart } from "@/features/dashboard/components/PanelCharts";

const historicalSignalPanels = [
  {
    title: "夜盤大漲",
    note: "夜盤漲幅明顯擴大，通常代表隔日開盤有延續追價壓力。",
  },
  {
    title: "夜盤大跌",
    note: "夜盤跌幅快速擴大，代表隔日早盤可能先反映風險性賣壓。",
  },
  {
    title: "跳空開高",
    note: "開盤價高於前一交易日區間，常伴隨追價與回補缺口博弈。",
  },
  {
    title: "跳空開低",
    note: "開盤價低於前一交易日區間，觀察是否出現低接買盤回補。",
  },
  {
    title: "外資現貨-超額買超",
    note: "外資現貨買盤顯著高於常態，偏多籌碼結構有機會延續。",
  },
  {
    title: "外資現貨-超額賣超",
    note: "外資現貨賣壓高於均值，短線需留意權值股同步轉弱。",
  },
  {
    title: "成交量-爆量",
    note: "當日成交量遠高於均值，代表市場分歧擴大與波動加劇。",
  },
  {
    title: "成交量-沒量",
    note: "量能低於常態，走勢延續性通常較差，易落入震盪盤。",
  },
  {
    title: "成交量-比昨日多",
    note: "量能較昨日擴增，若配合漲勢可視為短線動能強化。",
  },
  {
    title: "成交量-比昨日少",
    note: "量能較昨日萎縮，若指數上行需留意背離與追價風險。",
  },
  {
    title: "大戶籌碼-超額",
    note: "大戶部位擴張速度高於日常波動，代表主力參與度提升。",
  },
  {
    title: "大戶籌碼-少量",
    note: "大戶部位變化有限，市場可能缺乏趨勢推進的主導力量。",
  },
  {
    title: "日盤漲夜盤漲",
    note: "日夜盤同向上漲，偏多慣性較強，通常有趨勢延續機會。",
  },
  {
    title: "日盤跌夜盤跌",
    note: "日夜盤同向走弱，偏空慣性延續，需嚴控逆勢部位風險。",
  },
];

export function HistoricalDataAnalysisOverview(): JSX.Element {
  return (
    <PageLayout
      title="Historical Data Analysis"
      actions={<Badge variant="success">SSE Connected</Badge>}
      bodyClassName="space-y-[var(--section-gap)]"
    >
      <BentoGridSection title="HISTORICAL SIGNALS" gridClassName="h-full auto-rows-fr lg:grid-cols-8">
        {historicalSignalPanels.map((panel) => (
          <PanelCard
            key={panel.title}
            title={panel.title}
            note={panel.note}
            span={2}
            units={1}
            className="h-full"
            contentClassName="pt-[var(--panel-gap)]"
            data-testid="historical-signal-panel"
          >
            <DealerPositionChart />
          </PanelCard>
        ))}
      </BentoGridSection>
    </PageLayout>
  );
}
