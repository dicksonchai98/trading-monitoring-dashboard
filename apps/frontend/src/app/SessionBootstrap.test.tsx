import { render, waitFor } from "@testing-library/react";
import { SessionBootstrap } from "@/app/SessionBootstrap";
import { refresh } from "@/features/auth/api/auth";
import { decodeAccessToken, mapTokenRole } from "@/features/auth/lib/token";
import { getBillingStatus } from "@/features/subscription/api/billing";
import { useAuthStore } from "@/lib/store/auth-store";

vi.mock("@/features/auth/api/auth", () => ({
  refresh: vi.fn(),
}));

vi.mock("@/features/auth/lib/token", () => ({
  decodeAccessToken: vi.fn(),
  mapTokenRole: vi.fn(),
}));

vi.mock("@/features/subscription/api/billing", () => ({
  getBillingStatus: vi.fn(),
}));

describe("SessionBootstrap", () => {
  const refreshMock = vi.mocked(refresh);
  const decodeAccessTokenMock = vi.mocked(decodeAccessToken);
  const mapTokenRoleMock = vi.mocked(mapTokenRole);
  const getBillingStatusMock = vi.mocked(getBillingStatus);

  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    refreshMock.mockReset();
    decodeAccessTokenMock.mockReset();
    mapTokenRoleMock.mockReset();
    getBillingStatusMock.mockReset();

    useAuthStore.setState({
      token: null,
      role: "visitor",
      entitlement: "none",
      resolved: false,
      checkoutSessionId: null,
    });

    refreshMock.mockResolvedValue({
      access_token: "token-123",
      token_type: "bearer",
    });
    decodeAccessTokenMock.mockReturnValue({
      role: "member",
    } as never);
    mapTokenRoleMock.mockReturnValue("member");
    getBillingStatusMock.mockResolvedValue({
      status: "none",
      entitlement_active: false,
    } as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("aborts the in-flight billing bootstrap request on unmount", async () => {
    let receivedSignal: AbortSignal | undefined;

    getBillingStatusMock.mockImplementation(async (_token, signal) => {
      receivedSignal = signal;
      return {
        status: "none",
        entitlement_active: false,
      } as never;
    });

    const { unmount } = render(
      <SessionBootstrap>
        <div>bootstrapped child</div>
      </SessionBootstrap>,
    );

    await waitFor(() => expect(getBillingStatusMock).toHaveBeenCalled());

    unmount();

    expect(receivedSignal).toBeInstanceOf(AbortSignal);
    expect(receivedSignal?.aborted).toBe(true);
  });
});
