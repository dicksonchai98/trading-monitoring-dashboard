import type { JSX } from "react";
import { PanelCard } from "@/components/ui/panel-card";
import { useT } from "@/lib/i18n";

interface ParticipantAmplitudeSummary {
  avg5: number;
  avg10: number;
  yesterday: number;
  max5: number;
  max10: number;
}

interface ParticipantAmplitudeSummaryCardProps {
  summary: ParticipantAmplitudeSummary;
}

function formatAmplitude(value: number): string {
  if (!Number.isFinite(value)) {
    return "0 點";
  }

  return `${value.toFixed(1)} 點`;
}

export function ParticipantAmplitudeSummaryCard({
  summary,
}: ParticipantAmplitudeSummaryCardProps): JSX.Element {
  const t = useT();

  return (
    <PanelCard
      title={t("dashboard.realtime.amplitudeSummary.title")}
      span={2}
      note={t("dashboard.realtime.amplitudeSummary.note")}
      data-testid="participant-amplitude-summary-card"
    >
      <div
        className="space-y-2 pt-[var(--panel-gap)] text-xs"
        data-testid="participant-amplitude-summary"
      >
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">
            {t("dashboard.realtime.amplitudeSummary.fiveDay")}
          </span>
          <span className="font-semibold text-foreground">
            {formatAmplitude(summary.avg5)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">
            {t("dashboard.realtime.amplitudeSummary.tenDayAvg")}
          </span>
          <span className="font-semibold text-foreground">
            {formatAmplitude(summary.avg10)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">
            {t("dashboard.realtime.amplitudeSummary.yesterday")}
          </span>
          <span className="font-semibold text-foreground">
            {formatAmplitude(summary.yesterday)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">
            {t("dashboard.realtime.amplitudeSummary.fiveDayHigh")}
          </span>
          <span className="font-semibold text-[#ef4444]">
            {formatAmplitude(summary.max5)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">
            {t("dashboard.realtime.amplitudeSummary.tenDayHigh")}
          </span>
          <span className="font-semibold text-[#22c55e]">
            {formatAmplitude(summary.max10)}
          </span>
        </div>
      </div>
    </PanelCard>
  );
}
