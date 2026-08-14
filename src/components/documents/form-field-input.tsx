import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FormField } from "@/lib/forms";

/**
 * The input control for one field, chosen by the field's type. Used by both
 * the member's fill-in dialog and the admin's review dialog.
 */
export function FormFieldInput({
  field,
  value,
  onChange,
  id,
}: {
  field: FormField;
  value: string;
  onChange: (value: string) => void;
  id?: string;
}) {
  if (field.type === "select") {
    return (
      <Select value={value} onValueChange={(next) => onChange(next ?? "")}>
        <SelectTrigger id={id} className="h-10 w-full">
          <SelectValue placeholder={field.placeholder || "Choose…"} />
        </SelectTrigger>
        <SelectContent>
          {field.options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <Input
      id={id}
      type={field.type}
      className="h-10"
      placeholder={field.placeholder ?? undefined}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
