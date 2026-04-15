import type { ComponentProps, JSX, ReactNode } from "react";
import { LoaderCircleIcon } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type FilterSelectOption = {
  label: string;
  value: string;
  disabled?: boolean;
};

type BaseFilterField = {
  id: string;
  label: string;
  className?: string;
  ariaLabel?: string;
};

type SelectFilterField = BaseFilterField & {
  type: "select";
  value: string;
  placeholder?: string;
  loading?: boolean;
  options: FilterSelectOption[];
  onValueChange: (value: string) => void;
  triggerTestId?: string;
};

type InputFilterField = BaseFilterField & {
  type: "input" | "date";
  value: string;
  onValueChange: (value: string) => void;
  inputTestId?: string;
  inputProps?: Omit<
    ComponentProps<"input">,
    "id" | "type" | "value" | "onChange" | "className" | "aria-label"
  >;
};

type CustomFilterField = {
  type: "custom";
  key: string;
  className?: string;
  render: () => ReactNode;
};

export type FilterField =
  | SelectFilterField
  | InputFilterField
  | CustomFilterField;

type FilterLayerProps = {
  fields: FilterField[];
  className?: string;
  actions?: ReactNode;
  actionsClassName?: string;
};

function FilterSelectField({
  id,
  value,
  ariaLabel,
  placeholder,
  loading = false,
  options,
  onValueChange,
  triggerTestId,
}: SelectFilterField): JSX.Element {
  return (
    <Select value={value} onValueChange={onValueChange} disabled={loading}>
      <SelectTrigger
        id={id}
        aria-label={ariaLabel}
        data-testid={triggerTestId}
        className="h-9 w-full rounded-sm border border-border bg-card px-3 text-sm text-foreground"
      >
        {loading ? (
          <LoaderCircleIcon
            className="size-4 animate-spin text-muted-foreground"
            data-testid={triggerTestId ? `${triggerTestId}-loading` : undefined}
          />
        ) : (
          <SelectValue placeholder={placeholder} />
        )}
      </SelectTrigger>
      <SelectContent className="rounded-sm border-border bg-card">
        <SelectGroup>
          {options.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

function FilterInputField({
  id,
  type,
  value,
  ariaLabel,
  onValueChange,
  inputTestId,
  inputProps,
}: InputFilterField): JSX.Element {
  return (
    <input
      {...inputProps}
      id={id}
      aria-label={ariaLabel}
      data-testid={inputTestId}
      type={type === "date" ? "date" : "text"}
      value={value}
      onChange={(event) => onValueChange(event.target.value)}
      className="h-9 rounded-sm border border-border bg-card px-3 text-sm text-foreground"
    />
  );
}

export function FilterLayer({
  fields,
  className,
  actions,
  actionsClassName,
}: FilterLayerProps): JSX.Element {
  return (
    <div className={cn("grid grid-cols-1 gap-3 md:grid-cols-5", className)}>
      {fields.map((field) => {
        if (field.type === "custom") {
          return (
            <div key={field.key} className={field.className}>
              {field.render()}
            </div>
          );
        }

        return (
          <label
            key={field.id}
            htmlFor={field.id}
            className={cn("flex flex-col gap-1", field.className)}
          >
            <span className="typo-overline text-muted-foreground">
              {field.label}
            </span>

            {field.type === "select" ? (
              <FilterSelectField {...field} />
            ) : (
              <FilterInputField {...field} />
            )}
          </label>
        );
      })}

      {actions ? (
        <div
          className={cn(
            "flex items-center justify-start gap-2",
            actionsClassName,
          )}
        >
          {actions}
        </div>
      ) : null}
    </div>
  );
}
