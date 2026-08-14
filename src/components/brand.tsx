import { cn } from "@/lib/utils";

/** The WizzTech mark: a single stroked "W" on a solid tile. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-[0.55rem] bg-primary text-primary-foreground",
        className
      )}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-[60%]"
      >
        <path d="M3 6 6.5 18 12 8l5.5 10L21 6" />
      </svg>
    </span>
  );
}

export function BrandWordmark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <BrandMark />
      <span className="font-heading text-[15px] font-semibold tracking-tight">
        WizzTech
      </span>
    </span>
  );
}
