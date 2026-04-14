import type { JSX } from "react";
import type { AnalyticsRegistryItem } from "@/features/analytics/api/types";

interface AnalyticsFilterBarProps {
  code: string;
  startDate: string;
  endDate: string;
  onCodeChange: (value: string) => void;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  eventId?: string;
  events?: AnalyticsRegistryItem[];
  onEventIdChange?: (value: string) => void;
  metricId?: string;
  metrics?: AnalyticsRegistryItem[];
  onMetricIdChange?: (value: string) => void;
  flatThreshold?: number;
  onFlatThresholdChange?: (value: number) => void;
}

export function AnalyticsFilterBar({
  code,
  startDate,
  endDate,
  onCodeChange,
  onStartDateChange,
  onEndDateChange,
  eventId,
  events,
  onEventIdChange,
  metricId,
  metrics,
  onMetricIdChange,
  flatThreshold,
  onFlatThresholdChange,
}: AnalyticsFilterBarProps): JSX.Element {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <label className="flex flex-col gap-1 text-sm" htmlFor="analytics-code">
        <span>Code</span>
        <select id="analytics-code" value={code} onChange={(event) => onCodeChange(event.target.value)}>
          <option value="TXF">TXF</option>
          <option value="MTX">MTX</option>
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm" htmlFor="analytics-start-date">
        <span>Start Date</span>
        <input
          id="analytics-start-date"
          type="date"
          value={startDate}
          onChange={(event) => onStartDateChange(event.target.value)}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm" htmlFor="analytics-end-date">
        <span>End Date</span>
        <input id="analytics-end-date" type="date" value={endDate} onChange={(event) => onEndDateChange(event.target.value)} />
      </label>

      {events && onEventIdChange ? (
        <label className="flex flex-col gap-1 text-sm" htmlFor="analytics-event-id">
          <span>Event</span>
          <select id="analytics-event-id" value={eventId ?? ""} onChange={(event) => onEventIdChange(event.target.value)}>
            {events.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label ?? item.id}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {metrics && onMetricIdChange ? (
        <label className="flex flex-col gap-1 text-sm" htmlFor="analytics-metric-id">
          <span>Metric</span>
          <select id="analytics-metric-id" value={metricId ?? ""} onChange={(event) => onMetricIdChange(event.target.value)}>
            {metrics.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label ?? item.id}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {onFlatThresholdChange ? (
        <label className="flex flex-col gap-1 text-sm" htmlFor="analytics-flat-threshold">
          <span>Flat Threshold</span>
          <input
            id="analytics-flat-threshold"
            type="number"
            value={flatThreshold ?? 0}
            onChange={(event) => onFlatThresholdChange(Number(event.target.value))}
          />
        </label>
      ) : null}
    </div>
  );
}

