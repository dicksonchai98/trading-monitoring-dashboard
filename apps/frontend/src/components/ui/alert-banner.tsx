import type { JSX } from "react";
import { cn } from "@/lib/utils/cn";

type AlertVariant = "error" | "success";

const variantClasses: Record<AlertVariant, string> = {
  error: "border-danger/40 bg-danger/10 text-danger",
  success: "border-primary/40 bg-primary/10 text-primary",
};

interface AlertBannerProps {
  variant: AlertVariant;
  message: string;
}

export function AlertBanner({ variant, message }: AlertBannerProps): JSX.Element {
  return <div className={cn("rounded-sm border px-3 py-2 text-sm", variantClasses[variant])}>{message}</div>;
}
