import type { JSX } from "react";
import { PanelCard } from "@/components/ui/panel-card";
import { CardDataState } from "@/features/dashboard/components/CardDataState";
import { resolveCardDataStatus } from "@/features/dashboard/lib/card-data-state";

interface MarketOverviewChartCardProps {
  title: string;
  testId: string;
  span?: number;
  units?: number;
  meta?: string;
  note?: string;
  loading: boolean;
  error: string | null;
  hasData: boolean;
  loadingText: string;
  errorText: string;
  emptyText: string;
  children: JSX.Element;
}

export function MarketOverviewChartCard({
  title,
  testId,
  span,
  units,
  meta,
  note,
  loading,
  error,
  hasData,
  loadingText,
  errorText,
  emptyText,
  children,
}: MarketOverviewChartCardProps): JSX.Element {
  const status = resolveCardDataStatus({ loading, error, hasData });

  return (
    <PanelCard
      title={title}
      span={span}
      units={units}
      meta={meta}
      note={note}
      data-testid={testId}
    >
      {status === "loading" ? <CardDataState text={loadingText} /> : null}
      {status === "error" ? <CardDataState text={errorText} /> : null}
      {status === "empty" ? <CardDataState text={emptyText} /> : null}
      {status === "ready" ? children : null}
    </PanelCard>
  );
}

