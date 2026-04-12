import { useId, useState, type JSX } from "react";
import { CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Typography } from "@/components/ui/typography";

interface PanelHeaderProps {
  title: string;
  meta?: string;
  note?: string;
  className?: string;
}

export function PanelHeader({
  title,
  meta,
  note,
  className,
}: PanelHeaderProps): JSX.Element {
  const [isNoteOpen, setIsNoteOpen] = useState(false);
  const tooltipId = useId();

  return (
    <div className={cn("flex items-start justify-between gap-3 text-left", className)}>
      <div className="space-y-1">
        <Typography as="p" variant="overline" className="normal-case tracking-normal text-foreground">
          {title}
        </Typography>
        {meta ? (
          <Typography as="p" variant="overline" className="text-subtle-foreground">
            {meta}
          </Typography>
        ) : null}
      </div>

      {note ? (
        <div className="relative shrink-0">
          <button
            type="button"
            aria-label={`Show panel notes for ${title}`}
            aria-describedby={isNoteOpen ? tooltipId : undefined}
            className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border-strong"
            onMouseEnter={() => setIsNoteOpen(true)}
            onMouseLeave={() => setIsNoteOpen(false)}
            onFocus={() => setIsNoteOpen(true)}
            onBlur={() => setIsNoteOpen(false)}
          >
            <CircleAlert className="h-3.5 w-3.5" aria-hidden="true" />
          </button>

          {isNoteOpen ? (
            <div
              id={tooltipId}
              role="tooltip"
              className="absolute right-0 top-7 z-10 w-56 rounded-md border border-border bg-card px-3 py-2 text-foreground shadow-lg"
            >
              <Typography as="p" variant="caption" className="font-mono leading-5 text-foreground">
                {note}
              </Typography>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
