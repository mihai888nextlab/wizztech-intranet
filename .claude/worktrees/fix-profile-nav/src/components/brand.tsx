import { cn } from "@/lib/utils";

/*
  The WizzTech mark: the team's owl, read straight from public/wizztech-logo.svg
  rather than inlined here, so replacing that file is all it takes to change the
  logo everywhere.
*/

/**
 * The mark on its own, with no tile behind it: it is a multi-colour figure
 * rather than a glyph, and a solid backdrop muddies the pale body against the
 * purple cap.
 *
 * Sized by height alone — callers pass `h-8`, `h-12` — so the width follows the
 * logo's own proportions instead of padding it out to a square, which would
 * open a stray gap between the mark and the wordmark beside it.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn("inline-flex h-8 w-auto shrink-0 items-center", className)}
      aria-hidden="true"
    >
      {/* A plain img, not next/image: the optimizer refuses SVG unless
          `dangerouslyAllowSVG` is set, and there is nothing to optimise in a
          vector anyway. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/wizztech-logo.svg"
        alt=""
        className="h-full w-auto"
      />
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
