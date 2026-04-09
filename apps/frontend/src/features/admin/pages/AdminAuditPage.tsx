import { useMemo, useState, type JSX } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getAdminAuditLogs } from "@/features/admin/api/audit";
import type { AdminAuditEventView, AdminAuditResult } from "@/features/admin/api/types";
import {
  formatAuditTimestamp,
  normalizeAdminAuditEvents,
} from "@/features/admin/lib/audit-events";
import { useAuthStore } from "@/lib/store/auth-store";
import { PageLayout } from "@/components/ui/page-layout";

const RESULT_OPTIONS: Array<{ value: "all" | AdminAuditResult; label: string }> = [
  { value: "all", label: "All Results" },
  { value: "success", label: "Success" },
  { value: "accepted", label: "Accepted" },
  { value: "denied", label: "Denied" },
  { value: "error", label: "Error" },
  { value: "unknown", label: "Unknown" },
];

const RESULT_VALUES = new Set(RESULT_OPTIONS.map((option) => option.value));

function toResultBadgeVariant(result: AdminAuditResult): "success" | "warning" | "danger" | "neutral" {
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
  const token = useAuthStore((state) => state.token);
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const actionFilter = searchParams.get("action") ?? "all";
  const rawResultFilter = searchParams.get("result") ?? "all";
  const resultFilter: "all" | AdminAuditResult = RESULT_VALUES.has(rawResultFilter as "all" | AdminAuditResult)
    ? (rawResultFilter as "all" | AdminAuditResult)
    : "all";
  const actorFilter = searchParams.get("actor") ?? "";
  const pathFilter = searchParams.get("path") ?? "";

  const updateFilterParam = (key: "action" | "result" | "actor" | "path", value: string): void => {
    const next = new URLSearchParams(searchParams);
    if (!value || value === "all") {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    setSearchParams(next, { replace: true });
  };

  const logsQuery = useQuery({
    queryKey: ["admin", "audit", token, actionFilter, resultFilter, actorFilter, pathFilter],
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
    () => normalizeAdminAuditEvents(logsQuery.data?.items ?? logsQuery.data?.events ?? []),
    [logsQuery.data?.events, logsQuery.data?.items],
  );
  const actionOptions = useMemo(() => {
    const set = new Set(events.map((item) => item.action));
    return ["all", ...Array.from(set).sort()];
  }, [events]);

  const filteredEvents = useMemo(() => {
    return events.filter((item) => {
      if (actionFilter !== "all" && item.action !== actionFilter) {
        return false;
      }
      if (resultFilter !== "all" && item.result !== resultFilter) {
        return false;
      }
      if (actorFilter.trim().length > 0 && !item.actor.toLowerCase().includes(actorFilter.trim().toLowerCase())) {
        return false;
      }
      if (pathFilter.trim().length > 0 && !item.path.toLowerCase().includes(pathFilter.trim().toLowerCase())) {
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
    <PageLayout title="Admin Audit Log" bodyClassName="space-y-[var(--panel-gap)]">
      <p className="text-sm text-muted-foreground">
        Security and admin operation events with actor, action, path, result, and metadata.
      </p>

      <Card className="space-y-3">
        <p className="text-xs font-semibold text-foreground">Filters</p>
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-4">
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">Action</span>
            <select
              aria-label="Filter action"
              className="w-full rounded-sm border border-border bg-background px-2 py-1 text-sm text-foreground"
              value={actionFilter}
              onChange={(event) => updateFilterParam("action", event.target.value)}
            >
              {actionOptions.map((action) => (
                <option key={action} value={action}>
                  {action}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">Result</span>
            <select
              aria-label="Filter result"
              className="w-full rounded-sm border border-border bg-background px-2 py-1 text-sm text-foreground"
              value={resultFilter}
              onChange={(event) => updateFilterParam("result", event.target.value)}
            >
              {RESULT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">Actor</span>
            <input
              aria-label="Filter actor"
              className="w-full rounded-sm border border-border bg-background px-2 py-1 text-sm text-foreground"
              value={actorFilter}
              onChange={(event) => updateFilterParam("actor", event.target.value)}
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">Path</span>
            <input
              aria-label="Filter path"
              className="w-full rounded-sm border border-border bg-background px-2 py-1 text-sm text-foreground"
              value={pathFilter}
              onChange={(event) => updateFilterParam("path", event.target.value)}
            />
          </label>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-[var(--panel-gap)] xl:grid-cols-3">
        <Card className="overflow-x-auto xl:col-span-2">
          {logsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading audit events...</p>
          ) : logsQuery.isError ? (
            <p className="text-sm text-danger">Failed to load audit events.</p>
          ) : filteredEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No audit events match current filters.</p>
          ) : (
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="px-2 py-2">Time</th>
                  <th className="px-2 py-2">Actor</th>
                  <th className="px-2 py-2">Action</th>
                  <th className="px-2 py-2">Path</th>
                  <th className="px-2 py-2">Result</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.map((item) => (
                  <tr
                    key={item.id}
                    className="cursor-pointer border-b border-border/60 hover:bg-panel-hover"
                    onClick={() => setSelectedEventId(item.id)}
                  >
                    <td className="px-2 py-2">{formatAuditTimestamp(item.timeMs)}</td>
                    <td className="px-2 py-2">{item.actor}</td>
                    <td className="px-2 py-2">{item.action}</td>
                    <td className="px-2 py-2">{item.path}</td>
                    <td className="px-2 py-2">
                      <Badge variant={toResultBadgeVariant(item.result)}>{item.result}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card className="space-y-3">
          <p className="text-xs font-semibold text-foreground">Event Details</p>
          {!selectedEvent ? (
            <p className="text-sm text-muted-foreground">Select a row to inspect details.</p>
          ) : (
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">Summary:</span> {selectedEvent.summary}
              </p>
              <p>
                <span className="text-muted-foreground">Actor:</span> {selectedEvent.actor}
              </p>
              <p>
                <span className="text-muted-foreground">Role:</span> {selectedEvent.role}
              </p>
              <p>
                <span className="text-muted-foreground">Action:</span> {selectedEvent.action}
              </p>
              <p>
                <span className="text-muted-foreground">Path:</span> {selectedEvent.path}
              </p>
              <p>
                <span className="text-muted-foreground">Result:</span> {selectedEvent.result}
              </p>
              <p>
                <span className="text-muted-foreground">Timestamp:</span>{" "}
                {formatAuditTimestamp(selectedEvent.timeMs)}
              </p>
              <div>
                <p className="mb-1 text-muted-foreground">Metadata</p>
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
