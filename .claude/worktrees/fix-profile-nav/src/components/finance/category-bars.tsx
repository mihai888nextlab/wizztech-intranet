import { chartColor, ChartCard, ChartEmpty } from "@/components/finance/chart-parts";
import { formatRon } from "@/lib/finance";

/*
  Where a season's money went, one category per row.

  Ranked horizontal bars rather than a pie: category names run long ("Parts &
  materials"), a team can easily have more than seven of them, and reading a
  length against a shared baseline beats comparing wedge angles. Each row is
  directly labelled with its amount and share, so nothing depends on the colour.
*/

export interface CategorySlice {
  categoryId: number;
  name: string;
  colorIndex: number;
  totalBani: number;
}

export function CategoryBars({
  title,
  description,
  slices,
  emptyLabel,
}: {
  title: string;
  description?: string;
  slices: CategorySlice[];
  emptyLabel: string;
}) {
  const total = slices.reduce((sum, s) => sum + s.totalBani, 0);
  const ranked = [...slices].sort((a, b) => b.totalBani - a.totalBani);
  const largest = ranked[0]?.totalBani ?? 0;

  return (
    <ChartCard title={title} description={description}>
      {ranked.length === 0 || total === 0 ? (
        <ChartEmpty>{emptyLabel}</ChartEmpty>
      ) : (
        <ul className="space-y-3">
          {ranked.map((slice) => {
            const share = Math.round((slice.totalBani / total) * 100);
            // Scaled against the largest row, so the biggest bar fills the
            // track and the rest stay comparable to it.
            const width = largest > 0 ? (slice.totalBani / largest) * 100 : 0;
            return (
              <li key={slice.categoryId}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate font-medium">{slice.name}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {formatRon(slice.totalBani)}
                    <span className="ml-1.5 text-xs">{share}%</span>
                  </span>
                </div>
                <div className="mt-1.5 h-2 rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full"
                    style={{
                      width: `${Math.max(width, 1.5)}%`,
                      background: chartColor(slice.colorIndex),
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </ChartCard>
  );
}
