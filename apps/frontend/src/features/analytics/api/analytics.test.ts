import { ApiError } from "@/lib/api/client";
import { getAnalyticsEvents } from "@/features/analytics/api/analytics";

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
});
