import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { format, parseISO } from "date-fns";
import {
  Archive,
  ArrowDownLeft,
  ArrowUpRight,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Plus,
  Scale,
  Trash2,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { CategoryBars } from "@/components/finance/category-bars";
import { chartColor } from "@/components/finance/chart-parts";
import { EntryDialog } from "@/components/finance/entry-dialog";
import { MonthlyBars, type MonthlyPoint } from "@/components/finance/monthly-bars";
import {
  CategoryDialog,
  SeasonDialog,
  type Category,
  type Season,
} from "@/components/finance/settings-dialogs";
import { AppShell, AuthLoading } from "@/components/layout/app-shell";
import { ListCard, ListRow, Section } from "@/components/section";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUser } from "@/hooks/use-user";
import {
  formatMoney,
  formatRon,
  type FinanceDocumentView,
  type FinanceEntryView,
} from "@/lib/finance";
import { canEditFinance } from "@/lib/roles";
import { cn } from "@/lib/utils";

interface Summary {
  totalIncomeBani: number;
  totalExpenseBani: number;
  seasonNetBani: number;
  openingBalanceBani: number;
  balanceBani: number;
  entryCount: number;
  byCategory: {
    categoryId: number;
    name: string;
    kind: string;
    colorIndex: number;
    totalBani: number;
  }[];
  byMonth: MonthlyPoint[];
}

/**
 * The team's books.
 *
 * Everyone signed in may read this page — knowing where the money went is the
 * point of keeping it in the intranet rather than a spreadsheet. Writing, and
 * reaching the paperwork behind an entry, is limited to treasurers, and the API
 * enforces both independently of what is rendered here.
 */
