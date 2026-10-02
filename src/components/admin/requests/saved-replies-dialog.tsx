"use client";

/**
 * حوارية إدارة الردود المحفوظة: قائمة القوالب (اسم + معاينة نص) مع تحرير مباشر
 * وحذف بتأكيد ونموذج إضافة — يتشاركها كل الطاقم (القرار في الخادم دائمًا).
 */
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { BookMarked, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { getPortalContent } from "@/content/portal";
import type { Locale } from "@/lib/i18n";
import { apiGet, apiSend, ApiError, apiErrorMessage } from "@/components/admin/helpers";
import type { SavedRepliesResponse, SavedReplyRow } from "../types";
import { EmptyState } from "../empty-state";

interface SavedRepliesDialogProps {
  locale: Locale;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SavedRepliesDialog({ locale, open, onOpenChange }: SavedRepliesDialogProps) {
  const t = getPortalContent(locale);
  const ts = t.admin.savedReplies;

  const [replies, setReplies] = useState<SavedReplyRow[]>([]);
  const [loading, setLoading] = useState(true);

  // نموذج الإضافة
  const [newName, setNewName] = useState("");
  const [newContent, setNewContent] = useState("");
  const [adding, setAdding] = useState(false);

  // التحرير المباشر
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);

  // الحذف
  const [deleteTarget, setDeleteTarget] = useState<SavedReplyRow | null>(null);

  const load = useCallback(
    async (signal: AbortSignal) => {
      setLoading(true);
      try {
        const res = await apiGet<SavedRepliesResponse>("/api/admin/saved-replies");
        if (!signal.aborted) setReplies(res.replies);
      } catch (err) {
        if (!signal.aborted && err instanceof ApiError) toast.error(apiErrorMessage(err, t.auth.errors));
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    },
    [t.auth.errors]
  );

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [open, load]);

  const addReply = async () => {
    const name = newName.trim();
    const content = newContent.trim();
    if (!name || !content || adding) return;
    setAdding(true);
    try {
      await apiSend("/api/admin/saved-replies", "POST", { name, content });
      toast.success(ts.saved);
      setNewName("");
      setNewContent("");
      const controller = new AbortController();
      await load(controller.signal);
    } catch (err) {
      toast.error(apiErrorMessage(err, t.auth.errors));
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (reply: SavedReplyRow) => {
    setEditId(reply.id);
    setEditName(reply.name);
    setEditContent(reply.content);
  };

  const saveEdit = async () => {
    if (!editId || saving) return;
    const name = editName.trim();
    const content = editContent.trim();
    if (!name || !content) return;
    setSaving(true);
    try {
      await apiSend(`/api/admin/saved-replies/${editId}`, "PATCH", { name, content });
      toast.success(ts.saved);
      setEditId(null);
      const controller = new AbortController();
      await load(controller.signal);
    } catch (err) {
      toast.error(apiErrorMessage(err, t.auth.errors));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await apiSend(`/api/admin/saved-replies/${deleteTarget.id}`, "DELETE");
      toast.success(ts.deleted);
      setReplies((prev) => prev.filter((r) => r.id !== deleteTarget.id));
    } catch (err) {
      toast.error(apiErrorMessage(err, t.auth.errors));
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-navy">{ts.title}</DialogTitle>
            <DialogDescription>{ts.subtitle}</DialogDescription>
          </DialogHeader>

          <div className="max-h-[50vh] space-y-3 overflow-y-auto pe-1">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={`sk-${i}`} className="h-20 w-full rounded-xl" />)
            ) : replies.length === 0 ? (
              <EmptyState icon={BookMarked} title={ts.empty} body={ts.emptyBody} />
            ) : (
              replies.map((reply) =>
                editId === reply.id ? (
                  <div key={reply.id} className="space-y-3 rounded-2xl border border-brand/40 bg-accent/40 p-3">
                    <div className="space-y-1.5">
                      <Label htmlFor={`sr-name-${reply.id}`} className="text-xs">
                        {ts.name}
                      </Label>
                      <Input
                        id={`sr-name-${reply.id}`}
                        value={editName}
                        maxLength={80}
                        onChange={(e) => setEditName(e.target.value)}
                        className="min-h-11 focus-visible:ring-2 focus-visible:ring-ring/40"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`sr-content-${reply.id}`} className="text-xs">
                        {ts.content}
                      </Label>
                      <Textarea
                        id={`sr-content-${reply.id}`}
                        value={editContent}
                        maxLength={2000}
                        rows={4}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="min-h-24 resize-y focus-visible:ring-2 focus-visible:ring-ring/40"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" className="min-h-11 rounded-full" onClick={() => setEditId(null)}>
                        <X className="size-4" aria-hidden="true" />
                        {t.admin.users.cancel}
                      </Button>
                      <Button className="min-h-11 rounded-full" onClick={() => void saveEdit()} disabled={saving}>
                        {saving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
                        {ts.save}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div key={reply.id} className="rounded-xl border border-border/70 bg-white p-3 transition-colors hover:bg-muted/50">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-navy">{reply.name}</p>
                        <p className="mt-1 line-clamp-2 whitespace-pre-wrap break-words text-xs leading-relaxed text-muted-foreground">
                          {reply.content}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-10"
                          aria-label={`${ts.edit} — ${reply.name}`}
                          onClick={() => startEdit(reply)}
                        >
                          <Pencil className="size-4" aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-10 text-destructive hover:text-destructive"
                          aria-label={`${ts.delete} — ${reply.name}`}
                          onClick={() => setDeleteTarget(reply)}
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              )
            )}
          </div>

          {/* نموذج الإضافة */}
          <div className="space-y-3 rounded-2xl border border-dashed border-border bg-muted/30 p-3">
            <div className="space-y-1.5">
              <Label htmlFor="sr-new-name" className="text-xs">
                {ts.name}
              </Label>
              <Input
                id="sr-new-name"
                value={newName}
                maxLength={80}
                placeholder={ts.namePlaceholder}
                onChange={(e) => setNewName(e.target.value)}
                className="min-h-11 focus-visible:ring-2 focus-visible:ring-ring/40"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sr-new-content" className="text-xs">
                {ts.content}
              </Label>
              <Textarea
                id="sr-new-content"
                value={newContent}
                maxLength={2000}
                rows={3}
                placeholder={ts.contentPlaceholder}
                onChange={(e) => setNewContent(e.target.value)}
                className="min-h-20 resize-y focus-visible:ring-2 focus-visible:ring-ring/40"
              />
            </div>
            <Button
              onClick={() => void addReply()}
              disabled={adding || !newName.trim() || !newContent.trim()}
              className="min-h-11 rounded-full"
            >
              {adding ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
              {ts.add}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* تأكيد الحذف */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-bold text-navy">
              {ts.delete} — {deleteTarget?.name}
            </AlertDialogTitle>
            <AlertDialogDescription>{ts.confirmDelete}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11 rounded-full">{t.admin.users.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmDelete()} className="min-h-11 rounded-full">
              {ts.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
