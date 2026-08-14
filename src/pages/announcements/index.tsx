import { useState, useEffect, FormEvent } from "react";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import { FileText, Megaphone, MoreHorizontal, Pencil, Plus, Share2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { LinkedRequest } from "@/components/documents/linked-request";
import { ShareDialog } from "@/components/share-dialog";
import { EmptyState } from "@/components/empty-state";
import { AppShell, AuthLoading } from "@/components/layout/app-shell";
import { Markdown } from "@/components/markdown";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useUser } from "@/hooks/use-user";
import { TITLE_MAX } from "@/lib/announcements";
import type { FileRequest, Submission } from "@/lib/documents";
import { announcementShareText } from "@/lib/share";
import { initialsOf } from "@/lib/format";

interface Announcement {
  id: number;
  title: string;
  description: string;
  createdBy: number | null;
  createdAt: string;
  updatedAt: string;
  author: { fullName: string; username: string } | null;
  documents: FileRequest[];
}

export default function AnnouncementsPage() {
  const user = useUser();
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [deleting, setDeleting] = useState<Announcement | null>(null);
  const [requests, setRequests] = useState<FileRequest[]>([]);
  const [sharing, setSharing] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/announcements")
      .then((res) => (res.ok ? res.json() : []))
      .then(setItems)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (user?.role !== "admin") return;
    fetch("/api/file-requests")
      .then((res) => (res.ok ? res.json() : []))
      .then(setRequests);
  }, [user?.role]);

  // The list is fetched client-side, so the browser cannot act on the hash by
  // itself — scroll once the target card actually exists.
  useEffect(() => {
    if (items.length === 0) return;
    const id = window.location.hash.slice(1);
    if (!id) return;
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ block: "center" });
    el.classList.add("ring-2", "ring-primary");
    const timer = setTimeout(
      () => el.classList.remove("ring-2", "ring-primary"),
      2000
    );
    return () => clearTimeout(timer);
  }, [items]);

  if (!user) return <AuthLoading />;

  const isAdmin = user.role === "admin";

  const openShare = (announcement: Announcement) =>
    setSharing(
      announcementShareText(
        announcement,
        `${window.location.origin}/announcements#a-${announcement.id}`
      )
    );

  // Uploading from inside an announcement updates that card in place.
  const applySubmission = (requestId: number, submission: Submission) =>
    setItems((prev) =>
      prev.map((a) => ({
        ...a,
        documents: a.documents.map((d) =>
          d.id === requestId ? { ...d, mySubmission: submission } : d
        ),
      }))
    );

  const handleDelete = async () => {
    if (!deleting) return;
    const res = await fetch(`/api/announcements/${deleting.id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setItems(items.filter((a) => a.id !== deleting.id));
      toast.success("Announcement deleted");
    } else {
      toast.error("Could not delete that announcement");
    }
  };

  return (
    <AppShell
      user={user}
      title="Announcements"
      description="News and updates for the team."
      action={
        isAdmin && (
          <Button size="lg" onClick={() => setCreating(true)}>
            <Plus /> New
          </Button>
        )
      }
    >
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No announcements yet"
          description={
            isAdmin
              ? "Post the first update so the team stays in the loop."
              : "Check back once an admin posts an update."
          }
          action={
            isAdmin && (
              <Button onClick={() => setCreating(true)}>
                <Plus /> New announcement
              </Button>
            )
          }
        />
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <AnnouncementCard
              key={item.id}
              announcement={item}
              isAdmin={isAdmin}
              onEdit={() => setEditing(item)}
              onDelete={() => setDeleting(item)}
              onShare={() => openShare(item)}
              onSubmitted={applySubmission}
            />
          ))}
        </div>
      )}

      {isAdmin && (
        <AnnouncementDialog
          open={creating || editing !== null}
          existing={editing}
          requests={requests}
          onOpenChange={(open) => {
            if (!open) {
              setCreating(false);
              setEditing(null);
            }
          }}
          onSaved={(saved, isNew) => {
            setItems((prev) =>
              prev.some((a) => a.id === saved.id)
                ? prev.map((a) => (a.id === saved.id ? saved : a))
                : [saved, ...prev]
            );
            // Right after posting is when you actually want to tell the group.
            if (isNew) openShare(saved);
          }}
        />
      )}

      <ShareDialog text={sharing} onOpenChange={(open) => !open && setSharing(null)} />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete "${deleting?.title ?? ""}"?`}
        description="This announcement will be removed for everyone. This cannot be undone."
        onConfirm={handleDelete}
      />
    </AppShell>
  );
}

