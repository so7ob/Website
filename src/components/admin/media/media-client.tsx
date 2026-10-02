"use client";

/**
 * مكتبة الوسائط: رفع (ملف + نص بديل)، شبكة بطاقات بمعاينة، تحرير النص
 * البديل مباشرة (حفظ عند فقدان التركيز)، نسخ الرابط، وحذف بتأكيد.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Upload, Images, Trash2, Link2, Check, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
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
import { getPortalContent } from "@/content/portal";
import { can } from "@/lib/auth/permissions";
import type { Locale } from "@/lib/i18n";
import { EmptyState } from "@/components/admin/empty-state";
import { AdminPagination } from "@/components/admin/pagination";
import { apiGet, apiSend, apiUpload, ApiError, apiErrorMessage, buildQuery, fmtDate, formatBytes } from "@/components/admin/helpers";
import type { MediaResponse, Me, MediaRow } from "../types";
import { cn } from "@/lib/utils";

interface MediaClientProps {
  me: Me;
  locale: Locale;
}

export function MediaClient({ me, locale }: MediaClientProps) {
  const t = getPortalContent(locale);
  const tmed = t.admin.media;

  const [page, setPage] = useState(1);
  const [reloadToken, setReloadToken] = useState(0);
  const [data, setData] = useState<MediaResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [altDraft, setAltDraft] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [deleteTarget, setDeleteTarget] = useState<MediaRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [altEdits, setAltEdits] = useState<Record<string, string>>({});
  const [savingAltId, setSavingAltId] = useState<string | null>(null);

  const mayUpload = can(me, "media.upload");
  const mayManage = can(me, "media.manage");

  const load = useCallback(
    async (signal: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiGet<MediaResponse>(`/api/admin/media${buildQuery({ page })}`);
        if (!signal.aborted) setData(res);
      } catch (err) {
        if (!signal.aborted && err instanceof ApiError) setError(apiErrorMessage(err, t.auth.errors));
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    },
    [page, t.auth.errors]
  );

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load, reloadToken]);

  const reload = () => {
    setAltEdits({});
    setReloadToken((v) => v + 1);
  };

  const upload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast.error(t.auth.errors.required);
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("altText", altDraft.trim());
      await apiUpload("/api/admin/media", form);
      toast.success(tmed.uploadedOk);
      setAltDraft("");
      if (fileRef.current) fileRef.current.value = "";
      setPage(1);
      reload();
    } catch (err) {
      if (err instanceof ApiError && (err.code === "too_large" || err.code === "file_too_large")) {
        toast.error(t.account.detail.fileTooLarge);
      } else if (err instanceof ApiError && (err.code === "type_not_allowed" || err.code === "extension_mismatch")) {
        toast.error(t.account.detail.fileTypeInvalid);
      } else {
        toast.error(apiErrorMessage(err, t.auth.errors));
      }
    } finally {
      setUploading(false);
    }
  };

  const saveAlt = async (item: MediaRow) => {
    const value = altEdits[item.id];
    if (value === undefined || value === (item.altText ?? "")) return;
    setSavingAltId(item.id);
    try {
      await apiSend(`/api/admin/media/${item.id}`, "PATCH", { altText: value });
      toast.success(t.admin.users.saved);
      reload();
    } catch (err) {
      toast.error(apiErrorMessage(err, t.auth.errors));
    } finally {
      setSavingAltId(null);
    }
  };

  const copyUrl = async (item: MediaRow) => {
    try {
      const absolute = new URL(item.url, window.location.origin).toString();
      await navigator.clipboard.writeText(absolute);
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 1600);
    } catch {
      toast.error(t.auth.errors.generic);
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiSend(`/api/admin/media/${deleteTarget.id}`, "DELETE");
      toast.success(tmed.deleted);
      setDeleteTarget(null);
      reload();
    } catch (err) {
      toast.error(apiErrorMessage(err, t.auth.errors));
    } finally {
      setDeleting(false);
    }
  };

  const media = data?.media ?? [];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-brand-strong">
          <Images className="size-5" aria-hidden="true" />
        </span>
        <div>
          <h1 className="text-2xl font-bold text-navy">{tmed.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{tmed.subtitle}</p>
        </div>
      </div>

      {/* بطاقة الرفع */}
      {mayUpload ? (
        <section className="rounded-2xl border border-dashed border-border bg-white p-5 transition-colors hover:border-brand hover:bg-accent/30">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-brand-strong">
              <Upload className="size-5" aria-hidden="true" />
            </span>
            <h2 className="text-base font-semibold text-navy">{tmed.upload}</h2>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
            <div className="space-y-2">
              <Label htmlFor="media-file">{tmed.filename}</Label>
              <Input
                id="media-file"
                ref={fileRef}
                type="file"
                accept="image/*"
                className="min-h-11 cursor-pointer file:me-2 file:cursor-pointer file:rounded-full file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-brand-strong"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="media-alt">{tmed.alt}</Label>
              <Input
                id="media-alt"
                value={altDraft}
                onChange={(e) => setAltDraft(e.target.value)}
                maxLength={300}
                className="min-h-11 focus-visible:ring-2 focus-visible:ring-ring/40"
              />
            </div>
            <Button onClick={upload} disabled={uploading} className="min-h-11 rounded-full">
              {uploading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Upload className="size-4" aria-hidden="true" />}
              {tmed.upload}
            </Button>
          </div>
        </section>
      ) : null}

      {error ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="icon" onClick={reload} className="size-10 shrink-0" aria-label={tmed.title}>
            <RotateCcw className="size-4" aria-hidden="true" />
          </Button>
        </div>
      ) : null}

      {/* الشبكة */}
      {loading && !data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-2xl" />
          ))}
        </div>
      ) : media.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-white">
          <EmptyState icon={Images} title={tmed.empty} />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {media.map((item) => (
            <article key={item.id} className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-white transition-all hover:border-brand/40 hover:shadow-sm">
              <div className="relative m-3 mb-0 aspect-video overflow-hidden rounded-xl border border-border bg-muted">
                <img
                  src={item.url}
                  alt={item.altText ?? item.filename}
                  loading="lazy"
                  className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                />
                {/* طبقة الإجراءات عند التحويم — تبقى ظاهرة على الشاشات الصغيرة (اللمس) */}
                <div className="absolute inset-0 flex items-center justify-center gap-2 bg-navy/60 opacity-100 transition-opacity duration-300 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-11 rounded-full bg-white/90 text-navy shadow-sm backdrop-blur transition-colors hover:bg-white hover:text-navy"
                    onClick={() => void copyUrl(item)}
                    aria-label={tmed.copyUrl}
                    title={tmed.copyUrl}
                  >
                    {copiedId === item.id ? (
                      <Check className="size-4 text-emerald-600" aria-hidden="true" />
                    ) : (
                      <Link2 className="size-4" aria-hidden="true" />
                    )}
                  </Button>
                  {mayManage ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-11 rounded-full bg-white/90 text-destructive shadow-sm backdrop-blur transition-colors hover:bg-white hover:text-destructive"
                      onClick={() => setDeleteTarget(item)}
                      aria-label={tmed.delete}
                      title={tmed.delete}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </Button>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-1 flex-col gap-2 p-3">
                <p className="truncate font-mono text-xs font-medium text-navy ltr-isolate" title={item.filename}>
                  {item.filename}
                </p>
                <p className="text-xs tabular-nums text-muted-foreground">
                  {formatBytes(item.size)} · {fmtDate(item.createdAt, locale)} · {item.uploadedBy}
                </p>
                {mayManage ? (
                  <Input
                    value={altEdits[item.id] ?? item.altText ?? ""}
                    onChange={(e) => setAltEdits((prev) => ({ ...prev, [item.id]: e.target.value }))}
                    onBlur={() => saveAlt(item)}
                    placeholder={tmed.alt}
                    aria-label={`${tmed.alt} — ${item.filename}`}
                    maxLength={300}
                    className={cn("min-h-10 text-xs focus-visible:ring-2 focus-visible:ring-ring/40", savingAltId === item.id && "opacity-60")}
                  />
                ) : (
                  <p className="text-xs text-muted-foreground">{item.altText ?? tmed.alt}</p>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {data ? (
        <AdminPagination page={page} total={data.total} pageSize={data.pageSize} locale={locale} onPage={setPage} />
      ) : null}

      {/* تأكيد الحذف */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-navy">
              {tmed.delete} — {deleteTarget?.filename}
            </AlertDialogTitle>
            <AlertDialogDescription>{tmed.confirmDelete}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11 rounded-full">{t.admin.users.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={remove} disabled={deleting} className="min-h-11 rounded-full">
              {deleting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
              {tmed.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
