import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SubscriptionPage } from "@/features/subscription/pages/SubscriptionPage";

describe("SubscriptionPage", () => {
  it("uses the shared page layout header and bento grid content layout", () => {
    render(
      <MemoryRouter initialEntries={["/subscription"]}>
        <SubscriptionPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Subscription (Mock)" })).toBeInTheDocument();
    expect(screen.getByText("/subscription")).toBeInTheDocument();
    expect(screen.getByTestId("page-layout")).toBeInTheDocument();
    expect(screen.getByText("PLAN OPTIONS")).toBeInTheDocument();
    expect(screen.getAllByTestId("bento-grid")).toHaveLength(1);
    expect(screen.getByText("Free")).toBeInTheDocument();
    expect(screen.getByText("Pro")).toBeInTheDocument();
  });
});
