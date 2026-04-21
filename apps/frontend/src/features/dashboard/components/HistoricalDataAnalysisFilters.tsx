import type { JSX } from "react";
import { FilterLayer, type FilterField } from "@/components/filter-layer";
import { useT } from "@/lib/i18n";

type SelectOption = {
  label: string;
  value: string;
  disabled?: boolean;
};

type HistoricalDataAnalysisFiltersProps = {
  eventId: string;
  code: string;
  eventOptions: SelectOption[];
  isEventsLoading: boolean;
  onEventIdChange: (value: string) => void;
  onCodeChange: (value: string) => void;
};

export function HistoricalDataAnalysisFilters({
  eventId,
  code,
  eventOptions,
  isEventsLoading,
  onEventIdChange,
  onCodeChange,
}: HistoricalDataAnalysisFiltersProps): JSX.Element {
  const t = useT();
  const hasEventOptions = eventOptions.length > 0;
  const eventSelectOptions = isEventsLoading && !hasEventOptions
    ? [
        {
          label: t("dashboard.analysis.filter.loadingEvents"),
          value: "__none__",
          disabled: true,
        },
      ]
    : hasEventOptions
      ? [
          {
            label: t("dashboard.analysis.event.all"),
            value: "all",
          },
          ...eventOptions,
        ]
      : [
          {
            label: t("dashboard.analysis.filter.noEvents"),
            value: "__none__",
            disabled: true,
          },
        ];

  const fields: FilterField[] = [
    {
      id: "historical-code",
      label: t("dashboard.analysis.filter.code"),
      ariaLabel: "code",
      type: "select",
      value: code,
      placeholder: t("dashboard.analysis.filter.codePlaceholder"),
      options: [
        { value: "TXFR1", label: "TXFR1" },
        { value: "TXFD1", label: "TXFD1" },
        { value: "TXF", label: "TXF" },
      ],
      onValueChange: onCodeChange,
    },
    {
      id: "historical-event-id",
      label: t("dashboard.analysis.filter.eventId"),
      ariaLabel: "event_id",
      type: "select",
      value: hasEventOptions ? eventId : "__none__",
      placeholder: t("dashboard.analysis.filter.eventPlaceholder"),
      options: eventSelectOptions,
      loading: isEventsLoading,
      onValueChange: onEventIdChange,
      triggerTestId: "historical-event-id-trigger",
    },
  ];

  return <FilterLayer fields={fields} />;
}
