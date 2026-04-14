import type { JSX, PropsWithChildren, ReactNode } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils/cn";

interface PageLayoutProps extends PropsWithChildren {
  title: string;
  context?: string;
  actions?: ReactNode;
  className?: string;
  bodyClassName?: string;
}

export function PageLayout({
  title,
  context,
  actions,
  className,
  bodyClassName,
  children,
}: PageLayoutProps): JSX.Element {
  return (
    <section
      className={cn("space-y-[var(--section-gap)]", className)}
      data-testid="page-layout"
    >
      <div className={bodyClassName} data-testid="page-layout-body">
        {children}
      </div>
    </section>
  );
}
