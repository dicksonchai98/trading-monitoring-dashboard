import { ApiError } from "@/lib/api/client";
import { getAnalyticsEvents, getAnalyticsMetrics } from "@/features/analytics/api/analytics";

describe("analytics api parsing and normalization", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("throws analytics_invalid_response when payload mismatches schema", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ wrong: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(getAnalyticsEvents("token")).rejects.toMatchObject({
      code: "analytics_invalid_response",
      status: 500,
    } satisfies Partial<ApiError>);
  });

  it("preserves backend status errors as ApiError", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: "forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(getAnalyticsEvents("token")).rejects.toMatchObject({
      code: "forbidden",
      status: 403,
    } satisfies Partial<ApiError>);
  });

  it("accepts events registry payload with items key", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ items: [{ id: "event_a", label: "Event A" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(getAnalyticsEvents("token")).resolves.toEqual({
      events: [{ id: "event_a", label: "Event A" }],
    });
  });

  it("accepts metrics registry payload with items key", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ items: [{ id: "metric_a", label: "Metric A" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(getAnalyticsMetrics("token")).resolves.toEqual({
      metrics: [{ id: "metric_a", label: "Metric A" }],
    });
  });

  it("normalizes events registry items that use event_id", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ items: [{ event_id: "event_a", label: "Event A" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(getAnalyticsEvents("token")).resolves.toEqual({
      events: [{ id: "event_a", label: "Event A" }],
    });
  });

  it("normalizes metrics registry items that use metric_id", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ items: [{ metric_id: "metric_a", label: "Metric A" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(getAnalyticsMetrics("token")).resolves.toEqual({
      metrics: [{ id: "metric_a", label: "Metric A" }],
    });
  });

});
