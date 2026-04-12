export interface AdminAuditEvent {
  id?: number;
  event_type: string;
  path: string;
  actor: string | null;
  role: string | null;
  result?: AdminAuditResult | null;
  timestamp: string;
  metadata?: Record<string, unknown> | null;
}

export interface AdminAuditLogsResponse {
  items: AdminAuditEvent[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
  };
  events?: AdminAuditEvent[];
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
