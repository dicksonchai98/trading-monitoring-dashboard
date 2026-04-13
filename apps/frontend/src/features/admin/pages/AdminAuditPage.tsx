import { useMemo, useState, type JSX } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { FilterLayer, type FilterField } from "@/components/filter-layer";
import { Typography } from "@/components/ui/typography";
import { getAdminAuditLogs } from "@/features/admin/api/audit";
import type {
  AdminAuditEventView,
  AdminAuditResult,
} from "@/features/admin/api/types";
import {
  formatAuditTimestamp,
  normalizeAdminAuditEvents,
} from "@/features/admin/lib/audit-events";
import { useT } from "@/lib/i18n";
import { useAuthStore } from "@/lib/store/auth-store";
import { PageLayout } from "@/components/ui/page-layout";

const RESULT_OPTIONS: Array<"all" | AdminAuditResult> = [
  "all",
  "success",
  "accepted",
  "denied",
  "error",
  "unknown",
];

const RESULT_VALUES = new Set(RESULT_OPTIONS);

function toResultBadgeVariant(
  result: AdminAuditResult,
): "success" | "warning" | "danger" | "neutral" {
  if (result === "success") {
    return "success";
  }
  if (result === "accepted") {
    return "warning";
  }
  if (result === "denied" || result === "error") {
    return "danger";
  }
  return "neutral";
}

function renderMetadata(metadata: Record<string, unknown> | null): string {
  if (!metadata) {
    return "{}";
  }
  try {
    return JSON.stringify(metadata, null, 2);
  } catch {
    return "{}";
  }
}

