import type { JSX } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function LoginPage(): JSX.Element {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md space-y-4">
        <h1 className="text-xl font-semibold text-foreground">Login</h1>
        <p className="text-sm text-muted-foreground">JWT auth scaffold page (MVP).</p>
        <Button className="w-full">Sign in</Button>
      </Card>
    </div>
  );
}
