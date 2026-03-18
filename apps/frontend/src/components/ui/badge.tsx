import type { JSX, PropsWithChildren } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

const badgeVariants = cva(
  "inline-flex items-center rounded-sm border px-2 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.08em]",
  {
    variants: {
      variant: {
        neutral: "border-border bg-muted text-muted-foreground",
        success: "border-success/30 bg-success/15 text-success",
        warning: "border-warning/30 bg-warning/15 text-warning",
        danger: "border-danger/30 bg-danger/15 text-danger",
        info: "border-info/30 bg-info/15 text-info",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  },
);

interface BadgeProps extends PropsWithChildren, VariantProps<typeof badgeVariants> {
  className?: string;
}

export function Badge({ className, children, variant }: BadgeProps): JSX.Element {
  return <span className={cn(badgeVariants({ variant }), className)}>{children}</span>;
}
