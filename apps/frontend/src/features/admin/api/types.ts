export interface AdminAuditEvent {
  event_type: string;
  path: string;
  actor: string | null;
  role: string | null;
  timestamp: string;
  metadata?: Record<string, unknown> | null;
}

export interface AdminAuditLogsResponse {
  events: AdminAuditEvent[];
}

export type AdminAuditResult = "success" | "denied" | "error" | "accepted" | "unknown";

export interface AdminAuditEventView {
  id: string;
  timeMs: number;
  action: string;
  actor: string;
  role: string;
  path: string;
  result: AdminAuditResult;
  summary: string;
  metadata: Record<string, unknown> | null;
  raw: AdminAuditEvent;
}
