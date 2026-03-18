import type { ComponentPropsWithoutRef, JSX } from "react";
import { cn } from "@/lib/utils/cn";

type CardProps = ComponentPropsWithoutRef<"section">;

export function Card({ className, children, ...props }: CardProps): JSX.Element {
  return (
    <section
      {...props}
      className={cn(
        "rounded-md border border-border bg-card p-[var(--panel-padding)] shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] transition-colors hover:bg-panel-hover",
        className,
      )}
    >
      {children}
    </section>
  );
}
