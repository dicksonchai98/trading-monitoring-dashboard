import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ComingSoonPage } from "@/features/common/pages/ComingSoonPage";
import { I18nProvider } from "@/lib/i18n";

describe("ComingSoonPage", () => {
  it("renders the development placeholder content", () => {
    render(
      <I18nProvider>
        <MemoryRouter>
          <ComingSoonPage />
        </MemoryRouter>
      </I18nProvider>,
    );

    expect(screen.getByRole("heading", { name: "Coming Soon" })).toBeInTheDocument();
    expect(screen.getByText("This page is under active development. Please check back later.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to Dashboard" })).toHaveAttribute("href", "/dashboard");
    expect(screen.getByRole("heading", { name: "Coming Soon" }).parentElement?.parentElement).toHaveClass(
      "flex",
      "min-h-screen",
      "items-center",
      "justify-center",
      "bg-background",
    );
  });
});
