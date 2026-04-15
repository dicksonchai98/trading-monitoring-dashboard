import type { CSSProperties, JSX, PropsWithChildren } from "react";
import { Card } from "@/components/ui/card";
import { PanelHeader } from "@/components/ui/panel-header";
import { cn } from "@/lib/utils/cn";

interface PanelCardProps extends PropsWithChildren {
  title: string;
  meta?: string;
  note?: string;
  span?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
  units?: number;
  className?: string;
  contentClassName?: string;
  style?: CSSProperties;
  "data-testid"?: string;
}

const spanClassNames = {
  1: "lg:col-span-1",
  2: "lg:col-span-2",
  3: "lg:col-span-3",
  4: "lg:col-span-4",
  5: "lg:col-span-5",
  6: "lg:col-span-6",
  7: "lg:col-span-7",
  8: "lg:col-span-8",
  9: "lg:col-span-9",
  10: "lg:col-span-10",
  11: "lg:col-span-11",
  12: "lg:col-span-12",
} satisfies Record<NonNullable<PanelCardProps["span"]>, string>;

export function PanelCard({
  title,
  meta,
  note,
  span = 12,
  units = 1,
  className,
  contentClassName,
  style,
  "data-testid": dataTestId = "panel-card",
  children,
}: PanelCardProps): JSX.Element {
  return (
    <Card
      className={cn(
        "flex flex-col justify-start",
        spanClassNames[span],
        className,
      )}
      data-testid={dataTestId}
      style={{ minHeight: `calc(var(--panel-row-h) * ${units})`, ...style }}
    >
      <PanelHeader title={title} meta={meta} note={note} />
      <div className={cn("flex min-h-0 flex-1 flex-col", contentClassName)} data-testid={`${dataTestId}-content`}>
        {children}
      </div>
    </Card>
  );
}
