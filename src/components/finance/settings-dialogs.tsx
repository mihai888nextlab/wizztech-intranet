import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { chartColor } from "@/components/finance/chart-parts";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { CHART_COLOR_COUNT, ENTRY_KINDS, type EntryKind } from "@/lib/finance";
import { cn } from "@/lib/utils";

export interface Season {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
}

export interface Category {
  id: number;
  name: string;
  kind: string;
  colorIndex: number;
  archivedAt: string | null;
}

export function SeasonDialog({
  open,
  onOpenChange,
  existing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existing: Season | null;
  onSaved: (season: Season, isNew: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isCurrent, setIsCurrent] = useState(false);
  const [saving, setSaving] = useState(false);

  const key = `${open}:${existing?.id ?? "new"}`;
  const [loadedKey, setLoadedKey] = useState("");
  if (open && key !== loadedKey) {
    setLoadedKey(key);
    setName(existing?.name ?? "");
    setStartDate(existing?.startDate ?? "");
    setEndDate(existing?.endDate ?? "");
    setIsCurrent(existing?.isCurrent ?? false);
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(
        existing ? `/api/finance/seasons/${existing.id}` : "/api/finance/seasons",
        {
          method: existing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, startDate, endDate, isCurrent }),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error || "Could not save that season");
        return;
      }
      onSaved(await res.json(), !existing);
      toast.success(existing ? "Season updated" : "Season added");
      onOpenChange(false);
    } catch {
      toast.error("Connection error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit season" : "Add season"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="season-name">Name</Label>
            <Input
              id="season-name"
              className="h-10"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="2025–26 DECODE"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="season-start">Starts</Label>
              <Input
                id="season-start"
                type="date"
                className="h-10"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="season-end">Ends</Label>
              <Input
                id="season-end"
                type="date"
                className="h-10"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </div>
          </div>
          <Label className="flex items-center gap-2 font-normal">
            <Checkbox
              checked={isCurrent}
              onCheckedChange={(checked) => setIsCurrent(checked === true)}
            />
            This is the current season
          </Label>
          <Button type="submit" className="h-10 w-full rounded-xl" disabled={saving}>
            {saving && <Spinner />}
            {existing ? "Save changes" : "Add season"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CategoryDialog({
  open,
  onOpenChange,
  existing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existing: Category | null;
  onSaved: (category: Category, isNew: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<EntryKind>("expense");
  const [colorIndex, setColorIndex] = useState(1);
  const [saving, setSaving] = useState(false);

  const key = `${open}:${existing?.id ?? "new"}`;
  const [loadedKey, setLoadedKey] = useState("");
  if (open && key !== loadedKey) {
    setLoadedKey(key);
    setName(existing?.name ?? "");
    setKind((existing?.kind as EntryKind) ?? "expense");
    setColorIndex(existing?.colorIndex ?? 1);
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(
        existing ? `/api/finance/categories/${existing.id}` : "/api/finance/categories",
        {
          method: existing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, kind, colorIndex }),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error || "Could not save that category");
        return;
      }
      onSaved(await res.json(), !existing);
      toast.success(existing ? "Category updated" : "Category added");
      onOpenChange(false);
    } catch {
      toast.error("Connection error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit category" : "Add category"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="category-name">Name</Label>
            <Input
              id="category-name"
              className="h-10"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Parts & materials"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category-kind">Side of the ledger</Label>
            <Select
              value={kind}
              onValueChange={(v) => v && setKind(v as EntryKind)}
              disabled={existing !== null}
            >
              <SelectTrigger id="category-kind" className="h-10 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ENTRY_KINDS.map((k) => (
                  <SelectItem key={k} value={k} className="capitalize">
                    {k}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {existing && (
              <p className="text-xs text-muted-foreground">
                Fixed once entries are filed here. Archive it and add a new one instead.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Colour</Label>
            <div className="flex gap-2">
              {Array.from({ length: CHART_COLOR_COUNT }, (_, i) => i + 1).map((slot) => (
                <button
                  key={slot}
                  type="button"
                  aria-label={`Colour ${slot}`}
                  aria-pressed={colorIndex === slot}
                  onClick={() => setColorIndex(slot)}
                  className={cn(
                    "size-8 rounded-lg outline-none transition-[box-shadow]",
                    colorIndex === slot
                      ? "ring-2 ring-foreground ring-offset-2 ring-offset-background"
                      : "ring-1 ring-foreground/10"
                  )}
                  style={{ background: chartColor(slot) }}
                />
              ))}
            </div>
          </div>

          <Button type="submit" className="h-10 w-full rounded-xl" disabled={saving}>
            {saving && <Spinner />}
            {existing ? "Save changes" : "Add category"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