function AnnouncementCard({
  announcement,
  isAdmin,
  onEdit,
  onDelete,
  onShare,
  onSubmitted,
}: {
  announcement: Announcement;
  isAdmin: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onShare: () => void;
  onSubmitted: (requestId: number, submission: Submission) => void;
}) {
  const posted = parseISO(announcement.createdAt);
  const edited = announcement.updatedAt !== announcement.createdAt;
  const authorName = announcement.author?.fullName ?? "Unknown";

  return (
    <article
      id={`a-${announcement.id}`}
      className="scroll-mt-20 rounded-xl bg-card p-4 ring-1 ring-foreground/10 transition-shadow sm:p-5"
    >
      <header className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="font-heading text-base leading-snug font-semibold tracking-tight text-pretty sm:text-lg">
            {announcement.title}
          </h2>
          <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
            <Avatar className="size-5">
              <AvatarFallback className="bg-secondary text-[9px] font-medium text-foreground">
                {initialsOf(authorName)}
              </AvatarFallback>
            </Avatar>
            <span className="truncate">{authorName}</span>
            <span aria-hidden="true">·</span>
            <time dateTime={announcement.createdAt} title={format(posted, "PPpp")}>
              {formatDistanceToNow(posted, { addSuffix: true })}
            </time>
            {edited && (
              <>
                <span aria-hidden="true">·</span>
                <span>edited</span>
              </>
            )}
          </div>
        </div>

        {isAdmin && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="-mt-1 -mr-1 size-9 shrink-0 text-muted-foreground"
                  aria-label="Announcement actions"
                />
              }
            >
              <MoreHorizontal />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={onShare}>
                <Share2 /> Share to WhatsApp
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onEdit}>
                <Pencil /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={onDelete}>
                <Trash2 /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </header>

      <div className="mt-3 border-t border-border pt-3">
        <Markdown>{announcement.description}</Markdown>
      </div>

      {announcement.documents.length > 0 && (
        <section className="mt-4 space-y-2 border-t border-border pt-4">
          <h3 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <FileText className="size-3.5" />
            {isAdmin ? "Linked documents" : "Documents to upload"}
          </h3>
          {announcement.documents.map((request) => (
            <LinkedRequest
              key={request.id}
              request={request}
              isAdmin={isAdmin}
              onSubmitted={onSubmitted}
            />
          ))}
        </section>
      )}
    </article>
  );
}

function AnnouncementDialog({
  open,
  existing,
  requests,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  existing: Announcement | null;
  requests: FileRequest[];
  onOpenChange: (open: boolean) => void;
  onSaved: (announcement: Announcement, isNew: boolean) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tab, setTab] = useState("write");
  const [saving, setSaving] = useState(false);
  const [documentIds, setDocumentIds] = useState<number[]>([]);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  // Load the form when the dialog opens, and clear it once it closes.
  const formKey = existing ? `edit-${existing.id}` : "new";
  if (open && loadedKey !== formKey) {
    setLoadedKey(formKey);
    setTitle(existing?.title ?? "");
    setDescription(existing?.description ?? "");
    setDocumentIds(existing ? existing.documents.map((d) => d.id) : []);
    setTab("write");
  }
  if (!open && loadedKey !== null) {
    setLoadedKey(null);
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(
        existing ? `/api/announcements/${existing.id}` : "/api/announcements",
        {
          method: existing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, description, documentIds }),
        }
      );
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Could not save the announcement");
        return;
      }
      onSaved(await res.json(), !existing);
      toast.success(existing ? "Announcement updated" : "Announcement posted");
      onOpenChange(false);
    } catch {
      toast.error("Connection error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] gap-5 overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {existing ? "Edit announcement" : "New announcement"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              className="h-10"
              maxLength={TITLE_MAX}
              placeholder="Regional qualifier this Saturday"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              autoFocus
            />
          </div>

          <Tabs value={tab} onValueChange={setTab} className="gap-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="description">Description</Label>
              <TabsList className="h-7">
                <TabsTrigger value="write" className="px-2.5 text-xs">
                  Write
                </TabsTrigger>
                <TabsTrigger value="preview" className="px-2.5 text-xs">
                  Preview
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="write" className="space-y-2">
              <Textarea
                id="description"
                className="min-h-48 font-mono text-sm"
                placeholder={"## What's happening\n\nBring your **safety glasses**.\n\n- Meet at 08:00\n- Bus leaves 08:15\n\n[Route map](https://example.com)"}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Markdown supported — headings, <strong>bold</strong>, lists,
                links, tables and code.
              </p>
            </TabsContent>

            <TabsContent value="preview">
              <div className="min-h-48 rounded-lg border border-border bg-muted/30 p-3">
                {description.trim() ? (
                  <Markdown>{description}</Markdown>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Nothing to preview yet.
                  </p>
                )}
              </div>
            </TabsContent>
          </Tabs>

          <div className="space-y-2">
            <Label>Ask for documents</Label>
            {requests.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-3 py-2.5 text-xs text-muted-foreground">
                No document requests yet. Create one on the Documents page and it
                will show up here.
              </p>
            ) : (
              <div className="max-h-40 space-y-0.5 overflow-y-auto rounded-lg border border-border p-1.5">
                {requests.map((request) => {
                  const checked = documentIds.includes(request.id);
                  return (
                    <label
                      key={request.id}
                      className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-muted"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(next) =>
                          setDocumentIds((prev) =>
                            next
                              ? [...prev, request.id]
                              : prev.filter((id) => id !== request.id)
                          )
                        }
                      />
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {request.title}
                        {request.dueDate && (
                          <span className="ml-1.5 text-xs text-muted-foreground">
                            due {format(parseISO(request.dueDate), "MMM d")}
                          </span>
                        )}
                        {request.closedAt && (
                          <span className="ml-1.5 text-xs text-muted-foreground">
                            closed
                          </span>
                        )}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Linked requests appear under the post, with an upload button for
              whoever they apply to.
            </p>
          </div>

          <Button
            type="submit"
            className="h-10 w-full rounded-xl"
            disabled={saving || !title.trim() || !description.trim()}
          >
            {saving && <Spinner />}
            {existing ? "Save changes" : "Post announcement"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
