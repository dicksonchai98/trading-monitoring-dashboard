import type { JSX, ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { cn } from "@/lib/utils/cn";
import { Typography } from "@/components/ui/typography";

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
        <Typography as="h1" variant="h1" className="text-foreground">
          {title}
        </Typography>
        <Typography as="p" variant="meta" className="text-muted-foreground">
          {resolvedContext}
        </Typography>
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </header>
  );
}
