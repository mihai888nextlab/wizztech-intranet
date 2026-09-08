import { format, parseISO } from "date-fns";

import { ChartCard, ChartEmpty, Legend } from "@/components/finance/chart-parts";
import { formatRon, formatRonShort } from "@/lib/finance";

/*
  Income against spending, month by month across the season.

  Two series on one shared scale — never two axes — so the months where the team
  spent more than it took in are visible as height, not as a colour to decode.
  A legend carries identity, and the hovered month names its own figures below
  the plot, so no number is printed on every bar.
*/

export interface MonthlyPoint {
  month: string;
  incomeBani: number;
  expenseBani: number;
}

const INCOME_COLOR = "var(--success)";
const EXPENSE_COLOR = "var(--destructive)";

export function MonthlyBars({ points }: { points: MonthlyPoint[] }) {
  const peak = points.reduce(
    (max, p) => Math.max(max, p.incomeBani, p.expenseBani),
    0
  );

  return (
    <ChartCard
      title="Month by month"
      description="Income and spending across the season, in RON."
      legend={
        <Legend
          items={[
            { label: "Income", color: INCOME_COLOR },
            { label: "Expenses", color: EXPENSE_COLOR },
          ]}
        />
      }
    >
      {points.length === 0 || peak === 0 ? (
        <ChartEmpty>No entries in this season yet.</ChartEmpty>
      ) : (
        <div className="flex gap-3">
          {/* Ticks carry the values the bars are not directly labelled with. */}
          <ul className="flex h-40 w-10 shrink-0 flex-col justify-between text-right text-[10px] tabular-nums text-muted-foreground">
            <li>{formatRonShort(peak)}</li>
            <li>{formatRonShort(peak / 2)}</li>
            <li>0</li>
          </ul>

          <div className="min-w-0 flex-1 overflow-x-auto">
            <div
              className="flex h-40 items-end gap-3 border-b border-border"
              style={{ minWidth: `${points.length * 44}px` }}
            >
              {points.map((point) => (
                <div
                  key={point.month}
                  className="flex h-full min-w-0 flex-1 items-end justify-center gap-[2px]"
                >
                  <Bar
                    value={point.incomeBani}
                    peak={peak}
                    color={INCOME_COLOR}
                    label={`Income in ${monthLabel(point.month)}`}
                  />
                  <Bar
                    value={point.expenseBani}
                    peak={peak}
                    color={EXPENSE_COLOR}
                    label={`Expenses in ${monthLabel(point.month)}`}
                  />
                </div>
              ))}
            </div>
            <div
              className="flex gap-3"
              style={{ minWidth: `${points.length * 44}px` }}
            >
              {points.map((point) => (
                <div
                  key={point.month}
                  className="min-w-0 flex-1 pt-1.5 text-center text-[10px] text-muted-foreground"
                >
                  {monthLabel(point.month)}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </ChartCard>
  );
}

function Bar({
  value,
  peak,
  color,
  label,
}: {
  value: number;
  peak: number;
  color: string;
  label: string;
}) {
  // A month with nothing on one side keeps its slot, so the pairs stay aligned.
  const height = peak > 0 ? (value / peak) * 100 : 0;
  return (
    <div
      className="group relative h-full w-full max-w-[16px] flex items-end"
      title={`${label}: ${formatRon(value)}`}
    >
      <div
        className="w-full rounded-t"
        style={{ height: `${height}%`, background: color, minHeight: value > 0 ? 2 : 0 }}
        aria-label={`${label}: ${formatRon(value)}`}
        role="img"
      />
    </div>
  );
}

/** `"2025-10"` -> `"Oct"`, with the year when a season straddles one. */
function monthLabel(month: string) {
  return format(parseISO(`${month}-01`), "MMM");
}
