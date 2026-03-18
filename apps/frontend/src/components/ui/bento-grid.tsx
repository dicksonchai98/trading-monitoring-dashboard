import type { JSX, PropsWithChildren } from "react";
import { cn } from "@/lib/utils/cn";

interface BentoGridProps extends PropsWithChildren {
  className?: string;
}

interface BentoGridSectionProps extends PropsWithChildren {
  title?: string;
  className?: string;
  gridClassName?: string;
}

export function BentoGrid({ children, className }: BentoGridProps): JSX.Element {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-[var(--panel-gap)] lg:grid-cols-12",
        className,
      )}
      data-testid="bento-grid"
    >
      {children}
    </div>
  );
}

export function BentoGridSection({
  title,
  children,
  className,
  gridClassName,
}: BentoGridSectionProps): JSX.Element {
  return (
    <section className={cn("space-y-[var(--panel-gap)]", className)}>
      {title ? (
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-foreground">
          {title}
        </p>
      ) : null}
      <BentoGrid className={gridClassName}>{children}</BentoGrid>
    </section>
  );
}
