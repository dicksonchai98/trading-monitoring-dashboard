import type { JSX } from "react";
import { Link } from "react-router-dom";
import { Typography } from "@/components/ui/typography";
import { useT } from "@/lib/i18n";

export function ComingSoonPage(): JSX.Element {
  const t = useT();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="space-y-3 rounded-lg border border-border bg-card p-6 text-center">
        <Typography as="h1" variant="h2">
          {t("common.comingSoon.title")}
        </Typography>
        <Typography as="p" variant="body" className="text-muted-foreground">
          {t("common.comingSoon.description")}
        </Typography>
        <Link className="typo-body font-semibold text-primary" to="/dashboard">
          {t("common.comingSoon.goDashboard")}
        </Link>
      </div>
    </div>
  );
}
