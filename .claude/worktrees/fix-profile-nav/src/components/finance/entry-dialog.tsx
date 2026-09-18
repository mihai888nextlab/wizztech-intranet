import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { EntryDocuments } from "@/components/finance/entry-documents";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import {
  CURRENCIES,
  ENTRY_KINDS,
  formatRon,
  parseAmount,
  parseRate,
  RATE_SCALE,
  toRonBani,
  type Currency,
  type EntryKind,
  type FinanceDocumentView,
  type FinanceEntryView,
} from "@/lib/finance";
import { todayISO } from "@/lib/format";

interface Category {
  id: number;
  name: string;
  kind: string;
  archivedAt: string | null;
}

/**
 * One dialog for both adding and editing, so the two paths cannot validate
 * differently — the same shape as the announcement dialog.
 *
 * Documents are only offered once the entry exists: they are keyed by entry id
 * in the bucket, so there is nothing to attach them to before the first save.
 */
export function EntryDialog({
  open,
  onOpenChange,
  seasonId,
  categories,
  existing,
  onSaved,
  onDocumentsChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seasonId: number;
  categories: Category[];
  existing: FinanceEntryView | null;
  onSaved: (entry: FinanceEntryView, isNew: boolean) => void;
  onDocumentsChanged: (entryId: number, documents: FinanceDocumentView[]) => void;
}) {
  const [kind, setKind] = useState<EntryKind>("expense");
  const [categoryId, setCategoryId] = useState("");
  const [title, setTitle] = useState("");
  const [counterparty, setCounterparty] = useState("");
  const [note, setNote] = useState("");
  const [occurredOn, setOccurredOn] = useState(todayISO());
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<Currency>("RON");
  const [rate, setRate] = useState("");
  const [saving, setSaving] = useState(false);

  // Reload the fields when the dialog opens on a different entry, without an
  // effect — the same render-phase sync the announcement dialog uses.
  const key = `${open}:${existing?.id ?? "new"}`;
  const [loadedKey, setLoadedKey] = useState("");
  if (open && key !== loadedKey) {
    setLoadedKey(key);
    setKind((existing?.kind as EntryKind) ?? "expense");
    setCategoryId(existing ? String(existing.categoryId) : "");
    setTitle(existing?.title ?? "");
    setCounterparty(existing?.counterparty ?? "");
    setNote(existing?.note ?? "");
    setOccurredOn(existing?.occurredOn ?? todayISO());
    setAmount(existing ? (existing.amountMinor / 100).toFixed(2) : "");
    setCurrency((existing?.currency as Currency) ?? "RON");
    setRate(
      existing && existing.currency !== "RON"
        ? String(existing.rateToRonMicros / RATE_SCALE)
        : ""
    );
  }

  const available = categories.filter(
    (c) => c.kind === kind && (!c.archivedAt || String(c.id) === categoryId)
  );

  const amountMinor = parseAmount(amount);
  const rateMicros = currency === "RON" ? RATE_SCALE : parseRate(rate);
  const preview =
    amountMinor !== null && rateMicros !== null && currency !== "RON"
      ? toRonBani(amountMinor, rateMicros)
      : null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (amountMinor === null || amountMinor <= 0) {
      toast.error("Enter an amount greater than zero");
      return;
    }
    if (rateMicros === null) {
      toast.error(`Enter how many RON one ${currency} is worth`);
      return;
    }
    if (!categoryId) {
      toast.error("Pick a category");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(
        existing ? `/api/finance/entries/${existing.id}` : "/api/finance/entries",
        {
          method: existing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            seasonId,
            categoryId: Number(categoryId),
            title,
            counterparty,
            note,
            occurredOn,
            amountMinor,
            currency,
            rateToRonMicros: rateMicros,
          }),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error || "Could not save that entry");
        return;
      }

      onSaved(await res.json(), !existing);
      toast.success(existing ? "Entry updated" : "Entry added");
      onOpenChange(false);
    } catch {
      toast.error("Connection error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit entry" : "Add entry"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="entry-kind">Type</Label>
              <Select
                value={kind}
                onValueChange={(v) => {
                  if (!v) return;
                  setKind(v as EntryKind);
                  // The old category belongs to the other side of the ledger.
                  setCategoryId("");
                }}
              >
                <SelectTrigger id="entry-kind" className="h-10 w-full">
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="entry-date">Date</Label>
              <Input
                id="entry-date"
                type="date"
                className="h-10"
                value={occurredOn}
                onChange={(e) => setOccurredOn(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="entry-category">Category</Label>
            <Select
              value={categoryId}
              onValueChange={(v) => v && setCategoryId(v as string)}
            >
              <SelectTrigger id="entry-category" className="h-10 w-full">
                <SelectValue placeholder="Pick a category" />
              </SelectTrigger>
              <SelectContent>
                {available.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {available.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No {kind} categories yet — add one under Settings.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="entry-title">Title</Label>
            <Input
              id="entry-title"
              className="h-10"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={kind === "income" ? "Sponsorship instalment" : "REV motor set"}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="entry-counterparty">
              {kind === "income" ? "From" : "Paid to"}
              <span className="ml-1 font-normal text-muted-foreground">optional</span>
            </Label>
            <Input
              id="entry-counterparty"
              className="h-10"
              value={counterparty}
              onChange={(e) => setCounterparty(e.target.value)}
              placeholder={kind === "income" ? "WizMobile" : "REV Robotics"}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="entry-amount">Amount</Label>
              <Input
                id="entry-amount"
                className="h-10 tabular-nums"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="1.250,50"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="entry-currency">Currency</Label>
              <Select
                value={currency}
                onValueChange={(v) => v && setCurrency(v as Currency)}
              >
                <SelectTrigger id="entry-currency" className="h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* The rate is frozen onto the entry, so a later swing cannot move
              what this purchase cost the team. */}
          {currency !== "RON" && (
            <div className="space-y-2">
              <Label htmlFor="entry-rate">Exchange rate</Label>
              <Input
                id="entry-rate"
                className="h-10 tabular-nums"
                inputMode="decimal"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                placeholder="5,0832"
                required
              />
              <p className="text-xs text-muted-foreground">
                RON for one {currency}, on the day it was paid.
                {preview !== null && (
                  <span className="ml-1 font-medium text-foreground">
                    ≈ {formatRon(preview)}
                  </span>
                )}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="entry-note">
              Note
              <span className="ml-1 font-normal text-muted-foreground">optional</span>
            </Label>
            <Textarea
              id="entry-note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <Button
            type="submit"
            className="h-10 w-full rounded-xl"
            disabled={saving}
          >
            {saving && <Spinner />}
            {existing ? "Save changes" : "Add entry"}
          </Button>
        </form>

        {existing && (
          <div className="space-y-2 border-t border-border pt-4">
            <h3 className="text-xs font-medium text-muted-foreground">Documents</h3>
            <EntryDocuments
              entryId={existing.id}
              documents={existing.documents ?? []}
              onChanged={(docs) => onDocumentsChanged(existing.id, docs)}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
