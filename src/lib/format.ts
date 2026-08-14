import { format, parseISO } from "date-fns";

/** Local calendar day as `YYYY-MM-DD`, matching how event dates are stored. */
export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function initialsOf(fullName: string) {
  return fullName
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/** `135` -> `2h 15m`, `45` -> `45m`, `0` -> `0m`. */
export function formatDuration(minutes: number) {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** `204809` -> `200 KB`. */
export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(kb / 1024 < 10 ? 1 : 0)} MB`;
}

/** `"14:30:00"` -> `"14:30"`. */
export function formatTime(time: string) {
  return time.slice(0, 5);
}

export function formatDateRange(
  startDate: string,
  endDate: string,
  { long = false }: { long?: boolean } = {}
) {
  const start = parseISO(startDate);
  const end = parseISO(endDate);

  if (startDate === endDate) {
    return format(start, long ? "EEEE, MMMM d, yyyy" : "EEE, MMM d");
  }
  if (
    start.getMonth() === end.getMonth() &&
    start.getFullYear() === end.getFullYear()
  ) {
    return `${format(start, "MMM d")} – ${format(end, "d, yyyy")}`;
  }
  return `${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}`;
}

export type EventStatus = "upcoming" | "ongoing" | "past";

export function eventStatus(startDate: string, endDate: string): EventStatus {
  const today = todayISO();
  if (endDate < today) return "past";
  if (startDate <= today) return "ongoing";
  return "upcoming";
}
