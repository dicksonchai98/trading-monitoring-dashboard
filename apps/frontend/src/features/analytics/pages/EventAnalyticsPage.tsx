import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Navigate } from "react-router-dom";
import { PageLayout } from "@/components/ui/page-layout";
import { PanelCard } from "@/components/ui/panel-card";
import { Typography } from "@/components/ui/typography";
import { getAnalyticsEvents, getAnalyticsMetrics, getEventSamples, getEventStats } from "@/features/analytics/api/analytics";
import { AnalyticsEmptyState } from "@/features/analytics/components/AnalyticsEmptyState";
import { AnalyticsErrorState } from "@/features/analytics/components/AnalyticsErrorState";
import { AnalyticsFilterBar } from "@/features/analytics/components/AnalyticsFilterBar";
import {
  analyticsEventsRegistryQueryKey,
  analyticsMetricsRegistryQueryKey,
  buildEventSamplesQueryKey,
  buildEventStatsQueryKey,
} from "@/features/analytics/lib/query-keys";
import { resetPageOnFilterChange } from "@/features/analytics/validation/filter-schema";
import { useT } from "@/lib/i18n";
import { ApiError } from "@/lib/api/client";
import { useAuthStore } from "@/lib/store/auth-store";

export function EventAnalyticsPage(): JSX.Element {
  const t = useT();
  const { token } = useAuthStore();
  const [code, setCode] = useState("TXF");
  const [startDate, setStartDate] = useState("2026-01-01");
  const [endDate, setEndDate] = useState("2026-01-31");
  const [eventId, setEventId] = useState("");
  const [flatThreshold, setFlatThreshold] = useState(0);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("-trade_date");
  const pageSize = 100;
  const version = "latest";
  const hasInvalidDateRange = startDate > endDate;

  const eventsQuery = useQuery({
    queryKey: analyticsEventsRegistryQueryKey,
    queryFn: ({ signal }) => getAnalyticsEvents(token, signal),
  });
  useQuery({
    queryKey: analyticsMetricsRegistryQueryKey,
    queryFn: ({ signal }) => getAnalyticsMetrics(token, signal),
  });

  const events = eventsQuery.data?.events ?? [];
  useEffect(() => {
    if (!eventId && events.length > 0) {
      setEventId(events[0].id);
    }
  }, [eventId, events]);

  const statsQuery = useQuery({
    queryKey: buildEventStatsQueryKey({
      eventId,
      code,
      startDate,
      endDate,
      version,
      flatThreshold,
    }),
    queryFn: ({ signal }) =>
      getEventStats(token, {
        eventId,
        code,
        startDate,
        endDate,
        version,
        flatThreshold,
      }, signal),
    enabled: Boolean(eventId) && !hasInvalidDateRange,
  });
  // The API returns EventStatsListResponse (items: EventStatsResponse[]).
  // Use the first item when consuming single-stat summaries.
  const stats = statsQuery.data?.items?.[0] ?? null;

  const samplesQuery = useQuery({
    queryKey: buildEventSamplesQueryKey({
      eventId,
      code,
      startDate,
      endDate,
      page,
      pageSize,
      sort,
      flatThreshold,
    }),
    queryFn: ({ signal }) =>
      getEventSamples(token, {
        eventId,
        code,
        startDate,
        endDate,
        page,
        pageSize,
        sort,
        flatThreshold,
      }, signal),
    enabled: Boolean(eventId) && !hasInvalidDateRange,
  });

  const apiStatus = useMemo(() => {
    const statsErr = statsQuery.error;
    const samplesErr = samplesQuery.error;
    const registryErr = eventsQuery.error;
    const err = statsErr ?? samplesErr ?? registryErr;
    if (err instanceof ApiError) {
      return err.status;
    }
    return undefined;
  }, [eventsQuery.error, samplesQuery.error, statsQuery.error]);

  if (apiStatus === 401) {
    return <Navigate to="/login" replace />;
  }
  if (apiStatus === 403) {
    return <Navigate to="/forbidden" replace />;
  }

  function updateFilter(next: {
    code?: string;
    startDate?: string;
    endDate?: string;
    eventId?: string;
    flatThreshold?: number;
  }): void {
    const prev = { code, startDate, endDate, eventId, flatThreshold };
    const merged = {
      code: next.code ?? code,
      startDate: next.startDate ?? startDate,
      endDate: next.endDate ?? endDate,
      eventId: next.eventId ?? eventId,
      flatThreshold: next.flatThreshold ?? flatThreshold,
    };
    setCode(merged.code);
    setStartDate(merged.startDate);
    setEndDate(merged.endDate);
    setEventId(merged.eventId);
    setFlatThreshold(merged.flatThreshold);
    setPage(resetPageOnFilterChange(prev, merged, page));
  }

  const sampleItems = samplesQuery.data?.items ?? [];
  const canMoveNext = Boolean(samplesQuery.data && (samplesQuery.data.total > page * pageSize));
  const pieData = [
    { name: t("analytics.event.up"), value: stats?.up_probability ?? 0 },
    { name: t("analytics.event.down"), value: stats?.down_probability ?? 0 },
    { name: t("analytics.event.flat"), value: stats?.flat_probability ?? 0 },
  ];
  const histogramData = (stats?.histogram?.bins ?? []).map((bin, index) => ({
    bin,
    count: stats?.histogram?.counts[index] ?? 0,
  }));

  return (
    <PageLayout title={t("analytics.event.title")} bodyClassName="space-y-[var(--section-gap)]">
      <PanelCard title={t("analytics.filters.title")} span={12}>
        <AnalyticsFilterBar
          code={code}
          startDate={startDate}
          endDate={endDate}
          eventId={eventId}
          events={events}
          flatThreshold={flatThreshold}
          onCodeChange={(value) => updateFilter({ code: value })}
          onStartDateChange={(value) => updateFilter({ startDate: value })}
          onEndDateChange={(value) => updateFilter({ endDate: value })}
          onEventIdChange={(value) => updateFilter({ eventId: value })}
          onFlatThresholdChange={(value) => updateFilter({ flatThreshold: value })}
        />
        {hasInvalidDateRange ? (
          <Typography as="p" variant="body" className="mt-2 text-danger">
            {t("analytics.filters.invalidDateRange")}
          </Typography>
        ) : null}
      </PanelCard>

      {apiStatus && apiStatus >= 400 && apiStatus !== 401 && apiStatus !== 403 ? (
        <AnalyticsErrorState status={apiStatus} onRetry={() => void Promise.all([statsQuery.refetch(), samplesQuery.refetch()])} />
      ) : null}
      {hasInvalidDateRange ? <AnalyticsErrorState status={400} /> : null}

      <PanelCard
        title={t("analytics.summary.title")}
        span={6}
        note={
          statsQuery.isLoading ? t("analytics.common.loading") : `${t("analytics.event.samples")}: ${stats?.sample_count ?? 0}`
        }
      >
        {statsQuery.isLoading ? (
          <div className="space-y-2" data-testid="event-summary-skeleton">
            <div className="h-4 w-32 animate-pulse rounded bg-muted" />
            <div className="h-4 w-40 animate-pulse rounded bg-muted" />
            <div className="h-4 w-36 animate-pulse rounded bg-muted" />
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            <Typography as="p" variant="body">{t("analytics.event.up")}: {stats?.up_probability ?? 0}</Typography>
            <Typography as="p" variant="body">{t("analytics.event.down")}: {stats?.down_probability ?? 0}</Typography>
            <Typography as="p" variant="body">{t("analytics.event.flat")}: {stats?.flat_probability ?? 0}</Typography>
            <Typography as="p" variant="body">{t("analytics.event.avgNextDayReturn")}: {stats?.avg_next_day_return ?? 0}</Typography>
            <Typography as="p" variant="body">{t("analytics.event.avgNextDayRange")}: {stats?.avg_next_day_range ?? 0}</Typography>
          </div>
        )}
      </PanelCard>

      <PanelCard title={t("analytics.event.charts")} span={6}>
        {statsQuery.isLoading ? (
          <div className="space-y-2" data-testid="event-charts-skeleton">
            <div className="h-32 animate-pulse rounded bg-muted" />
            <div className="h-32 animate-pulse rounded bg-muted" />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="h-[180px]" data-testid="event-direction-pie">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie dataKey="value" data={pieData} outerRadius={60} fill="#8884d8" />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="h-[180px]" data-testid="event-return-histogram">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={histogramData}>
                  <XAxis dataKey="bin" hide />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#60a5fa" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </PanelCard>

      <PanelCard title={t("analytics.event.samples")} span={6} note={`${t("analytics.event.page")} ${page}`}>
        {samplesQuery.isLoading ? (
          <div className="space-y-2" data-testid="event-samples-skeleton">
            <div className="h-4 w-full animate-pulse rounded bg-muted" />
            <div className="h-4 w-full animate-pulse rounded bg-muted" />
            <div className="h-4 w-full animate-pulse rounded bg-muted" />
          </div>
        ) : sampleItems.length === 0 ? (
          <AnalyticsEmptyState title={t("analytics.event.emptyTitle")} description={t("analytics.event.emptyDescription")} />
        ) : (
          <>
            <label className="mb-2 flex items-center gap-2 text-sm" htmlFor="event-sample-sort">
              <Typography as="span" variant="body">{t("analytics.event.sort")}</Typography>
              <select
                id="event-sample-sort"
                value={sort}
                onChange={(event) => setSort(event.target.value)}
              >
                <option value="-trade_date">{t("analytics.event.latestFirst")}</option>
                <option value="trade_date">{t("analytics.event.oldestFirst")}</option>
              </select>
            </label>
            <table className="text-sm">
              <thead>
                <tr>
                  <th className="px-2 py-1 text-left">{t("analytics.event.tradeDate")}</th>
                  <th className="px-2 py-1 text-left">{t("analytics.event.nextDayReturn")}</th>
                  <th className="px-2 py-1 text-left">{t("analytics.event.category")}</th>
                </tr>
              </thead>
              <tbody>
                {sampleItems.map((row) => (
                  <tr key={row.trade_date}>
                    <td className="px-2 py-1">{row.trade_date}</td>
                    <td className="px-2 py-1">{row.next_day_return}</td>
                    <td className="px-2 py-1">{row.next_day_category}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
        <div className="mt-3 flex items-center gap-2">
          <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1}>
            {t("analytics.event.prevPage")}
          </button>
          <button
            type="button"
            onClick={() => setPage((current) => current + 1)}
            disabled={hasInvalidDateRange || (!canMoveNext && sampleItems.length === 0)}
          >
            {t("analytics.event.nextPage")}
          </button>
        </div>
      </PanelCard>
    </PageLayout>
  );
}
