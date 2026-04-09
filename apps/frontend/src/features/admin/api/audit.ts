import { getJson, postJson } from "@/lib/api/client";
import type { AdminAuditLogsResponse } from "@/features/admin/api/types";

export function getAdminAuditLogs(token: string): Promise<AdminAuditLogsResponse> {
  return getJson<AdminAuditLogsResponse>("/api/admin/logs", {
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
