import type { JSX } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface MultiSelectOption {
  label: string;
  value: string;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  value: string[];
  onValueChange: (value: string[]) => void;
  placeholder?: string;
  className?: string;
  maxCount?: number;
  dataTestId?: string;
}

export function MultiSelect({
  options,
  value,
  onValueChange,
  placeholder = "Select...",
  className,
  maxCount = 2,
  dataTestId,
}: MultiSelectProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent): void {
      if (!containerRef.current) {
        return;
      }
      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    if (open) {
      window.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      window.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  const selectedOptions = useMemo(
    () => options.filter((option) => value.includes(option.value)),
    [options, value],
  );

  function toggleOption(optionValue: string): void {
    if (value.includes(optionValue)) {
      onValueChange(value.filter((selected) => selected !== optionValue));
      return;
    }
    onValueChange([...value, optionValue]);
  }

  return (
    <div className={cn("relative", className)} data-testid={dataTestId} ref={containerRef}>
      <button
        aria-expanded={open}
        className="flex h-9 w-full items-center justify-between rounded-sm border border-border bg-card px-3 text-left text-sm text-foreground outline-none transition-colors hover:border-border-strong"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span className="truncate">
          {selectedOptions.length === 0
            ? placeholder
            : selectedOptions.length > maxCount
              ? `${selectedOptions.length} selected`
              : selectedOptions.map((option) => option.label).join(", ")}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>

      {open ? (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-sm border border-border bg-card p-1 shadow-lg">
          <div className="space-y-1">
            {options.map((option) => {
              const selected = value.includes(option.value);
              return (
                <button
                  className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-muted"
                  key={option.value}
                  onClick={() => toggleOption(option.value)}
                  type="button"
                >
                  <span>{option.label}</span>
                  {selected ? <Check className="h-4 w-4 text-primary" /> : null}
                </button>
              );
            })}
          </div>

          <div className="mt-1 border-t border-border pt-1">
            <button
              className="inline-flex w-full items-center justify-center gap-1 rounded-sm px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              onClick={() => onValueChange([])}
              type="button"
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
