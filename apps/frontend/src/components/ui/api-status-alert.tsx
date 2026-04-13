import type { JSX } from "react";
import { cn } from "@/lib/utils";

interface ApiStatusAlertProps {
  message?: string | null;
  status?: number;
  className?: string;
}

function hasTrailingPunctuation(text: string): boolean {
  return /[.!?。！？]$/.test(text.trim());
}

export function ApiStatusAlert({
  message,
  status,
  className,
}: ApiStatusAlertProps): JSX.Element | null {
  if (!message && status === undefined) {
    return null;
  }

  let content = message?.trim();
  if (!content) {
    content = status === undefined ? "Request failed." : `Request failed (HTTP ${status}).`;
  } else if (status !== undefined) {
    if (content.includes("{status}")) {
      content = content.replaceAll("{status}", String(status));
    } else {
      content = `${content} (HTTP ${status})`;
    }
    if (!hasTrailingPunctuation(content)) {
      content = `${content}.`;
    }
  } else if (!hasTrailingPunctuation(content)) {
    content = `${content}.`;
  }

  return (
    <div
      className={cn(
        "rounded-sm border border-[#ef4444]/40 bg-[#ef4444]/10 px-3 py-2 text-sm text-[#ef4444]",
        className,
      )}
      role="alert"
    >
      {content}
    </div>
  );
}
