import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AdminAuditPage } from "@/features/admin/pages/AdminAuditPage";
import { useAuthStore } from "@/lib/store/auth-store";

describe("AdminAuditPage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    useAuthStore.setState({
      token: "admin-token",
      role: "admin",
      entitlement: "active",
      resolved: true,
      checkoutSessionId: null,
    });
  });

  it("renders audit events from /api/admin/logs and shows event details", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            id: 11,
            event_type: "admin_access_denied",
            path: "/api/admin/batch/jobs",
            actor: "member-01",
            role: "member",
            result: "denied",
            timestamp: "2026-04-09T09:01:00+08:00",
            metadata: null,
          },
          {
            id: 12,
            event_type: "crawler_run_triggered",
            path: "/api/admin/batch/crawler/jobs",
            actor: "admin-01",
            role: "admin",
            result: "accepted",
            timestamp: "2026-04-09T09:02:00+08:00",
            metadata: { job_id: 99 },
          },
        ],
        pagination: { limit: 200, offset: 0, total: 2 },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/admin/audit"]}>
          <AdminAuditPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByText("Filters")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getAllByText("crawler_run_triggered").length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText("admin_access_denied").length).toBeGreaterThan(0);

    const crawlerCell = screen
      .getAllByRole("cell")
      .find((cell) => cell.textContent === "crawler_run_triggered");
    const crawlerRow = crawlerCell?.closest("tr");
    if (crawlerRow) {
      fireEvent.click(crawlerRow);
    }
    await waitFor(() => {
      expect(screen.getByText("crawler triggered (job_id=99)")).toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/admin/logs"),
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ Authorization: "Bearer admin-token" }),
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("applies URL query filters on first render", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        pagination: { limit: 200, offset: 0, total: 2 },
        events: [
          {
            event_type: "admin_access_denied",
            path: "/api/admin/batch/jobs",
            actor: "member-01",
            role: "member",
            timestamp: "2026-04-09T09:01:00+08:00",
            metadata: null,
          },
          {
            event_type: "crawler_run_triggered",
            path: "/api/admin/batch/crawler/jobs",
            actor: "admin-01",
            role: "admin",
            timestamp: "2026-04-09T09:02:00+08:00",
            metadata: { job_id: 99 },
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/admin/audit?result=denied"]}>
          <AdminAuditPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getAllByText("admin_access_denied").length).toBeGreaterThan(0);
    });
    const cellTexts = screen.getAllByRole("cell").map((cell) => cell.textContent ?? "");
    expect(cellTexts).not.toContain("crawler_run_triggered");
  });
});
