import { useEffect, useState, type JSX } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { BentoGridSection } from "@/components/ui/bento-grid";
import { PageLayout } from "@/components/ui/page-layout";
import { getAnalyticsEvents, getEventStats } from "@/features/analytics/api/analytics";
import { PanelCard } from "@/components/ui/panel-card";
import { DealerPositionChart } from "@/features/dashboard/components/PanelCharts";
import { useAuthStore } from "@/lib/store/auth-store";

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
  const { token } = useAuthStore();
  const [eventId, setEventId] = useState("day_up_gt_100");
  const [code, setCode] = useState("TXFR1");
  const [startDate, setStartDate] = useState("2026-01-01");
  const [endDate, setEndDate] = useState("2026-01-31");
  const [version, setVersion] = useState("latest");

  const hasInvalidDateRange = startDate > endDate;
  const hasInvalidRequiredInput = !eventId.trim();
  const eventsQuery = useQuery({
    queryKey: ["historical-event-registry"],
    queryFn: () => getAnalyticsEvents(token),
    retry: false,
  });
  const eventOptions = eventsQuery.data?.events ?? [];

  useEffect(() => {
    if (eventOptions.length === 0) {
      return;
    }
    const exists = eventOptions.some((item) => item.id === eventId);
    if (!exists) {
      setEventId(eventOptions[0].id);
    }
  }, [eventId, eventOptions]);

  const statsQuery = useQuery({
    queryKey: ["historical-event-stats", eventId, code, startDate, endDate, version],
    queryFn: () =>
      getEventStats(token, {
        eventId: eventId.trim(),
        code,
        startDate,
        endDate,
        version,
        flatThreshold: 0,
      }),
    enabled:
      !hasInvalidDateRange &&
      !hasInvalidRequiredInput &&
      eventOptions.length > 0 &&
      !eventsQuery.isLoading,
    retry: false,
  });

  return (
    <PageLayout
      title="Historical Data Analysis"
      actions={<Badge variant="success">SSE Connected</Badge>}
      bodyClassName="space-y-[var(--section-gap)]"
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Event ID</span>
          <select
            id="historical-event-id"
            aria-label="event_id"
            value={eventId}
            onChange={(event) => setEventId(event.target.value)}
            className="h-9 rounded-sm border border-border bg-card px-3 text-sm text-foreground"
          >
            {eventsQuery.isLoading ? <option value="">Loading events...</option> : null}
            {eventOptions.length === 0 && !eventsQuery.isLoading ? (
              <option value="">No events available</option>
            ) : null}
            {eventOptions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label ?? item.id}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Code</span>
          <select
            id="historical-code"
            aria-label="code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            className="h-9 rounded-sm border border-border bg-card px-3 text-sm text-foreground"
          >
            <option value="TXFR1">TXFR1</option>
            <option value="TXFD1">TXFD1</option>
            <option value="TXF">TXF</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-[0.08em] text-muted-foreground">From</span>
          <input
            id="historical-start-date"
            aria-label="start_date"
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            className="h-9 rounded-sm border border-border bg-card px-3 text-sm text-foreground"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-[0.08em] text-muted-foreground">To</span>
          <input
            id="historical-end-date"
            aria-label="end_date"
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
            className="h-9 rounded-sm border border-border bg-card px-3 text-sm text-foreground"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Version</span>
          <select
            id="historical-version"
            aria-label="version"
            value={version}
            onChange={(event) => setVersion(event.target.value)}
            className="h-9 rounded-sm border border-border bg-card px-3 text-sm text-foreground"
          >
            <option value="latest">latest</option>
            <option value="1">1</option>
            <option value="2">2</option>
          </select>
        </label>

      </div>

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
