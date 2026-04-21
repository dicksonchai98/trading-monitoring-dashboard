import { getJson, postJson } from "@/lib/api/client";
import {
  createPortalSession,
  getBillingPlans,
  getBillingStatus,
  getCheckoutSessionStatus,
  startCheckout,
} from "@/features/subscription/api/billing";

vi.mock("@/lib/api/client", () => ({
  getJson: vi.fn(),
  postJson: vi.fn(),
}));

describe("billing api helpers", () => {
  const getJsonMock = vi.mocked(getJson);
  const postJsonMock = vi.mocked(postJson);

  beforeEach(() => {
    getJsonMock.mockReset();
    postJsonMock.mockReset();
    getJsonMock.mockResolvedValue({} as never);
    postJsonMock.mockResolvedValue({} as never);
  });

  it("forwards abort signals for read requests", async () => {
    const signal = new AbortController().signal;

    await (getBillingPlans as unknown as (signal?: AbortSignal) => Promise<unknown>)(signal);
    await (
      getBillingStatus as unknown as (token: string, signal?: AbortSignal) => Promise<unknown>
    )("token-123", signal);
    await (
      getCheckoutSessionStatus as unknown as (
        token: string,
        sessionId: string,
        signal?: AbortSignal,
      ) => Promise<unknown>
    )("token-123", "session/123", signal);

    expect(getJsonMock).toHaveBeenNthCalledWith(1, "/billing/plans", {
      signal,
    });
    expect(getJsonMock).toHaveBeenNthCalledWith(2, "/billing/status", {
      headers: {
        Authorization: "Bearer token-123",
      },
      signal,
    });
    expect(getJsonMock).toHaveBeenNthCalledWith(
      3,
      "/billing/checkout-session/session%2F123",
      {
        headers: {
          Authorization: "Bearer token-123",
        },
        signal,
      },
    );
  });

  it("forwards abort signals for portal and checkout actions", async () => {
    const signal = new AbortController().signal;

    await (startCheckout as unknown as (token: string, signal?: AbortSignal) => Promise<unknown>)(
      "token-123",
      signal,
    );
    await (
      createPortalSession as unknown as (token: string, signal?: AbortSignal) => Promise<unknown>
    )("token-123", signal);

    expect(postJsonMock).toHaveBeenNthCalledWith(
      1,
      "/billing/checkout",
      {},
      {
        headers: {
          Authorization: "Bearer token-123",
        },
        signal,
      },
    );
    expect(postJsonMock).toHaveBeenNthCalledWith(
      2,
      "/billing/portal-session",
      {},
      {
        headers: {
          Authorization: "Bearer token-123",
        },
        signal,
      },
    );
  });
});
