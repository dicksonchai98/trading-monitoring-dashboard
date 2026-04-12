import type { JSX } from "react";

interface CardDataStateProps {
  text: string;
}

export function CardDataState({ text }: CardDataStateProps): JSX.Element {
  return (
    <div className="flex min-h-[180px] items-center justify-center text-xs text-muted-foreground">
      {text}
    </div>
  );
}

