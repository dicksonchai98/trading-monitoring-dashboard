import { Outlet } from "react-router-dom";
import { Sidebar } from "@/components/ui/sidebar";

export function AppShell(): JSX.Element {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-[1440px] gap-4 px-4 py-4">
        <Sidebar className="h-[calc(100vh-2rem)] w-[15%] min-w-[168px]" />
        <main className="h-[calc(100vh-2rem)] w-[85%] overflow-auto rounded-lg border border-border bg-card p-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
