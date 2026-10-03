import { ListCard, ListRow } from "@/components/section";
import { DEPARTMENT_LABELS, type VolunteerDepartment } from "@/lib/volunteers";

export interface DepartmentTotal {
  department: string;
  points: number;
  awards: number;
  /** Only sent for the volunteer's own page. */
  rank?: number | null;
  total?: number;
}

/**
 * The split behind a volunteer's total: every department listed, including the
 * ones on zero, because "no Media points yet" is the useful thing to see.
 */
export function DepartmentTotals({ rows }: { rows: DepartmentTotal[] }) {
  return (
    <ListCard>
      {rows.map((row) => (
        <ListRow key={row.department}>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {DEPARTMENT_LABELS[row.department as VolunteerDepartment] ??
                row.department}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {row.awards === 0
                ? "No points yet"
                : `${row.awards} award${row.awards === 1 ? "" : "s"}`}
              {row.rank != null && ` · ${row.rank} of ${row.total}`}
            </p>
          </div>
          <span className="shrink-0 font-heading text-base font-semibold tabular-nums">
            {row.points}
          </span>
        </ListRow>
      ))}
    </ListCard>
  );
}
