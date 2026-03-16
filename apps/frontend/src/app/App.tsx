import type { JSX } from "react";
import { AppProviders } from "@/app/providers";
import { AppRouter } from "@/app/router";

export function App(): JSX.Element {
  return (
    <AppProviders>
      <AppRouter />
    </AppProviders>
  );
}
