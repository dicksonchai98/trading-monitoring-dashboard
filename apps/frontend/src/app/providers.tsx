import { QueryClientProvider } from "@tanstack/react-query";
import type { JSX, PropsWithChildren } from "react";
import { DashboardPrefetchBootstrap } from "@/app/DashboardPrefetchBootstrap";
import { RealtimeBootstrap } from "@/app/RealtimeBootstrap";
import { Toaster } from "@/components/ui/sonner";
import { SessionBootstrap } from "@/app/SessionBootstrap";
import { I18nProvider } from "@/lib/i18n";
import { queryClient } from "@/lib/query/client";

export function AppProviders({ children }: PropsWithChildren): JSX.Element {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <SessionBootstrap>
          <DashboardPrefetchBootstrap />
          <RealtimeBootstrap />
          {children}
          <Toaster />
        </SessionBootstrap>
      </I18nProvider>
    </QueryClientProvider>
  );
}
