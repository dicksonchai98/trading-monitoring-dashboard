import { Link, useLocation } from "react-router-dom";
import { BarChart3, CreditCard, Shield, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { to: "/subscription", label: "Subscription", icon: CreditCard },
  { to: "/admin/audit", label: "Admin Audit", icon: ClipboardList },
  { to: "/forbidden", label: "Access Control", icon: Shield },
];

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps): JSX.Element {
  const location = useLocation();

  return (
    <aside className={cn("rounded-lg border border-border bg-card p-3", className)}>
      <div className="mb-4 rounded-md bg-muted px-3 py-2 text-sm font-semibold">Trading Monitor</div>
      <nav className="space-y-2">
        {nav.map((item) => {
          const active = location.pathname === item.to;
          const Icon = item.icon;

          return (
            <Link
              key={item.to}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors",
                active ? "bg-primary text-primary-foreground" : "hover:bg-muted",
              )}
              to={item.to}
            >
              <Icon className="h-4 w-4" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="mt-6 rounded-md border border-border bg-muted p-2 text-xs text-muted-foreground">
        <p className="font-semibold text-foreground">Member Workspace</p>
        <p>member@desk.io</p>
      </div>
    </aside>
  );
}
