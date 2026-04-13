import { useEffect, useState, type JSX } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { BentoGridSection } from "@/components/ui/bento-grid";
import { ApiStatusAlert } from "@/components/ui/api-status-alert";
import { PageLayout } from "@/components/ui/page-layout";
import {
  getAnalyticsEvents,
  getEventStats,
} from "@/features/analytics/api/analytics";
import { PanelCard } from "@/components/ui/panel-card";
import { DealerPositionChart } from "@/features/dashboard/components/PanelCharts";
import { HistoricalDataAnalysisFilters } from "@/features/dashboard/components/HistoricalDataAnalysisFilters";
import { ApiError } from "@/lib/api/client";
import { useAuthStore } from "@/lib/store/auth-store";
import { useT } from "@/lib/i18n";

const EVENT_LABEL_ZH_MAP: Record<string, string> = {
  all: "全部事件",
  day_up_gt_100: "單日上漲超過 100 點",
  day_up_gt_200: "單日上漲超過 200 點",
  day_down_lt_minus_100: "單日下跌超過 100 點",
  day_down_lt_minus_200: "單日下跌超過 200 點",
  day_range_gt_200: "單日振幅超過 200 點",
  day_range_gt_300: "單日振幅超過 300 點",
  close_position_gt_0_8: "收盤位於高檔（> 0.8）",
  close_position_lt_0_2: "收盤位於低檔（< 0.2）",
  gap_up_gt_100: "跳空上漲超過 100 點",
  gap_down_lt_minus_100: "跳空下跌超過 100 點",
};

function toZhEventLabel(eventId: string, fallback?: string): string {
  return EVENT_LABEL_ZH_MAP[eventId] ?? fallback ?? eventId;
}

export function HistoricalDataAnalysisOverview(): JSX.Element {
  const t = useT();

  const { token } = useAuthStore();
  const [eventId, setEventId] = useState("all");
  const [code, setCode] = useState("TXFR1");
  const hasInvalidRequiredInput = !eventId.trim();
  const eventsQuery = useQuery({
    queryKey: ["historical-event-registry"],
    queryFn: () => getAnalyticsEvents(token),
    retry: false,
  });
  const eventOptions = eventsQuery.data?.events ?? [];
  const eventSelectOptions = [
    { value: "all", label: toZhEventLabel("all", "all") },
    ...eventOptions.map((item) => ({
      value: item.id,
      label: toZhEventLabel(item.id, item.label ?? item.id),
    })),
  ];

  useEffect(() => {
    if (eventId === "all") {
      return;
    }
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
    ],
    queryFn: () =>
      getEventStats(token, {
        eventId: eventId.trim(),
        code,
        flatThreshold: 0,
      }),
    enabled: !hasInvalidRequiredInput,
    retry: false,
  });

  const apiStatus = (() => {
    const err = statsQuery.error ?? eventsQuery.error;
    if (err instanceof ApiError) {
      return err.status;
    }
    return undefined;
  })();
  const statsItems = statsQuery.data?.items ?? [];
  return (
    <PageLayout
      title={t("dashboard.analysis.title")}
      actions={
        <Badge variant="success">{t("dashboard.analysis.connected")}</Badge>
      }
      bodyClassName="space-y-[var(--section-gap)]"
    >
      <HistoricalDataAnalysisFilters
        eventId={eventId}
        code={code}
        eventOptions={eventSelectOptions}
        isEventsLoading={eventsQuery.isLoading}
        onEventIdChange={setEventId}
        onCodeChange={setCode}
      />
      {apiStatus && apiStatus >= 400 ? (
        <ApiStatusAlert message={`Historical signal API failed (HTTP ${apiStatus}).`} status={apiStatus} />
      ) : null}

      <BentoGridSection
        title={t("dashboard.analysis.sectionTitle")}
        gridClassName="h-full auto-rows-fr lg:grid-cols-8"
      >
        {statsQuery.isLoading ? (
          <PanelCard
            title={eventId}
            note={`Code: ${code}`}
            span={2}
            units={1}
            className="h-full"
            contentClassName="pt-[var(--panel-gap)]"
            data-testid="historical-signal-panel"
          >
            <div className="space-y-2" data-testid="historical-signal-loading">
              <div className="h-24 animate-pulse rounded bg-muted" />
              <div className="h-4 w-24 animate-pulse rounded bg-muted" />
            </div>
          </PanelCard>
        ) : statsItems.length > 0 ? (
          statsItems.map((item) => {
            const eventProbabilityData = [
              {
                name: "Up",
                value: Number((item.up_probability * 100).toFixed(1)),
                fill: "#ef4444",
              },
              {
                name: "Flat",
                value: Number((item.flat_probability * 100).toFixed(1)),
                fill: "#9ca3af",
              },
              {
                name: "Down",
                value: Number((item.down_probability * 100).toFixed(1)),
                fill: "#22c55e",
              },
            ];
            return (
              <PanelCard
                key={`${item.event_id}-${item.version}`}
                title={toZhEventLabel(item.event_id, item.event_id)}
                note={`Code: ${item.code}`}
                span={2}
                units={1}
                className="h-full"
                contentClassName="pt-[var(--panel-gap)]"
                data-testid="historical-signal-panel"
              >
                <DealerPositionChart data={eventProbabilityData} />
              </PanelCard>
            );
          })
        ) : (
          <PanelCard
            title={eventId}
            note={`Code: ${code}`}
            span={2}
            units={1}
            className="h-full"
            contentClassName="pt-[var(--panel-gap)]"
            data-testid="historical-signal-panel"
          >
            <div className="text-sm text-muted-foreground">
              No historical signal data in current range.
            </div>
          </PanelCard>
        )}
      </BentoGridSection>
    </PageLayout>
  );
}
