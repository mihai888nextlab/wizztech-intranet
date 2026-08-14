import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface SectionProps {
  title: string;
  count?: number;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Section({
  title,
  count,
  action,
  children,
  className,
}: SectionProps) {
  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-heading text-sm font-semibold tracking-tight">
          {title}
          {count !== undefined && (
            <span className="ml-1.5 font-normal text-muted-foreground tabular-nums">
              {count}
            </span>
          )}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Card that hosts a divided list of rows, edge to edge. */
export function ListCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10",
        className
      )}
    >
      <ul className="divide-y divide-border">{children}</ul>
    </div>
  );
}

export function ListRow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <li className={cn("flex items-center gap-3 px-4 py-3", className)}>
      {children}
    </li>
  );
}
