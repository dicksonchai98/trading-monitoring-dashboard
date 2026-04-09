import { getJson, postJson } from "@/lib/api/client";
import type { AdminAuditLogsResponse } from "@/features/admin/api/types";

export interface AdminAuditLogsQuery {
  action?: string;
  result?: string;
  actor?: string;
  path?: string;
  limit?: number;
  offset?: number;
}

export function getAdminAuditLogs(
  token: string,
  query: AdminAuditLogsQuery = {},
): Promise<AdminAuditLogsResponse> {
  const params = new URLSearchParams();
  if (query.action && query.action !== "all") {
    params.set("event_type", query.action);
  }
  if (query.result && query.result !== "all") {
    params.set("result", query.result);
  }
  if (query.actor && query.actor.trim().length > 0) {
    params.set("actor", query.actor.trim());
  }
  if (query.path && query.path.trim().length > 0) {
    params.set("path", query.path.trim());
  }
  if (typeof query.limit === "number") {
    params.set("limit", String(query.limit));
  }
  if (typeof query.offset === "number") {
    params.set("offset", String(query.offset));
  }
  const queryString = params.toString();
  const url = queryString.length > 0 ? `/api/admin/logs?${queryString}` : "/api/admin/logs";

  return getJson<AdminAuditLogsResponse>(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function seedAdminAuditLogs(
  token: string,
  payload: { count: number; clear_before: boolean },
): Promise<{ seeded: number; total: number }> {
  return postJson<{ seeded: number; total: number }, { count: number; clear_before: boolean }>(
    "/api/admin/logs/seed",
    payload,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );
}
