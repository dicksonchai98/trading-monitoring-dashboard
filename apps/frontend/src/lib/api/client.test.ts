import { ApiError, postJson } from "@/lib/api/client";

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
