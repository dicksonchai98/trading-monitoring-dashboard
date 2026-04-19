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
import { useT, type TranslationKey } from "@/lib/i18n";
import { useAuthStore } from "@/lib/store/auth-store";

const EVENT_LABEL_KEYS: Partial<Record<string, TranslationKey>> = {
  all: "dashboard.analysis.event.all",
  day_up_gt_100: "dashboard.analysis.event.day_up_gt_100",
  day_up_gt_200: "dashboard.analysis.event.day_up_gt_200",
  day_down_lt_minus_100: "dashboard.analysis.event.day_down_lt_minus_100",
  day_down_lt_minus_200: "dashboard.analysis.event.day_down_lt_minus_200",
  day_range_gt_200: "dashboard.analysis.event.day_range_gt_200",
  day_range_gt_300: "dashboard.analysis.event.day_range_gt_300",
  close_position_gt_0_8: "dashboard.analysis.event.close_position_gt_0_8",
  close_position_lt_0_2: "dashboard.analysis.event.close_position_lt_0_2",
  gap_up_gt_100: "dashboard.analysis.event.gap_up_gt_100",
  gap_down_lt_minus_100: "dashboard.analysis.event.gap_down_lt_minus_100",
};

function toEventLabel(
  eventId: string,
  t: ReturnType<typeof useT>,
  fallback?: string,
): string {
  const key = EVENT_LABEL_KEYS[eventId];
  return key ? t(key) : (fallback ?? eventId);
}

export function HistoricalDataAnalysisOverview(): JSX.Element {
  const t = useT();
  const { token } = useAuthStore();
  const [eventId, setEventId] = useState("all");
  const [code, setCode] = useState("TXFR1");
  const hasInvalidRequiredInput = !eventId.trim();

  const eventsQuery = useQuery({
    queryKey: ["historical-event-registry"],
    queryFn: ({ signal }) => getAnalyticsEvents(token, signal),
    retry: false,
  });

  const eventOptions = eventsQuery.data?.events ?? [];
  const isEventsLoading = eventsQuery.isLoading;
  useEffect(() => {
    if (eventId === "all" || eventOptions.length === 0) {
      return;
    }
    const exists = eventOptions.some((item) => item.id === eventId);
    if (!exists) {
      setEventId(eventOptions[0].id);
    }
  }, [eventId, eventOptions]);

  const statsQuery = useQuery({
    queryKey: ["historical-event-stats", eventId, code],
    queryFn: ({ signal }) =>
      getEventStats(
        token,
        {
          eventId: eventId.trim(),
          code,
          flatThreshold: 0,
        },
        signal,
      ),
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
        eventOptions={eventOptions.map((item) => ({
          value: item.id,
          label: toEventLabel(item.id, t, item.label ?? item.id),
        }))}
        isEventsLoading={isEventsLoading}
        onEventIdChange={setEventId}
        onCodeChange={setCode}
      />

      {apiStatus && apiStatus >= 400 ? (
        <ApiStatusAlert
          message={t("dashboard.analysis.apiFailed", {
            status: String(apiStatus),
          })}
          status={apiStatus}
        />
      ) : null}

      <BentoGridSection
        tooltip={`此页主要显示该事件发生后\n隔天行情走势的概率`}
        title={t("dashboard.analysis.sectionTitle")}
        gridClassName="h-full auto-rows-fr lg:grid-cols-8"
      >
        {statsQuery.isLoading ? (
          <PanelCard
            title={eventId}
            note={t("dashboard.analysis.codeNote", { code })}
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
                name: t("analytics.event.up"),
                value: Number((item.up_probability * 100).toFixed(1)),
                fill: "#ef4444",
              },
              {
                name: t("analytics.event.flat"),
                value: Number((item.flat_probability * 100).toFixed(1)),
                fill: "#9ca3af",
              },
              {
                name: t("analytics.event.down"),
                value: Number((item.down_probability * 100).toFixed(1)),
                fill: "#22c55e",
              },
            ];

            return (
              <PanelCard
                key={`${item.event_id}-${item.version}`}
                title={toEventLabel(item.event_id, t, item.event_id)}
                note={t("dashboard.analysis.codeNote", { code: String(item.code) })}
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
            note={t("dashboard.analysis.codeNote", { code })}
            span={2}
            units={1}
            className="h-full"
            contentClassName="pt-[var(--panel-gap)]"
            data-testid="historical-signal-panel"
          >
            <div className="text-sm text-muted-foreground">
              {t("dashboard.analysis.empty")}
            </div>
          </PanelCard>
        )}
      </BentoGridSection>
    </PageLayout>
  );
}
