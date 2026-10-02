"use client";

/**
 * منتقي الوسائط — حوار شبكة مكتبة الوسائط مع رفع ملف وتحرير النص البديل
 * مباشرة، واختيار عنصر يعيد رابطه (/api/media/{id}) لحقل المصدر.
 * يستخدم في حقول الصور في نموذج الخصائص.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ImagePlus, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { getPortalContent } from "@/content/portal";
import { can } from "@/lib/auth/permissions";
import type { Locale } from "@/lib/i18n";
import { apiErrorMessage, apiGet, apiSend, apiUpload, formatBytes } from "@/components/admin/helpers";
import { ApiError } from "@/components/admin/helpers";
import { AdminPagination } from "@/components/admin/pagination";
import type { Me } from "@/components/admin/types";
import type { MediaListResponse, MediaUploadResponse } from "./types";

interface MediaPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  me: Me;
  locale: Locale;
  onSelect: (url: string) => void;
}

const PAGE_SIZE_FALLBACK = 24;

export function MediaPicker({ open, onOpenChange, me, locale, onSelect }: MediaPickerProps) {
  const t = getPortalContent(locale);
  const tm = t.admin.media;
  const te = t.admin.editor;

  const [data, setData] = useState<MediaListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [altDraft, setAltDraft] = useState<Record<string, string>>({});

  const canUpload = can(me, "media.upload");
  const canManage = can(me, "media.manage");

  const load = useCallback(
    async (signal: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiGet<MediaListResponse>(`/api/admin/media?page=${page}`);
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
    if (!open) return;
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [open, load]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / (data.pageSize || PAGE_SIZE_FALLBACK))) : 1;

  const pick = (url: string) => {
    onSelect(url);
    onOpenChange(false);
  };

  const upload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("altText", "");
      const res = await apiUpload<MediaUploadResponse>("/api/admin/media", form);
      toast.success(tm.uploadedOk);
      if (fileRef.current) fileRef.current.value = "";
      // حدّث الشبكة ثم اختر الملف المرفوع فورًا
      const refreshed = await apiGet<MediaListResponse>("/api/admin/media?page=1");
      setData(refreshed);
      setPage(1);
      pick(res.media.url);
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

  const saveAlt = async (id: string) => {
    const value = altDraft[id];
    if (value === undefined) return;
    try {
      await apiSend(`/api/admin/media/${id}`, "PATCH", { altText: value });
      setData((prev) =>
        prev ? { ...prev, media: prev.media.map((m) => (m.id === id ? { ...m, altText: value || null } : m)) } : prev
      );
      toast.success(t.admin.users.saved);
    } catch (err) {
      toast.error(apiErrorMessage(err, t.auth.errors));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto rounded-2xl sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-navy">{te.mediaLibrary}</DialogTitle>
          <DialogDescription>{tm.subtitle}</DialogDescription>
        </DialogHeader>

        {canUpload && (
          <div className="flex flex-wrap items-end gap-3 rounded-xl border border-dashed border-border p-4 transition-colors hover:border-brand hover:bg-accent/30">
            <div className="min-w-48 flex-1 space-y-1.5">
              <Label htmlFor="media-picker-file">{tm.filename}</Label>
              <Input
                id="media-picker-file"
                type="file"
                accept="image/*"
                ref={fileRef}
                disabled={uploading}
                className="min-h-11 cursor-pointer file:me-2 file:cursor-pointer file:rounded-full file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-brand-strong"
              />
            </div>
            <Button onClick={() => void upload()} disabled={uploading} className="min-h-11 rounded-full">
              {uploading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Upload className="size-4" aria-hidden="true" />}
              {tm.upload}
            </Button>
          </div>
        )}

        {loading && !data && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-36 rounded-xl" />
            ))}
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        {data && data.media.length === 0 && !loading && (
          <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
            <ImagePlus className="size-8" aria-hidden="true" />
            <p className="text-sm">{tm.empty}</p>
          </div>
        )}

        {data && data.media.length > 0 && (
          <>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {data.media.map((item) => (
                <li key={item.id} className="overflow-hidden rounded-xl border border-border bg-white transition-all hover:border-brand/40 hover:shadow-sm">
                  <button
                    type="button"
                    onClick={() => pick(item.url)}
                    className="group relative block w-full cursor-pointer focus-visible:outline-none"
                    aria-label={`${te.mediaLibrary}: ${item.filename}`}
                  >
                    <span className="block aspect-[4/3] w-full overflow-hidden bg-muted">
                      <img
                        src={item.url}
                        alt={item.altText ?? item.filename}
                        loading="lazy"
                        className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    </span>
                    {/* لمسة التحديد: غشاوة ولمعة تظهر عند التحويم/التركيز قبل الإدراج */}
                    <span
                      className="pointer-events-none absolute inset-0 bg-accent/60 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100"
                      aria-hidden="true"
                    />
                    <span
                      className="pointer-events-none absolute inset-0 opacity-0 ring-2 ring-inset ring-brand transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100"
                      aria-hidden="true"
                    />
                  </button>
                  <div className="space-y-1.5 p-2.5">
                    <p className="truncate font-mono text-xs font-medium text-navy" dir="ltr" title={item.filename}>
                      {item.filename}
                    </p>
                    <p className="text-[11px] tabular-nums text-muted-foreground">{formatBytes(item.size)}</p>
                    {canManage && (
                      <Input
                        value={altDraft[item.id] ?? item.altText ?? ""}
                        onChange={(e) => setAltDraft((prev) => ({ ...prev, [item.id]: e.target.value }))}
                        onBlur={() => void saveAlt(item.id)}
                        placeholder={tm.alt}
                        className="min-h-10 text-xs focus-visible:ring-2 focus-visible:ring-ring/40"
                        aria-label={`${tm.alt}: ${item.filename}`}
                      />
                    )}
                  </div>
                </li>
              ))}
            </ul>

            <AdminPagination
              page={page}
              total={data.total}
              pageSize={data.pageSize || PAGE_SIZE_FALLBACK}
              locale={locale}
              onPage={setPage}
              className="justify-between"
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** زر حقل وسائط: إدخال نصي + زر فتح المنتقي */
export function MediaField({
  value,
  onChange,
  onOpenPicker,
  locale,
  id,
}: {
  value: string;
  onChange: (next: string) => void;
  onOpenPicker: () => void;
  locale: Locale;
  id: string;
}) {
  const te = getPortalContent(locale).admin.editor;
  return (
    <div className="flex gap-2">
      <Input
        id={id}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder="/api/media/…"
        dir="ltr"
        className="font-mono text-xs focus-visible:ring-2 focus-visible:ring-ring/40"
      />
      <Button type="button" variant="outline" size="icon" className="size-10 shrink-0" onClick={onOpenPicker} aria-label={te.mediaLibrary}>
        <ImagePlus className="size-4" aria-hidden="true" />
      </Button>
    </div>
  );
}