export function AdminAuditPage(): JSX.Element {
  const t = useT();
  const token = useAuthStore((state) => state.token);
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const actionFilter = searchParams.get("action") ?? "all";
  const rawResultFilter = searchParams.get("result") ?? "all";
  const resultFilter: "all" | AdminAuditResult = RESULT_VALUES.has(
    rawResultFilter as "all" | AdminAuditResult,
  )
    ? (rawResultFilter as "all" | AdminAuditResult)
    : "all";
  const actorFilter = searchParams.get("actor") ?? "";
  const pathFilter = searchParams.get("path") ?? "";

  const updateFilterParam = (
    key: "action" | "result" | "actor" | "path",
    value: string,
  ): void => {
    const next = new URLSearchParams(searchParams);
    if (!value || value === "all") {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    setSearchParams(next, { replace: true });
  };

  const logsQuery = useQuery({
    queryKey: [
      "admin",
      "audit",
      token,
      actionFilter,
      resultFilter,
      actorFilter,
      pathFilter,
    ],
    queryFn: () =>
      getAdminAuditLogs(token ?? "", {
        action: actionFilter,
        result: resultFilter,
        actor: actorFilter,
        path: pathFilter,
        limit: 200,
        offset: 0,
      }),
    enabled: Boolean(token),
  });
  const events = useMemo(
    () =>
      normalizeAdminAuditEvents(
        logsQuery.data?.items ?? logsQuery.data?.events ?? [],
      ),
    [logsQuery.data?.events, logsQuery.data?.items],
  );
  const actionOptions = useMemo(() => {
    const set = new Set(events.map((item) => item.action));
    return ["all", ...Array.from(set).sort()];
  }, [events]);
  const resultLabelMap: Record<"all" | AdminAuditResult, string> = {
    all: t("admin.audit.result.all"),
    success: t("admin.audit.result.success"),
    accepted: t("admin.audit.result.accepted"),
    denied: t("admin.audit.result.denied"),
    error: t("admin.audit.result.error"),
    unknown: t("admin.audit.result.unknown"),
  };
  const filterFields: FilterField[] = [
    {
      id: "audit-filter-action",
      label: t("admin.audit.filter.action"),
      ariaLabel: "Filter action",
      type: "select",
      value: actionFilter,
      options: actionOptions.map((action) => ({ value: action, label: action })),
      onValueChange: (value) => updateFilterParam("action", value),
    },
    {
      id: "audit-filter-result",
      label: t("admin.audit.filter.result"),
      ariaLabel: "Filter result",
      type: "select",
      value: resultFilter,
      options: RESULT_OPTIONS.map((option) => ({
        value: option,
        label: resultLabelMap[option],
      })),
      onValueChange: (value) => updateFilterParam("result", value),
    },
    {
      id: "audit-filter-actor",
      label: t("admin.audit.filter.actor"),
      ariaLabel: "Filter actor",
      type: "input",
      value: actorFilter,
      onValueChange: (value) => updateFilterParam("actor", value),
    },
    {
      id: "audit-filter-path",
      label: t("admin.audit.filter.path"),
      ariaLabel: "Filter path",
      type: "input",
      value: pathFilter,
      onValueChange: (value) => updateFilterParam("path", value),
    },
  ];

  const filteredEvents = useMemo(() => {
    return events.filter((item) => {
      if (actionFilter !== "all" && item.action !== actionFilter) {
        return false;
      }
      if (resultFilter !== "all" && item.result !== resultFilter) {
        return false;
      }
      if (
        actorFilter.trim().length > 0 &&
        !item.actor.toLowerCase().includes(actorFilter.trim().toLowerCase())
      ) {
        return false;
      }
      if (
        pathFilter.trim().length > 0 &&
        !item.path.toLowerCase().includes(pathFilter.trim().toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [actionFilter, actorFilter, events, pathFilter, resultFilter]);

  const selectedEvent = useMemo<AdminAuditEventView | null>(
    () => filteredEvents.find((item) => item.id === selectedEventId) ?? null,
    [filteredEvents, selectedEventId],
  );

  return (
    <PageLayout
      title={t("admin.audit.title")}
      bodyClassName="space-y-[var(--panel-gap)]"
    >
      <Typography as="p" variant="body" className="text-muted-foreground">
        {t("admin.audit.description")}
      </Typography>

      <Card className="space-y-3">
        <Typography as="p" variant="meta" className="text-foreground">
          {t("admin.audit.filters")}
        </Typography>
        <FilterLayer fields={filterFields} className="lg:grid-cols-4 gap-2" />
      </Card>

      <div className="grid grid-cols-1 gap-[var(--panel-gap)] xl:grid-cols-3">
        <Card className="overflow-x-auto xl:col-span-2">
          {logsQuery.isLoading ? (
            <Typography as="p" variant="body" className="text-muted-foreground">
              {t("admin.audit.loading")}
            </Typography>
          ) : logsQuery.isError ? (
            <Typography as="p" variant="body" className="text-danger">
              {t("admin.audit.error")}
            </Typography>
          ) : filteredEvents.length === 0 ? (
            <Typography as="p" variant="body" className="text-muted-foreground">
              {t("admin.audit.empty")}
            </Typography>
          ) : (
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="px-2 py-2">{t("admin.audit.table.time")}</th>
                  <th className="px-2 py-2">{t("admin.audit.table.actor")}</th>
                  <th className="px-2 py-2">{t("admin.audit.table.action")}</th>
                  <th className="px-2 py-2">{t("admin.audit.table.path")}</th>
                  <th className="px-2 py-2">{t("admin.audit.table.result")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.map((item) => (
                  <tr
                    key={item.id}
                    className="cursor-pointer border-b border-border/60 hover:bg-panel-hover"
                    onClick={() => setSelectedEventId(item.id)}
                  >
                    <td className="px-2 py-2">
                      {formatAuditTimestamp(item.timeMs)}
                    </td>
                    <td className="px-2 py-2">{item.actor}</td>
                    <td className="px-2 py-2">{item.action}</td>
                    <td className="px-2 py-2">{item.path}</td>
                    <td className="px-2 py-2">
                      <Badge variant={toResultBadgeVariant(item.result)}>
                        {item.result}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card className="space-y-3">
          <Typography as="p" variant="meta" className="text-foreground">
            {t("admin.audit.details.title")}
          </Typography>
          {!selectedEvent ? (
            <Typography as="p" variant="body" className="text-muted-foreground">
              {t("admin.audit.details.empty")}
            </Typography>
          ) : (
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">
                  {t("admin.audit.details.summary")}:
                </span>{" "}
                {selectedEvent.summary}
              </p>
              <p>
                <span className="text-muted-foreground">
                  {t("admin.audit.details.actor")}:
                </span>{" "}
                {selectedEvent.actor}
              </p>
              <p>
                <span className="text-muted-foreground">
                  {t("admin.audit.details.role")}:
                </span>{" "}
                {selectedEvent.role}
              </p>
              <p>
                <span className="text-muted-foreground">
                  {t("admin.audit.details.action")}:
                </span>{" "}
                {selectedEvent.action}
              </p>
              <p>
                <span className="text-muted-foreground">
                  {t("admin.audit.details.path")}:
                </span>{" "}
                {selectedEvent.path}
              </p>
              <p>
                <span className="text-muted-foreground">
                  {t("admin.audit.details.result")}:
                </span>{" "}
                {selectedEvent.result}
              </p>
              <p>
                <span className="text-muted-foreground">
                  {t("admin.audit.details.timestamp")}:
                </span>{" "}
                {formatAuditTimestamp(selectedEvent.timeMs)}
              </p>
              <div>
                <Typography
                  as="p"
                  variant="caption"
                  className="mb-1 text-muted-foreground"
                >
                  {t("admin.audit.details.metadata")}
                </Typography>
                <pre className="max-h-64 overflow-auto rounded-sm bg-muted p-2 text-xs">
                  {renderMetadata(selectedEvent.metadata)}
                </pre>
              </div>
            </div>
          )}
        </Card>
      </div>
    </PageLayout>
  );
}
