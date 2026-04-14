import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import {
  Sidebar,
  SidebarContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar"

describe("Sidebar primitives", () => {
  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes("max-width") ? window.innerWidth <= 767 : false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
  })

  it("renders sidebar content inside provider", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <SidebarProvider>
          <Sidebar role="complementary">
            <SidebarContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton>Dashboard</SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarContent>
          </Sidebar>
        </SidebarProvider>
      </MemoryRouter>
    )

    expect(screen.getByRole("complementary")).toBeInTheDocument()
    expect(screen.getByText("Dashboard")).toBeInTheDocument()
  })
})
