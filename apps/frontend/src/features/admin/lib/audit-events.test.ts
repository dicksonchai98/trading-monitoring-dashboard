import { normalizeAdminAuditEvents } from "@/features/admin/lib/audit-events";

describe("audit-events", () => {
  it("normalizes and sorts events by timestamp desc", () => {
    const events = normalizeAdminAuditEvents([
      {
        event_type: "admin_access_denied",
        path: "/api/admin/logs",
        actor: "member",
        role: "member",
        timestamp: "2026-04-09T09:00:00+08:00",
        metadata: null,
      },
      {
        event_type: "crawler_run_triggered",
        path: "/api/admin/batch/crawler/jobs",
        actor: "admin",
        role: "admin",
        timestamp: "2026-04-09T09:01:00+08:00",
        metadata: { job_id: 11 },
      },
    ]);

    expect(events).toHaveLength(2);
    expect(events[0].action).toBe("crawler_run_triggered");
    expect(events[0].result).toBe("accepted");
    expect(events[1].result).toBe("denied");
  });
});
