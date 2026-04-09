import type {
  AdminAuditEvent,
  AdminAuditEventView,
  AdminAuditResult,
} from "@/features/admin/api/types";

function resolveAuditResult(eventType: string): AdminAuditResult {
  const normalized = eventType.toLowerCase();
  if (normalized.includes("denied")) {
    return "denied";
  }
  if (normalized.includes("failed") || normalized.includes("error")) {
    return "error";
  }
  if (normalized.includes("triggered")) {
    return "accepted";
  }
  if (normalized.length > 0) {
    return "success";
  }
  return "unknown";
}

function toSummary(event: AdminAuditEvent): string {
  const metadata = event.metadata ?? {};
  const jobId = metadata.job_id;
  if (event.event_type === "admin_access_denied") {
    return `${event.actor ?? "unknown"} denied on ${event.path}`;
  }
  if (event.event_type === "crawler_run_triggered" || event.event_type === "crawler_backfill_triggered") {
    return typeof jobId === "number" || typeof jobId === "string"
      ? `crawler triggered (job_id=${jobId})`
      : "crawler triggered";
  }
  if (event.event_type === "historical_backfill_triggered") {
    const hash = metadata.request_payload_hash;
    if ((typeof jobId === "number" || typeof jobId === "string") && typeof hash === "string") {
      return `backfill triggered (job_id=${jobId}, hash=${hash.slice(0, 8)}...)`;
    }
    return "historical backfill triggered";
  }
  if (event.event_type === "subscription_status_changed") {
    return "subscription status changed";
  }
  return event.event_type;
}

function toEpochMs(timestamp: string): number {
  const ms = Date.parse(timestamp);
  return Number.isFinite(ms) ? ms : 0;
}

function makeId(event: AdminAuditEvent, index: number): string {
  return `${event.event_type}:${event.timestamp}:${event.actor ?? "-"}:${index}`;
}

export function normalizeAdminAuditEvents(events: AdminAuditEvent[]): AdminAuditEventView[] {
  return events
    .map((event, index) => ({
      id: makeId(event, index),
      timeMs: toEpochMs(event.timestamp),
      action: event.event_type,
      actor: event.actor ?? "-",
      role: event.role ?? "-",
      path: event.path,
      result: resolveAuditResult(event.event_type),
      summary: toSummary(event),
      metadata: event.metadata ?? null,
      raw: event,
    }))
    .sort((a, b) => b.timeMs - a.timeMs);
}

export function formatAuditTimestamp(timeMs: number): string {
  if (!Number.isFinite(timeMs) || timeMs <= 0) {
    return "-";
  }
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(timeMs));
}
