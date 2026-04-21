import * as apiClient from "@/lib/api/client";
import { ApiError, getJson, postJson } from "@/lib/api/client";

describe("postJson", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("returns parsed data for successful responses", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ access_token: "token", token_type: "bearer" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(postJson("/auth/login", { username: "alice", password: "secret" })).resolves.toEqual({
      access_token: "token",
      token_type: "bearer",
    });
  });

  it("throws ApiError with backend error code when the request fails", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: "invalid_credentials" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(postJson("/auth/login", { username: "alice", password: "wrong" })).rejects.toMatchObject({
      code: "invalid_credentials",
      status: 401,
    } satisfies Partial<ApiError>);
  });
});

describe("getJson", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("returns parsed data for successful get requests", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ status: "active" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(getJson("/billing/status")).resolves.toEqual({
      status: "active",
    });
  });

  it("forwards the provided abort signal to fetch", async () => {
    const controller = new AbortController();
    const options: Parameters<typeof getJson>[1] & { signal: AbortSignal } = {
      signal: controller.signal,
    };

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ status: "active" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await getJson("/billing/status", options);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: "GET",
        signal: controller.signal,
      }),
    );
  });
});

describe("isAbortError", () => {
  it("returns true for abort-shaped errors", () => {
    const abortError = new DOMException("The operation was aborted.", "AbortError");
    const isAbortError = (apiClient as Record<string, unknown>)["isAbortError"] as
      | ((error: unknown) => boolean)
      | undefined;

    expect(isAbortError?.(abortError)).toBe(true);
  });
});
