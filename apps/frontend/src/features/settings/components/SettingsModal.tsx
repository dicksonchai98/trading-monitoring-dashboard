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
import { useAuthStore } from "@/lib/store/auth-store";
import { cn } from "@/lib/utils";

type LanguagePreset = "en" | "zh-TW";

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

const LANGUAGE_STORAGE_KEY = "ui.language.preset";

function applyLanguagePreset(value: LanguagePreset): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("lang", value);
  document.documentElement.setAttribute("data-language", value);
}

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
  const [activeSection, setActiveSection] =
    useState<SettingsSection>(initialSection);
  const [languagePreset, setLanguagePreset] = useState<LanguagePreset>("en");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    const nextLanguage: LanguagePreset =
      savedLanguage === "zh-TW" ? "zh-TW" : "en";
    setLanguagePreset(nextLanguage);
    applyLanguagePreset(nextLanguage);
  }, []);

  useEffect(() => {
    if (!open) return;
    setActiveSection(initialSection);
  }, [initialSection, open]);

  function updateLanguagePreset(nextLanguage: LanguagePreset): void {
    setLanguagePreset(nextLanguage);
    applyLanguagePreset(nextLanguage);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
    }
  }

  const sections = useMemo(
    () => [
      { id: "general" as const, label: "常规", icon: Settings2Icon },
      { id: "notifications" as const, label: "通知", icon: BellIcon },
      { id: "personalization" as const, label: "个性化", icon: PaletteIcon },
      { id: "apps" as const, label: "应用", icon: AppWindowIcon },
      { id: "schedule" as const, label: "安排", icon: Clock3Icon },
      { id: "data" as const, label: "数据管理", icon: DatabaseIcon },
      { id: "security" as const, label: "安全", icon: ShieldIcon },
      { id: "parental" as const, label: "家长控制", icon: UserRoundCogIcon },
      { id: "account" as const, label: "账户", icon: CircleUserRoundIcon },
    ],
    [],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="bg-black/20 backdrop-blur-[4px] [-webkit-backdrop-filter:blur(12px)]"
        className="h-[88vh] max-h-[760px] w-[92vw] max-w-[800px] overflow-hidden p-0 sm:max-w-[800px]"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>设置</DialogTitle>
          <DialogDescription>应用设置与账户偏好配置。</DialogDescription>
        </DialogHeader>

        <div className="flex h-full min-h-0 bg-background">
          <aside className="flex w-52 shrink-0 flex-col border-r border-border bg-muted/30 p-3">
            <button
              type="button"
              aria-label="关闭设置"
              className="mb-2 inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={() => onOpenChange(false)}
            >
              <XIcon className="size-4" />
            </button>
            <nav className="flex flex-col gap-1">
              {sections.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveSection(item.id)}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                    activeSection === item.id && "bg-muted text-foreground",
                  )}
                >
                  <item.icon className="size-4" />
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>
          </aside>

          <section className="flex min-w-0 flex-1 flex-col overflow-hidden p-4">
            <div className="border-b border-border pb-4">
              <h2 className="text-2xl font-semibold text-foreground">
                {sections.find((item) => item.id === activeSection)?.label}
              </h2>
            </div>

            <div className="mt-4 flex min-h-0 flex-1 flex-col overflow-y-auto pr-1">
              {activeSection === "general" ? (
                <div className="flex flex-col gap-4">
                <h3 className="text-base font-semibold text-foreground">常规</h3>
                  <div className="rounded-xl border border-border bg-muted/40 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="rounded-full bg-background p-2 text-foreground">
                          <ShieldIcon className="size-4" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <h3 className="text-base font-semibold text-foreground">
                            保护你的账户
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            添加多因素身份验证（MFA），为登录过程提供额外保护。
                          </p>
                          <div>
                            <Button variant="outline" size="sm">
                              设置 MFA
                            </Button>
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        aria-label="关闭保护卡片"
                        className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground"
                      >
                        <XIcon className="size-4" />
                      </button>
                    </div>
                  </div>

                  <div className="divide-y divide-border rounded-xl border border-border">
                    <div className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-2 text-sm text-foreground">
                        <MonitorIcon className="size-4 text-muted-foreground" />
                        <span>外观</span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        系统
                      </span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-2 text-sm text-foreground">
                        <ContrastIcon className="size-4 text-muted-foreground" />
                        <span>对比度</span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        系统
                      </span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-2 text-sm text-foreground">
                        <PaletteIcon className="size-4 text-muted-foreground" />
                        <span>重点色</span>
                      </div>
                      <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                        <span className="size-2 rounded-full bg-muted-foreground" />
                        默认
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="flex items-center gap-2 text-sm text-foreground">
                        <LanguagesIcon className="size-4 text-muted-foreground" />
                        <span>语言</span>
                      </div>
                      <select
                        className="h-8 rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none"
                        value={languagePreset}
                        onChange={(event) =>
                          updateLanguagePreset(
                            event.target.value as LanguagePreset,
                          )
                        }
                      >
                        <option value="zh-TW">自动检测</option>
                        <option value="en">English</option>
                      </select>
                    </div>
                    <div className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="flex items-center gap-2 text-sm text-foreground">
                        <UserRoundCheckIcon className="size-4 text-muted-foreground" />
                        <span>口语</span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        自动检测
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    为获得最佳结果，请选择你的主要语言。即使未列出的语言也可能通过自动检测功能被识别。
                  </p>
                </div>
              ) : null}

              {activeSection === "notifications" ? (
                <div className="mt-6 flex flex-col gap-3">
                <h3 className="text-base font-semibold text-foreground">通知</h3>
                <div className="rounded-xl border border-border bg-muted/40 p-4">
                  <p className="text-sm font-medium text-foreground">通知偏好</p>
                  <p className="mt-1 text-sm text-muted-foreground">该区域将在后续版本接入策略化通知配置。</p>
                </div>
                </div>
              ) : null}

              {activeSection === "personalization" ? (
                <div className="mt-6 flex flex-col gap-3">
                <h3 className="text-base font-semibold text-foreground">个性化</h3>
                <div className="rounded-xl border border-border bg-muted/40 p-4">
                  <p className="text-sm font-medium text-foreground">开发中</p>
                  <p className="mt-1 text-sm text-muted-foreground">此分栏内容将按产品节奏逐步开放。</p>
                </div>
                </div>
              ) : null}

              {activeSection === "apps" ? (
                <div className="mt-6 flex flex-col gap-3">
                <h3 className="text-base font-semibold text-foreground">应用</h3>
                <div className="rounded-xl border border-border bg-muted/40 p-4">
                  <p className="text-sm font-medium text-foreground">开发中</p>
                  <p className="mt-1 text-sm text-muted-foreground">此分栏内容将按产品节奏逐步开放。</p>
                </div>
                </div>
              ) : null}

              {activeSection === "schedule" ? (
                <div className="mt-6 flex flex-col gap-3">
                <h3 className="text-base font-semibold text-foreground">安排</h3>
                <div className="rounded-xl border border-border bg-muted/40 p-4">
                  <p className="text-sm font-medium text-foreground">开发中</p>
                  <p className="mt-1 text-sm text-muted-foreground">此分栏内容将按产品节奏逐步开放。</p>
                </div>
                </div>
              ) : null}

              {activeSection === "data" ? (
                <div className="mt-6 flex flex-col gap-3">
                <h3 className="text-base font-semibold text-foreground">数据管理</h3>
                <div className="rounded-xl border border-border bg-muted/40 p-4">
                  <p className="text-sm font-medium text-foreground">开发中</p>
                  <p className="mt-1 text-sm text-muted-foreground">此分栏内容将按产品节奏逐步开放。</p>
                </div>
                </div>
              ) : null}

              {activeSection === "security" ? (
                <div className="mt-6 flex flex-col gap-3">
                <h3 className="text-base font-semibold text-foreground">安全</h3>
                <div className="rounded-xl border border-border bg-muted/40 p-4">
                  <p className="text-sm font-medium text-foreground">开发中</p>
                  <p className="mt-1 text-sm text-muted-foreground">此分栏内容将按产品节奏逐步开放。</p>
                </div>
                </div>
              ) : null}

              {activeSection === "parental" ? (
                <div className="mt-6 flex flex-col gap-3">
                <h3 className="text-base font-semibold text-foreground">家长控制</h3>
                <div className="rounded-xl border border-border bg-muted/40 p-4">
                  <p className="text-sm font-medium text-foreground">开发中</p>
                  <p className="mt-1 text-sm text-muted-foreground">此分栏内容将按产品节奏逐步开放。</p>
                </div>
                </div>
              ) : null}

              {activeSection === "account" ? (
                <div className="mt-6 mb-2 flex flex-col gap-3">
                <h3 className="text-base font-semibold text-foreground">账户</h3>
                <div className="rounded-xl border border-border bg-muted/40 p-4">
                  <p className="text-sm text-muted-foreground">当前角色</p>
                  <p className="mt-1 text-base font-medium text-foreground">{role}</p>
                </div>
                <p className="text-sm text-muted-foreground">账户详情将通过 profile API 同步更新。</p>
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
