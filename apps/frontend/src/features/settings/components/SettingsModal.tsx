import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  AppWindowIcon,
  BellIcon,
  CircleUserRoundIcon,
  Clock3Icon,
  ContrastIcon,
  DatabaseIcon,
  LanguagesIcon,
  MonitorIcon,
  PaletteIcon,
  Settings2Icon,
  ShieldIcon,
  UserRoundCheckIcon,
  UserRoundCogIcon,
  XIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { type LanguagePreset, useI18n } from "@/lib/i18n";
import { useAuthStore } from "@/lib/store/auth-store";
import { cn } from "@/lib/utils";

export type SettingsSection =
  | "general"
  | "notifications"
  | "personalization"
  | "apps"
  | "schedule"
  | "data"
  | "security"
  | "parental"
  | "account";

export function SettingsModal({
  open,
  onOpenChange,
  initialSection = "general",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialSection?: SettingsSection;
}): JSX.Element {
  const { role } = useAuthStore();
  const { locale, setLocale, t } = useI18n();
  const [activeSection, setActiveSection] =
    useState<SettingsSection>(initialSection);
  const [languagePreset, setLanguagePreset] = useState<LanguagePreset>(locale);

  useEffect(() => {
    setLanguagePreset(locale);
  }, [locale]);

  useEffect(() => {
    if (!open) return;
    setActiveSection(initialSection);
  }, [initialSection, open]);

  function updateLanguagePreset(nextLanguage: LanguagePreset): void {
    setLanguagePreset(nextLanguage);
    setLocale(nextLanguage);
  }

  const sections = useMemo(
    () => [
      {
        id: "general" as const,
        label: t("modal.general"),
        icon: Settings2Icon,
      },
      {
        id: "notifications" as const,
        label: t("modal.notifications"),
        icon: BellIcon,
      },
      {
        id: "personalization" as const,
        label: t("modal.personalization"),
        icon: PaletteIcon,
      },
      { id: "apps" as const, label: t("modal.apps"), icon: AppWindowIcon },
      { id: "schedule" as const, label: t("modal.schedule"), icon: Clock3Icon },
      { id: "data" as const, label: t("modal.data"), icon: DatabaseIcon },
      { id: "security" as const, label: t("modal.security"), icon: ShieldIcon },
      {
        id: "parental" as const,
        label: t("modal.parental"),
        icon: UserRoundCogIcon,
      },
      {
        id: "account" as const,
        label: t("modal.account"),
        icon: CircleUserRoundIcon,
      },
    ],
    [t],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="bg-black/20 backdrop-blur-[4px] [-webkit-backdrop-filter:blur(12px)]"
        className="h-[88vh] min-h-0 max-h-[calc(100svh-1rem)] w-[calc(100vw-1rem)] max-w-[800px] gap-0 overflow-hidden p-0 sm:w-[92vw] sm:max-h-[760px] sm:max-w-[800px]"
      >
        <DialogHeader className="absolute sr-only">
          <DialogTitle>{t("modal.title")}</DialogTitle>
          <DialogDescription>{t("modal.desc")}</DialogDescription>
        </DialogHeader>

        <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] bg-background md:grid-cols-[13rem_minmax(0,1fr)] md:grid-rows-1">
          <aside className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-2 border-b border-border bg-muted/30 p-3 md:grid-cols-1 md:grid-rows-[auto_minmax(0,1fr)] md:items-start md:content-start md:border-r md:border-b-0">
            <button
              type="button"
              aria-label={t("modal.close")}
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground md:mb-2"
              onClick={() => onOpenChange(false)}
            >
              <XIcon className="size-4" />
            </button>
            <nav className="min-w-0 overflow-x-auto overflow-y-hidden pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden md:overflow-visible md:pb-0">
              <div className="flex w-max min-w-full gap-1 md:w-full md:min-w-0 md:flex-col">
               {sections.map((item) => (
                 <button
                   key={item.id}
                  type="button"
                  onClick={() => setActiveSection(item.id)}
                  className={cn(
                    "flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:w-full",
                    activeSection === item.id && "bg-muted text-foreground",
                  )}
                >
                  <item.icon className="size-4" />
                  <span className="whitespace-nowrap">{item.label}</span>
                </button>
              ))}
              </div>
            </nav>
          </aside>

          <section className="flex min-h-0 min-w-0 flex-col overflow-hidden p-3 sm:p-4">
            <div className="border-b border-border pb-3 sm:pb-4">
              <h2 className="break-words text-xl font-semibold text-foreground sm:text-2xl">
                {sections.find((item) => item.id === activeSection)?.label}
              </h2>
            </div>

            <div className="mt-3 flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto sm:mt-4 sm:pr-1">
              {activeSection === "general" ? (
                <div className="flex min-w-0 flex-col gap-4">
                  <h3 className="text-base font-semibold text-foreground">
                    {t("modal.general")}
                  </h3>
                  <div className="rounded-xl border border-border bg-muted/40 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                        <div className="rounded-full bg-background p-2 text-foreground">
                          <ShieldIcon className="size-4" />
                        </div>
                        <div className="min-w-0 flex flex-col gap-1">
                          <h3 className="text-base font-semibold text-foreground">
                            {t("modal.protectTitle")}
                          </h3>
                          <p className="break-words text-sm text-muted-foreground">
                            {t("modal.protectDesc")}
                          </p>
                          <div>
                            <Button variant="outline" size="sm">
                              {t("modal.setupMfa")}
                            </Button>
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        aria-label={t("modal.closeProtection")}
                        className="inline-flex size-8 self-end items-center justify-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground sm:self-auto"
                      >
                        <XIcon className="size-4" />
                      </button>
                    </div>
                  </div>

                  <div className="divide-y divide-border rounded-xl border border-border">
                    <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-center gap-2 text-sm text-foreground">
                        <MonitorIcon className="size-4 text-muted-foreground" />
                        <span className="break-words">{t("modal.appearance")}</span>
                      </div>
                      <span className="break-words text-sm text-muted-foreground sm:text-right">
                        {t("modal.system")}
                      </span>
                    </div>
                    <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-center gap-2 text-sm text-foreground">
                        <ContrastIcon className="size-4 text-muted-foreground" />
                        <span className="break-words">{t("modal.contrast")}</span>
                      </div>
                      <span className="break-words text-sm text-muted-foreground sm:text-right">
                        {t("modal.system")}
                      </span>
                    </div>
                    <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-center gap-2 text-sm text-foreground">
                        <PaletteIcon className="size-4 text-muted-foreground" />
                        <span className="break-words">{t("modal.accentColor")}</span>
                      </div>
                      <span className="inline-flex items-center gap-2 break-words text-sm text-muted-foreground sm:justify-end">
                        <span className="size-2 rounded-full bg-muted-foreground" />
                        {t("modal.default")}
                      </span>
                    </div>
                    <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-center gap-2 text-sm text-foreground">
                        <LanguagesIcon className="size-4 text-muted-foreground" />
                        <span className="break-words">{t("settings.language")}</span>
                      </div>
                      <select
                        className="h-8 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none sm:w-auto"
                        value={languagePreset}
                        onChange={(event) =>
                          updateLanguagePreset(
                            event.target.value as LanguagePreset,
                          )
                        }
                      >
                        <option value="en">{t("settings.langEnglish")}</option>
                        <option value="zh-TW">
                          {t("settings.langTraditionalChinese")}
                        </option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-center gap-2 text-sm text-foreground">
                        <UserRoundCheckIcon className="size-4 text-muted-foreground" />
                        <span className="break-words">{t("modal.spokenLanguage")}</span>
                      </div>
                      <span className="break-words text-sm text-muted-foreground sm:text-right">
                        {t("modal.autoDetect")}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    {t("modal.languageHint")}
                  </p>
                </div>
              ) : null}

              {activeSection === "notifications" ? (
                <div className="mt-6 flex flex-col gap-3">
                  <h3 className="text-base font-semibold text-foreground">
                    {t("modal.notifications")}
                  </h3>
                  <div className="rounded-xl border border-border bg-muted/40 p-4">
                    <p className="text-sm font-medium text-foreground">
                      {t("modal.notificationPrefs")}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t("modal.notificationDesc")}
                    </p>
                  </div>
                </div>
              ) : null}

              {activeSection === "personalization" ? (
                <div className="mt-6 flex flex-col gap-3">
                  <h3 className="text-base font-semibold text-foreground">
                    {t("modal.personalization")}
                  </h3>
                  <div className="rounded-xl border border-border bg-muted/40 p-4">
                    <p className="text-sm font-medium text-foreground">
                      {t("modal.inDevelopment")}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t("modal.rolloutDesc")}
                    </p>
                  </div>
                </div>
              ) : null}

              {activeSection === "apps" ? (
                <div className="mt-6 flex flex-col gap-3">
                  <h3 className="text-base font-semibold text-foreground">
                    {t("modal.apps")}
                  </h3>
                  <div className="rounded-xl border border-border bg-muted/40 p-4">
                    <p className="text-sm font-medium text-foreground">
                      {t("modal.inDevelopment")}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t("modal.rolloutDesc")}
                    </p>
                  </div>
                </div>
              ) : null}

              {activeSection === "schedule" ? (
                <div className="mt-6 flex flex-col gap-3">
                  <h3 className="text-base font-semibold text-foreground">
                    {t("modal.schedule")}
                  </h3>
                  <div className="rounded-xl border border-border bg-muted/40 p-4">
                    <p className="text-sm font-medium text-foreground">
                      {t("modal.inDevelopment")}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t("modal.rolloutDesc")}
                    </p>
                  </div>
                </div>
              ) : null}

              {activeSection === "data" ? (
                <div className="mt-6 flex flex-col gap-3">
                  <h3 className="text-base font-semibold text-foreground">
                    {t("modal.data")}
                  </h3>
                  <div className="rounded-xl border border-border bg-muted/40 p-4">
                    <p className="text-sm font-medium text-foreground">
                      {t("modal.inDevelopment")}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t("modal.rolloutDesc")}
                    </p>
                  </div>
                </div>
              ) : null}

              {activeSection === "security" ? (
                <div className="mt-6 flex flex-col gap-3">
                  <h3 className="text-base font-semibold text-foreground">
                    {t("modal.security")}
                  </h3>
                  <div className="rounded-xl border border-border bg-muted/40 p-4">
                    <p className="text-sm font-medium text-foreground">
                      {t("modal.inDevelopment")}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t("modal.rolloutDesc")}
                    </p>
                  </div>
                </div>
              ) : null}

              {activeSection === "parental" ? (
                <div className="mt-6 flex flex-col gap-3">
                  <h3 className="text-base font-semibold text-foreground">
                    {t("modal.parental")}
                  </h3>
                  <div className="rounded-xl border border-border bg-muted/40 p-4">
                    <p className="text-sm font-medium text-foreground">
                      {t("modal.inDevelopment")}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t("modal.rolloutDesc")}
                    </p>
                  </div>
                </div>
              ) : null}

              {activeSection === "account" ? (
                <div className="mt-6 mb-2 flex flex-col gap-3">
                  <h3 className="text-base font-semibold text-foreground">
                    {t("modal.account")}
                  </h3>
                  <div className="rounded-xl border border-border bg-muted/40 p-4">
                    <p className="text-sm text-muted-foreground">
                      {t("modal.currentRole")}
                    </p>
                    <p className="mt-1 text-base font-medium text-foreground">
                      {role}
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t("modal.accountSync")}
                  </p>
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
