import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/*
  The pieces the two finance charts are built from.

  Both charts are plain HTML and SVG sized in percentages, so they reflow with
  the card instead of needing a resize observer, and they inherit the theme's
  tokens rather than hard-coding light-mode colours.
*/

/** Series colours are assigned in order and never cycled — see globals.css. */
export function chartColor(colorIndex: number) {
  const slot = Math.min(Math.max(colorIndex, 1), 5);
  return `var(--chart-${slot})`;
}

export function ChartCard({
  title,
  description,
  legend,
  children,
  className,
}: {
  title: string;
  description?: string;
  legend?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-xl bg-card p-4 ring-1 ring-foreground/10", className)}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h3 className="font-heading text-sm font-semibold tracking-tight">
            {title}
          </h3>
          {description && (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        {legend}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/**
 * Identity never rests on colour alone: every chart with two or more series
 * carries one of these, and the swatch sits beside the text rather than
 * colouring it.
 */
export function Legend({
  items,
}: {
  items: { label: string; color: string }[];
}) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {items.map((item) => (
        <li
          key={item.label}
          className="flex items-center gap-1.5 text-xs text-muted-foreground"
        >
          <span
            aria-hidden="true"
            className="size-2.5 shrink-0 rounded-[3px]"
            style={{ background: item.color }}
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

export function ChartEmpty({ children }: { children: ReactNode }) {
  return (
    <p className="py-8 text-center text-sm text-muted-foreground">{children}</p>
  );
}
