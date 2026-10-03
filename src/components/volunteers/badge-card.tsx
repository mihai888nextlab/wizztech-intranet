import { BrandMark } from "@/components/brand";
import { Badge } from "@/components/ui/badge";
import { departmentLabel } from "@/lib/volunteers";
import { cn } from "@/lib/utils";

/**
 * A volunteer's identity badge. The QR comes in as a URL rather than a data
 * string so the encoder stays on the server and the badge token never reaches
 * the client — see `src/lib/badge.server.ts`.
 */
export function BadgeCard({
  fullName,
  username,
  departments,
  points,
  qrSrc,
  className,
}: {
  fullName: string;
  username: string;
  departments: readonly string[];
  points?: number;
  qrSrc: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10",
        // On paper the ring disappears, so give it a real border instead.
        "print:ring-0 print:outline print:outline-black",
        className
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-3">
        <div className="min-w-0">
          <BrandMark className="h-6" />
          <p className="mt-3 truncate font-heading text-lg leading-tight font-semibold tracking-tight">
            {fullName}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            @{username}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary">{departmentLabel(departments)}</Badge>
          {points !== undefined && (
            <Badge variant="outline" className="tabular-nums">
              {points} {points === 1 ? "point" : "points"}
            </Badge>
          )}
        </div>
      </div>

      {/*
        A scanner needs a light quiet zone around the code, so the white square
        is painted here and never themed — inverting it in dark mode would make
        the badge unreadable by the thing it exists for.
      */}
      <div className="shrink-0 self-center rounded-lg bg-white p-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={qrSrc}
          alt={`QR code identifying ${fullName}`}
          className="size-24 sm:size-28"
        />
      </div>
    </div>
  );
}