export default function FinancePage() {
  const router = useRouter();
  const user = useUser();
  const canEdit = canEditFinance(user?.roles);

  const [seasons, setSeasons] = useState<Season[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  // Both are tagged with the season they were fetched for, so switching seasons
  // shows a loading state instead of the previous season's numbers — derived
  // during render rather than cleared from inside the effect.
  const [loaded, setLoaded] = useState<{
    seasonId: number;
    entries: FinanceEntryView[];
  } | null>(null);
  const [summary, setSummary] = useState<{
    seasonId: number;
    data: Summary;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const [entryDialogOpen, setEntryDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<FinanceEntryView | null>(null);
  const [deletingEntry, setDeletingEntry] = useState<FinanceEntryView | null>(null);

  const [seasonDialogOpen, setSeasonDialogOpen] = useState(false);
  const [editingSeason, setEditingSeason] = useState<Season | null>(null);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const tab = typeof router.query.tab === "string" ? router.query.tab : "overview";
  const seasonParam =
    typeof router.query.season === "string" ? Number(router.query.season) : null;

  // The URL wins when it names a season, so links are shareable; otherwise the
  // season the team is actually in.
  const seasonId =
    seasonParam && seasons.some((s) => s.id === seasonParam)
      ? seasonParam
      : (seasons.find((s) => s.isCurrent) ?? seasons[0])?.id ?? null;

  useEffect(() => {
    if (!user) return;
    Promise.all([
      fetch("/api/finance/seasons").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/finance/categories").then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([seasonRows, categoryRows]) => {
        setSeasons(seasonRows);
        setCategories(categoryRows);
      })
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    if (!seasonId) return;
    fetch(`/api/finance/entries?seasonId=${seasonId}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((entries) => setLoaded({ seasonId, entries }));
    fetch(`/api/finance/summary?seasonId=${seasonId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setSummary({ seasonId, data }));
  }, [seasonId]);

  if (!user) return <AuthLoading />;

  const entries = loaded?.seasonId === seasonId ? loaded.entries : [];
  const seasonSummary = summary?.seasonId === seasonId ? summary.data : null;

  const setQuery = (next: { tab?: string; season?: number }) => {
    const query: Record<string, string> = {};
    const nextTab = next.tab ?? tab;
    const nextSeason = next.season ?? seasonId;
    if (nextTab !== "overview") query.tab = nextTab;
    if (nextSeason) query.season = String(nextSeason);
    router.replace({ pathname: "/finance", query }, undefined, { shallow: true });
  };

  // A reader who lands on ?tab=settings has nothing to manage there.
  const activeTab = tab === "settings" && !canEdit ? "overview" : tab;

  const handleEntrySaved = (entry: FinanceEntryView, isNew: boolean) => {
    setLoaded((current) =>
      current
        ? {
            ...current,
            entries: isNew
              ? [entry, ...current.entries]
              : current.entries.map((e) => (e.id === entry.id ? entry : e)),
          }
        : current
    );
    refreshSummary();
  };

  const handleDocumentsChanged = (
    entryId: number,
    documents: FinanceDocumentView[]
  ) => {
    const update = (entry: FinanceEntryView) =>
      entry.id === entryId
        ? { ...entry, documents, documentCount: documents.length }
        : entry;
    setLoaded((current) =>
      current ? { ...current, entries: current.entries.map(update) } : current
    );
    setEditingEntry((current) => (current ? update(current) : current));
  };

  const refreshSummary = () => {
    if (!seasonId) return;
    fetch(`/api/finance/summary?seasonId=${seasonId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setSummary({ seasonId, data }));
  };

  const handleDeleteEntry = async () => {
    if (!deletingEntry) return;
    const res = await fetch(`/api/finance/entries/${deletingEntry.id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setLoaded((current) =>
        current
          ? {
              ...current,
              entries: current.entries.filter((e) => e.id !== deletingEntry.id),
            }
          : current
      );
      refreshSummary();
      toast.success("Entry deleted");
    } else {
      toast.error("Could not delete that entry");
    }
  };

  const openNewEntry = () => {
    setEditingEntry(null);
    setEntryDialogOpen(true);
  };

  return (
    <AppShell
      user={user}
      title="Finances"
      description="What the team took in and spent, season by season."
      wide
      action={
        seasons.length > 1 ? (
          <Select
            value={seasonId ? String(seasonId) : ""}
            onValueChange={(v) => v && setQuery({ season: Number(v) })}
          >
            <SelectTrigger className="h-9 w-[170px]" aria-label="Season">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {seasons.map((season) => (
                <SelectItem key={season.id} value={String(season.id)}>
                  {season.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : undefined
      }
    >
      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      ) : seasons.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="No seasons yet"
          description={
            canEdit
              ? "Add an FTC season to start recording income and expenses."
              : "The treasurers have not set up a season yet."
          }
          action={
            canEdit ? (
              <Button
                onClick={() => {
                  setEditingSeason(null);
                  setSeasonDialogOpen(true);
                }}
              >
                <Plus /> Add season
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Tabs
          value={activeTab}
          onValueChange={(value) => setQuery({ tab: value })}
          className="gap-5"
        >
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="entries">Entries</TabsTrigger>
            {canEdit && <TabsTrigger value="settings">Settings</TabsTrigger>}
          </TabsList>

          <TabsContent value="overview" className="space-y-5">
            <OverviewTab summary={seasonSummary} />
          </TabsContent>

          <TabsContent value="entries" className="space-y-4">
            <EntriesTab
              entries={entries}
              canEdit={canEdit}
              onAdd={openNewEntry}
              onEdit={(entry) => {
                setEditingEntry(entry);
                setEntryDialogOpen(true);
              }}
              onDelete={setDeletingEntry}
            />
          </TabsContent>

          {canEdit && (
            <TabsContent value="settings" className="space-y-6">
              <SettingsTab
                seasons={seasons}
                categories={categories}
                onAddSeason={() => {
                  setEditingSeason(null);
                  setSeasonDialogOpen(true);
                }}
                onEditSeason={(season) => {
                  setEditingSeason(season);
                  setSeasonDialogOpen(true);
                }}
                onAddCategory={() => {
                  setEditingCategory(null);
                  setCategoryDialogOpen(true);
                }}
                onEditCategory={(category) => {
                  setEditingCategory(category);
                  setCategoryDialogOpen(true);
                }}
                onCategoriesChanged={setCategories}
              />
            </TabsContent>
          )}
        </Tabs>
      )}

      {canEdit && seasonId && (
        <EntryDialog
          open={entryDialogOpen}
          onOpenChange={setEntryDialogOpen}
          seasonId={seasonId}
          categories={categories}
          existing={editingEntry}
          onSaved={handleEntrySaved}
          onDocumentsChanged={handleDocumentsChanged}
        />
      )}

      {canEdit && (
        <>
          <SeasonDialog
            open={seasonDialogOpen}
            onOpenChange={setSeasonDialogOpen}
            existing={editingSeason}
            onSaved={(season, isNew) => {
              setSeasons((current) => {
                const next = isNew
                  ? [season, ...current]
                  : current.map((s) => (s.id === season.id ? season : s));
                // Only one season is ever current, so the others give it up.
                return season.isCurrent
                  ? next.map((s) => ({ ...s, isCurrent: s.id === season.id }))
                  : next;
              });
            }}
          />
          <CategoryDialog
            open={categoryDialogOpen}
            onOpenChange={setCategoryDialogOpen}
            existing={editingCategory}
            onSaved={(category, isNew) =>
              setCategories((current) =>
                isNew
                  ? [...current, category]
                  : current.map((c) => (c.id === category.id ? category : c))
              )
            }
          />
        </>
      )}

      <ConfirmDialog
        open={deletingEntry !== null}
        onOpenChange={(open) => !open && setDeletingEntry(null)}
        title={`Delete "${deletingEntry?.title ?? ""}"?`}
        description="Its documents are deleted from storage too. This cannot be undone."
        confirmLabel="Delete"
        onConfirm={handleDeleteEntry}
      />
    </AppShell>
  );
}

function OverviewTab({ summary }: { summary: Summary | null }) {
  if (!summary) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[92px] rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-56 w-full rounded-xl" />
      </div>
    );
  }

  const positive = summary.balanceBani >= 0;
  const net = summary.seasonNetBani;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Income"
          value={formatRon(summary.totalIncomeBani)}
          hint="This season"
          icon={ArrowDownLeft}
        />
        <StatCard
          label="Expenses"
          value={formatRon(summary.totalExpenseBani)}
          hint="This season"
          icon={ArrowUpRight}
        />
        {/* The bank does not reset in September: this is every season up to and
            including the one selected, so a surplus carries forward. */}
        <StatCard
          label="In the bank"
          value={
            <span className={positive ? "text-success" : "text-destructive"}>
              {formatRon(summary.balanceBani)}
            </span>
          }
          hint={
            <>
              {formatRon(summary.openingBalanceBani)} carried over
              <span className={net >= 0 ? "text-success" : "text-destructive"}>
                {" "}
                {net >= 0 ? "+" : "−"}
                {formatRon(Math.abs(net))}
              </span>{" "}
              this season
            </>
          }
          icon={Scale}
        />
        <StatCard
          label="Entries"
          value={summary.entryCount}
          hint="This season"
          icon={Wallet}
        />
      </div>

      <MonthlyBars points={summary.byMonth} />

      <div className="grid gap-4 lg:grid-cols-2">
        <CategoryBars
          title="Where it went"
          description="Expenses by category, this season."
          slices={summary.byCategory.filter((c) => c.kind === "expense")}
          emptyLabel="No expenses recorded yet."
        />
        <CategoryBars
          title="Where it came from"
          description="Income by category, this season."
          slices={summary.byCategory.filter((c) => c.kind === "income")}
          emptyLabel="No income recorded yet."
        />
      </div>
    </>
  );
}

function EntriesTab({
  entries,
  canEdit,
  onAdd,
  onEdit,
  onDelete,
}: {
  entries: FinanceEntryView[];
  canEdit: boolean;
  onAdd: () => void;
  onEdit: (entry: FinanceEntryView) => void;
  onDelete: (entry: FinanceEntryView) => void;
}) {
  const [filter, setFilter] = useState<"all" | "income" | "expense">("all");
  const shown = entries.filter((e) => filter === "all" || e.kind === filter);

  return (
    <Section
      title="Entries"
      count={shown.length}
      action={
        <div className="flex items-center gap-2">
          <Select
            value={filter}
            onValueChange={(v) => v && setFilter(v as typeof filter)}
          >
            <SelectTrigger className="h-9 w-[130px]" aria-label="Filter entries">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="income">Income</SelectItem>
              <SelectItem value="expense">Expenses</SelectItem>
            </SelectContent>
          </Select>
          {canEdit && (
            <Button size="sm" onClick={onAdd}>
              <Plus /> Add
            </Button>
          )}
        </div>
      }
    >
      {shown.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="Nothing here yet"
          description={
            canEdit
              ? "Record the season's income and expenses as they happen."
              : "The treasurers have not recorded anything for this season."
          }
        />
      ) : (
        <ListCard>
          {shown.map((entry) => (
            <ListRow key={entry.id}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium">{entry.title}</p>
                  {entry.documentCount > 0 && (
                    <span
                      className="flex shrink-0 items-center gap-0.5 text-xs text-muted-foreground"
                      title={`${entry.documentCount} document${entry.documentCount === 1 ? "" : "s"}`}
                    >
                      <Paperclip className="size-3" />
                      {entry.documentCount}
                    </span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <Badge
                    variant="secondary"
                    className="gap-1.5 font-normal text-muted-foreground"
                  >
                    <span
                      aria-hidden="true"
                      className="size-1.5 rounded-full"
                      style={{ background: chartColor(entry.categoryColorIndex) }}
                    />
                    {entry.categoryName}
                  </Badge>
                  <span>{format(parseISO(entry.occurredOn), "MMM d, yyyy")}</span>
                  {entry.counterparty && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="truncate">{entry.counterparty}</span>
                    </>
                  )}
                </div>
              </div>

              <div className="shrink-0 text-right">
                <p
                  className={cn(
                    "text-sm font-semibold tabular-nums",
                    entry.kind === "income" ? "text-success" : "text-foreground"
                  )}
                >
                  {entry.kind === "income" ? "+" : "−"}
                  {formatRon(entry.amountRonBani)}
                </p>
                {/* The original currency stays visible, so a EUR order is not
                    quietly remembered as a RON one. */}
                {entry.currency !== "RON" && (
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {formatMoney(entry.amountMinor, entry.currency)}
                  </p>
                )}
              </div>

              {canEdit && (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Actions for ${entry.title}`}
                      />
                    }
                  >
                    <MoreHorizontal />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEdit(entry)}>
                      <Pencil /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => onDelete(entry)}
                    >
                      <Trash2 /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </ListRow>
          ))}
        </ListCard>
      )}
    </Section>
  );
}

function SettingsTab({
  seasons,
  categories,
  onAddSeason,
  onEditSeason,
  onAddCategory,
  onEditCategory,
  onCategoriesChanged,
}: {
  seasons: Season[];
  categories: Category[];
  onAddSeason: () => void;
  onEditSeason: (season: Season) => void;
  onAddCategory: () => void;
  onEditCategory: (category: Category) => void;
  onCategoriesChanged: (categories: Category[]) => void;
}) {
  const [deletingSeason, setDeletingSeason] = useState<Season | null>(null);

  const toggleArchived = async (category: Category) => {
    const res = await fetch(`/api/finance/categories/${category.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: !category.archivedAt }),
    });
    if (!res.ok) {
      toast.error("Could not update that category");
      return;
    }
    const updated = await res.json();
    onCategoriesChanged(
      categories.map((c) => (c.id === updated.id ? updated : c))
    );
    toast.success(updated.archivedAt ? "Category archived" : "Category restored");
  };

  const deleteSeason = async () => {
    if (!deletingSeason) return;
    const res = await fetch(`/api/finance/seasons/${deletingSeason.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      toast.error(data?.error || "Could not delete that season");
      return;
    }
    toast.success("Season deleted");
    // The season picker and every total below it are keyed off this list.
    window.location.href = "/finance?tab=settings";
  };

  return (
    <>
      <Section
        title="Seasons"
        count={seasons.length}
        action={
          <Button size="sm" variant="outline" onClick={onAddSeason}>
            <Plus /> Add
          </Button>
        }
      >
        <ListCard>
          {seasons.map((season) => (
            <ListRow key={season.id}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium">{season.name}</p>
                  {season.isCurrent && (
                    <Badge className="shrink-0 bg-success/12 text-success">
                      Current
                    </Badge>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {format(parseISO(season.startDate), "MMM d, yyyy")} –{" "}
                  {format(parseISO(season.endDate), "MMM d, yyyy")}
                </p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Actions for ${season.name}`}
                    />
                  }
                >
                  <MoreHorizontal />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEditSeason(season)}>
                    <Pencil /> Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => setDeletingSeason(season)}
                  >
                    <Trash2 /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </ListRow>
          ))}
        </ListCard>
      </Section>

      <Section
        title="Categories"
        count={categories.length}
        action={
          <Button size="sm" variant="outline" onClick={onAddCategory}>
            <Plus /> Add
          </Button>
        }
      >
        <ListCard>
          {categories.map((category) => (
            <ListRow key={category.id}>
              <span
                aria-hidden="true"
                className="size-3 shrink-0 rounded-[4px]"
                style={{ background: chartColor(category.colorIndex) }}
              />
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "truncate text-sm font-medium",
                    category.archivedAt && "text-muted-foreground line-through"
                  )}
                >
                  {category.name}
                </p>
                <p className="text-xs text-muted-foreground capitalize">
                  {category.kind}
                </p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Actions for ${category.name}`}
                    />
                  }
                >
                  <MoreHorizontal />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEditCategory(category)}>
                    <Pencil /> Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => toggleArchived(category)}>
                    <Archive />
                    {category.archivedAt ? "Restore" : "Archive"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </ListRow>
          ))}
        </ListCard>
      </Section>

      <ConfirmDialog
        open={deletingSeason !== null}
        onOpenChange={(open) => !open && setDeletingSeason(null)}
        title={`Delete "${deletingSeason?.name ?? ""}"?`}
        description="Only a season with no entries can be deleted."
        confirmLabel="Delete"
        onConfirm={deleteSeason}
      />
    </>
  );
}
