import type { PropsWithChildren } from "react";
import { cn } from "@/lib/utils/cn";

interface BadgeProps extends PropsWithChildren {
  className?: string;
}

export function Badge({ className, children }: BadgeProps): JSX.Element {
  return (
    <span className={cn("inline-flex rounded-full bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground", className)}>
      {children}
    </span>
  );
}
