import type { JSX, ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { cn } from "@/lib/utils/cn";

interface PageHeaderProps {
  title: string;
  context?: string;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  context,
  actions,
  className,
}: PageHeaderProps): JSX.Element {
  const { pathname } = useLocation();
  const resolvedContext = context ?? pathname;

  return (
    <header className={cn("flex items-start justify-between gap-4", className)}>
      <div className="space-y-1">
        <h1 className="text-[28px]  tracking-tight text-foreground">{title}</h1>
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
          {resolvedContext}
        </p>
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </header>
  );
}
