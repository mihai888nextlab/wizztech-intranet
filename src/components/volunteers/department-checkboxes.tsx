import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  DEPARTMENT_LABELS,
  VOLUNTEER_DEPARTMENTS,
  type VolunteerDepartment,
} from "@/lib/volunteers";

/**
 * Picking a volunteer's departments. Plural and checkboxes rather than one
 * dropdown, because people help on more than one side of the team — whoever
 * films the match is often the one writing the post about it.
 */
export function DepartmentCheckboxes({
  value,
  onChange,
  disabled,
}: {
  value: readonly string[];
  onChange: (value: VolunteerDepartment[]) => void;
  disabled?: boolean;
}) {
  const toggle = (department: VolunteerDepartment, checked: boolean) =>
    // Rebuilt from the canonical list, so the stored order never depends on
    // the order somebody happened to tick the boxes in.
    onChange(
      VOLUNTEER_DEPARTMENTS.filter((d) =>
        d === department ? checked : value.includes(d)
      )
    );

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
      {VOLUNTEER_DEPARTMENTS.map((department) => (
        <Label key={department} className="flex items-center gap-2.5 font-normal">
          <Checkbox
            checked={value.includes(department)}
            disabled={disabled}
            onCheckedChange={(next) => toggle(department, next === true)}
          />
          <span className="text-sm">{DEPARTMENT_LABELS[department]}</span>
        </Label>
      ))}
    </div>
  );
}
