import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

const typographyVariants = {
  display: "typo-display",
  h1: "typo-h1",
  h2: "typo-h2",
  title: "typo-title",
  body: "typo-body",
  caption: "typo-caption",
  overline: "typo-overline",
  meta: "typo-meta",
  metric: "typo-metric",
} as const;

type TypographyVariant = keyof typeof typographyVariants;

interface TypographyBaseProps {
  children: ReactNode;
  className?: string;
  variant?: TypographyVariant;
}

type TypographyProps<T extends ElementType> = TypographyBaseProps & {
  as?: T;
} & Omit<ComponentPropsWithoutRef<T>, keyof TypographyBaseProps | "as">;

export function Typography<T extends ElementType = "p">({
  as,
  children,
  className,
  variant = "body",
  ...props
}: TypographyProps<T>) {
  const Component = as ?? "p";
  return (
    <Component className={cn(typographyVariants[variant], className)} {...props}>
      {children}
    </Component>
  );
}

