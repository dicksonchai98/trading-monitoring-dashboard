import { useState, type JSX, type PropsWithChildren } from "react";
import { AnimatedTooltipDemo } from "@/components/animated-tooltip-demo";
import { cn } from "@/lib/utils/cn";

interface BentoGridProps extends PropsWithChildren {
  className?: string;
}

interface BentoGridSectionProps extends PropsWithChildren {
  title?: string;
  className?: string;
  gridClassName?: string;
  tooltip?: string;
}

export function BentoGrid({
  children,
  className,
}: BentoGridProps): JSX.Element {
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
  tooltip,
  children,
  className,
  gridClassName,
}: BentoGridSectionProps): JSX.Element {
  const [isTitleHovered, setIsTitleHovered] = useState(false);
  const [pointerOffsetX, setPointerOffsetX] = useState(0);

  return (
    <section className={cn("space-y-[var(--panel-gap)]", className)}>
      {title ? (
        <div className="relative w-fit">
          <p
            className="typo-meta text-foreground cursor-pointer"
            onMouseEnter={() => setIsTitleHovered(true)}
            onMouseLeave={() => setIsTitleHovered(false)}
            onMouseMove={(event) => {
              const halfWidth = event.currentTarget.offsetWidth / 2;
              setPointerOffsetX(event.nativeEvent.offsetX - halfWidth);
            }}
            onFocus={() => setIsTitleHovered(true)}
            onBlur={() => setIsTitleHovered(false)}
            tabIndex={0}
          >
            {title}
          </p>
          <AnimatedTooltipDemo
            open={isTitleHovered}
            title={tooltip || title}
            pointerOffsetX={pointerOffsetX}
          />
        </div>
      ) : null}
      <BentoGrid className={gridClassName}>{children}</BentoGrid>
    </section>
  );
}
