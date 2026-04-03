import type { JSX } from "react";
import { Toaster as Sonner } from "sonner";

export function Toaster(): JSX.Element {
  return (
    <Sonner
      position="top-right"
      closeButton
      richColors
      toastOptions={{
        className: "font-mono",
      }}
    />
  );
}
