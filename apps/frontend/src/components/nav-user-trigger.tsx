import { forwardRef, type ComponentProps } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { useT } from "@/lib/i18n";
import { ChevronsUpDownIcon } from "lucide-react";

export interface SidebarUserIdentity {
  name: string;
  email: string;
  avatar: string;
}

export const NavUserTrigger = forwardRef<
  HTMLButtonElement,
  { user: SidebarUserIdentity } & ComponentProps<typeof SidebarMenuButton>
>(({ user, className, ...props }, ref) => {
  const t = useT();

  return (
    <SidebarMenuButton
      ref={ref}
      size="lg"
      className={`data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground focus-visible:ring-0 focus-visible:ring-offset-0 ${className ?? ""}`}
      {...props}
    >
      <Avatar className="h-8 w-8 rounded-lg">
        <AvatarImage src={user.avatar} alt={user.name} />
        <AvatarFallback className="rounded-lg">{t("user.avatarFallback")}</AvatarFallback>
      </Avatar>
      <div className="grid flex-1 text-left text-sm leading-tight">
        <span className="truncate font-medium">{user.name}</span>
        <span className="truncate text-xs">{user.email}</span>
      </div>
      <ChevronsUpDownIcon className="ml-auto size-4" />
    </SidebarMenuButton>
  );
});

NavUserTrigger.displayName = "NavUserTrigger";
