import type { PropsWithChildren } from "react";
import { cn } from "@/lib/utils/cn";

interface CardProps extends PropsWithChildren {
  className?: string;
}

export function Card({ className, children }: CardProps): JSX.Element {
  return <section className={cn("rounded-lg border border-border bg-card p-3", className)}>{children}</section>;
}
