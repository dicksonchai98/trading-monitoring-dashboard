import { useEffect, useState, type JSX } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { BentoGridSection } from "@/components/ui/bento-grid";
import { PageLayout } from "@/components/ui/page-layout";
import {
  getAnalyticsEvents,
  getEventStats,
} from "@/features/analytics/api/analytics";
import { PanelCard } from "@/components/ui/panel-card";
import { DealerPositionChart } from "@/features/dashboard/components/PanelCharts";
import { useAuthStore } from "@/lib/store/auth-store";
import { useT } from "@/lib/i18n";

const signalKeyPairs = [
  {
    title: "dashboard.analysis.signal.nightSurge.title",
    note: "dashboard.analysis.signal.nightSurge.note",
  },
  {
    title: "dashboard.analysis.signal.nightDrop.title",
    note: "dashboard.analysis.signal.nightDrop.note",
  },
  {
    title: "dashboard.analysis.signal.gapUp.title",
    note: "dashboard.analysis.signal.gapUp.note",
  },
  {
    title: "dashboard.analysis.signal.gapDown.title",
    note: "dashboard.analysis.signal.gapDown.note",
  },
  {
    title: "dashboard.analysis.signal.foreignNetBuy.title",
    note: "dashboard.analysis.signal.foreignNetBuy.note",
  },
  {
    title: "dashboard.analysis.signal.foreignNetSell.title",
    note: "dashboard.analysis.signal.foreignNetSell.note",
  },
  {
    title: "dashboard.analysis.signal.volumeSpike.title",
    note: "dashboard.analysis.signal.volumeSpike.note",
  },
  {
    title: "dashboard.analysis.signal.volumeDry.title",
    note: "dashboard.analysis.signal.volumeDry.note",
  },
  {
    title: "dashboard.analysis.signal.volumeUpDayOverDay.title",
    note: "dashboard.analysis.signal.volumeUpDayOverDay.note",
  },
  {
    title: "dashboard.analysis.signal.volumeDownDayOverDay.title",
    note: "dashboard.analysis.signal.volumeDownDayOverDay.note",
  },
  {
    title: "dashboard.analysis.signal.largeTraderExcess.title",
    note: "dashboard.analysis.signal.largeTraderExcess.note",
  },
  {
    title: "dashboard.analysis.signal.largeTraderLight.title",
    note: "dashboard.analysis.signal.largeTraderLight.note",
  },
  {
    title: "dashboard.analysis.signal.dayNightUp.title",
    note: "dashboard.analysis.signal.dayNightUp.note",
  },
  {
    title: "dashboard.analysis.signal.dayNightDown.title",
    note: "dashboard.analysis.signal.dayNightDown.note",
  },
] as const;

export function HistoricalDataAnalysisOverview(): JSX.Element {
  const t = useT();

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
    queryKey: [
      "historical-event-stats",
      eventId,
      code,
      startDate,
      endDate,
      version,
    ],
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
      title={t("dashboard.analysis.title")}
      actions={
        <Badge variant="success">{t("dashboard.analysis.connected")}</Badge>
      }
      bodyClassName="space-y-[var(--section-gap)]"
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
            Event ID
          </span>
          <select
            id="historical-event-id"
            aria-label="event_id"
            value={eventId}
            onChange={(event) => setEventId(event.target.value)}
            className="h-9 rounded-sm border border-border bg-card px-3 text-sm text-foreground"
          >
            {eventsQuery.isLoading ? (
              <option value="">Loading events...</option>
            ) : null}
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
          <span className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
            Code
          </span>
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
          <span className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
            From
          </span>
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
          <span className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
            To
          </span>
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
          <span className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
            Version
          </span>
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

      <BentoGridSection
        title={t("dashboard.analysis.sectionTitle")}
        gridClassName="h-full auto-rows-fr lg:grid-cols-8"
      >
        {signalKeyPairs.map((panel) => (
          <PanelCard
            key={panel.title}
            title={t(panel.title)}
            note={t(panel.note)}
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
