import { QueryClientProvider } from "@tanstack/react-query";
import type { JSX, PropsWithChildren } from "react";
import { SessionBootstrap } from "@/app/SessionBootstrap";
import { queryClient } from "@/lib/query/client";

export function AppProviders({ children }: PropsWithChildren): JSX.Element {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionBootstrap>{children}</SessionBootstrap>
    </QueryClientProvider>
  );
}
