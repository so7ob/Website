"use client";

/**
 * مكتبة الوسائط (§7): رفع بمجلد، بحث فوري، تصفية بمجلدات، شارة استخدام
 * لكل عنصر (عدد المواضع)، نقل بين المجلدات، وحذف محمي بحاجز الاستخدام —
 * الوسيلة المستخدمة في صفحة/قالب/صورة مشاركة تُرفض بالحذف مع قائمة المواضع.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Upload, Images, Trash2, Link2, Check, Loader2, RotateCcw, Search,
  FolderOpen, ShieldAlert, Layers, CircleSlash, CircleCheckBig,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import type { MediaResponse, Me, MediaRow, MediaUsageLocationView } from "../types";
import { cn } from "@/lib/utils";

interface MediaClientProps {
  me: Me;
  locale: Locale;
}

export function MediaClient({ me, locale }: MediaClientProps) {
  const t = getPortalContent(locale);
  const tmed = t.admin.media;

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [folder, setFolder] = useState<string>("");
  // حالة الاستخدام: all | in_use | unused — مع شارة إجمالي غير المستخدم (جولة 37)
  const [usage, setUsage] = useState<"all" | "in_use" | "unused">("all");
  const [reloadToken, setReloadToken] = useState(0);
  const [data, setData] = useState<MediaResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [altDraft, setAltDraft] = useState("");
  const [folderDraft, setFolderDraft] = useState("general");
  const fileRef = useRef<HTMLInputElement>(null);
  const [deleteTarget, setDeleteTarget] = useState<MediaRow | null>(null);
  const [blockedUsage, setBlockedUsage] = useState<{ item: MediaRow; usage: MediaUsageLocationView[] } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [altEdits, setAltEdits] = useState<Record<string, string>>({});
  const [savingAltId, setSavingAltId] = useState<string | null>(null);
  const [movingFolderId, setMovingFolderId] = useState<string | null>(null);

  const mayUpload = can(me, "media.upload");
  const mayManage = can(me, "media.manage");

  // بحث بترسيب — لا طلب لكل ضربة مفتاح
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const load = useCallback(
    async (signal: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiGet<MediaResponse>(`/api/admin/media${buildQuery({ page, search, folder, usage: usage === "all" ? undefined : usage })}`);
        if (!signal.aborted) setData(res);
      } catch (err) {
        if (!signal.aborted && err instanceof ApiError) setError(apiErrorMessage(err, t.auth.errors));
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    },
    [page, search, folder, usage, t.auth.errors]
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
      form.append("folder", folderDraft.trim() || "general");
      await apiUpload("/api/admin/media", form);
      toast.success(tmed.uploadedOk);
      setAltDraft("");
      if (fileRef.current) fileRef.current.value = "";
      setFolder(folderDraft.trim() || "general");
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

  const moveToFolder = async (item: MediaRow, next: string) => {
    if (next === item.folder) return;
    setMovingFolderId(item.id);
    try {
      await apiSend(`/api/admin/media/${item.id}`, "PATCH", { folder: next });
      toast.success(tmed.folderSaved);
      reload();
    } catch (err) {
      toast.error(apiErrorMessage(err, t.auth.errors));
    } finally {
      setMovingFolderId(null);
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

  const requestDelete = (item: MediaRow) => {
    // الحذف يمر دائمًا عبر الخادم — حاجز الاستخدام (409) يعيد قائمة المواضع
    // بالتفصيل فيعرضها الحوار أسفل الرفض
    setDeleteTarget(item);
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
      if (err instanceof ApiError && err.code === "media_in_use") {
        const body = err.body as { usage?: MediaUsageLocationView[] } | undefined;
        setDeleteTarget(null);
        setBlockedUsage({ item: deleteTarget, usage: body?.usage ?? [] });
      } else {
        toast.error(apiErrorMessage(err, t.auth.errors));
      }
    } finally {
      setDeleting(false);
    }
  };

  const folders = useMemo(() => {
    const fromData = data?.folders ?? [];
    if (folderDraft.trim() && !fromData.includes(folderDraft.trim())) {
      return [...fromData, folderDraft.trim()].sort((a, b) => a.localeCompare(b));
    }
    return fromData;
  }, [data?.folders, folderDraft]);

  const media = data?.media ?? [];
  const usageKindLabel = (kind: MediaUsageLocationView["kind"]) => {
    if (kind === "page_published") return tmed.usagePagePublished;
    if (kind === "page_draft") return tmed.usagePageDraft;
    if (kind === "page_og") return tmed.usagePageOg;
    return tmed.usageTemplate;
  };

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
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,180px)_auto] lg:items-end">
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
            <div className="space-y-2">
              <Label htmlFor="media-folder">{tmed.folderUpload}</Label>
              <Input
                id="media-folder"
                value={folderDraft}
                onChange={(e) => setFolderDraft(e.target.value)}
                maxLength={60}
                placeholder="general"
                dir="ltr"
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

      {/* شريط البحث والمجلدات */}
      <div className="space-y-3">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={tmed.searchPlaceholder}
            aria-label={tmed.search}
            className="min-h-11 rounded-full ps-10 focus-visible:ring-2 focus-visible:ring-ring/40"
          />
        </div>
        {folders.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={tmed.folder}>
            <button
              type="button"
              onClick={() => { setFolder(""); setPage(1); }}
              aria-pressed={folder === ""}
              className={cn(
                "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 text-xs font-medium transition-colors",
                folder === ""
                  ? "border-brand bg-brand text-white shadow-sm"
                  : "border-border bg-white text-muted-foreground hover:border-brand/40 hover:text-brand-strong"
              )}
            >
              <Layers className="size-3.5" aria-hidden="true" />
              {tmed.allFolders}
            </button>
            {folders.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => { setFolder(f); setPage(1); }}
                aria-pressed={folder === f}
                dir="ltr"
                className={cn(
                  "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 text-xs font-medium transition-colors",
                  folder === f
                    ? "border-brand bg-brand text-white shadow-sm"
                    : "border-border bg-white text-muted-foreground hover:border-brand/40 hover:text-brand-strong"
                )}
              >
                <FolderOpen className="size-3.5" aria-hidden="true" />
                {f}
              </button>
            ))}
          </div>
        )}
        {/* تصفية بحالة الاستخدام — شارة إجمالي غير المستخدم على الفلتر نفسه (جولة 37) */}
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={tmed.usageFilterLabel}>
          {([
            { key: "all", label: tmed.usageFilterAll, icon: Layers, count: null as number | null },
            { key: "in_use", label: tmed.usageFilterInUse, icon: CircleCheckBig, count: null as number | null },
            { key: "unused", label: tmed.usageFilterUnused, icon: CircleSlash, count: data?.unusedTotal ?? 0 },
          ] as const).map(({ key, label, icon: Icon, count }) => (
            <button
              key={key}
              type="button"
              onClick={() => { setUsage(key); setPage(1); }}
              aria-pressed={usage === key}
              className={cn(
                "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 text-xs font-medium transition-colors",
                usage === key
                  ? key === "unused"
                    ? "border-amber-600 bg-amber-600 text-white shadow-sm"
                    : "border-brand bg-brand text-white shadow-sm"
                  : key === "unused" && count > 0
                    ? "border-amber-300 bg-amber-50 text-amber-800 hover:border-amber-500"
                    : "border-border bg-white text-muted-foreground hover:border-brand/40 hover:text-brand-strong"
              )}
            >
              <Icon className="size-3.5" aria-hidden="true" />
              {label}
              {key === "unused" && count > 0 && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-px text-[10px] font-bold tabular-nums",
                    usage === "unused" ? "bg-white/25 text-white" : "bg-amber-200/80 text-amber-900"
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

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
            <Skeleton key={i} className="h-72 rounded-2xl" />
          ))}
        </div>
      ) : media.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-white">
          <EmptyState
            icon={Images}
            title={search || folder || usage !== "all" ? tmed.noResults : tmed.empty}
          />
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
                {/* شارة الاستخدام — أعلى الزاوية دائمًا ظاهرة */}
                <span
                  className={cn(
                    "absolute end-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold shadow-sm backdrop-blur",
                    item.usageCount > 0 ? "bg-emerald-600/90 text-white" : "bg-white/90 text-muted-foreground"
                  )}
                >
                  {item.usageCount > 0 ? (
                    <>
                      <Check className="size-3" aria-hidden="true" />
                      {tmed.inUse} · {item.usageCount}
                    </>
                  ) : (
                    tmed.unused
                  )}
                </span>
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
                      onClick={() => requestDelete(item)}
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
                  <div className="grid gap-2">
                    <Input
                      value={altEdits[item.id] ?? item.altText ?? ""}
                      onChange={(e) => setAltEdits((prev) => ({ ...prev, [item.id]: e.target.value }))}
                      onBlur={() => saveAlt(item)}
                      placeholder={tmed.alt}
                      aria-label={`${tmed.alt} — ${item.filename}`}
                      maxLength={300}
                      className={cn("min-h-10 text-xs focus-visible:ring-2 focus-visible:ring-ring/40", savingAltId === item.id && "opacity-60")}
                    />
                    <div className="flex items-center gap-2">
                      <FolderOpen className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <Select value={item.folder} onValueChange={(v) => void moveToFolder(item, v)} disabled={movingFolderId === item.id}>
                        <SelectTrigger
                          className="min-h-9 flex-1 text-xs focus-visible:ring-2 focus-visible:ring-ring/40"
                          aria-label={`${tmed.moveFolder} — ${item.filename}`}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {folders.map((f) => (
                            <SelectItem key={f} value={f} dir="ltr" className="text-xs">
                              {f}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <FolderOpen className="size-3.5 shrink-0" aria-hidden="true" />
                    <span dir="ltr">{item.folder}</span>
                  </div>
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
            <AlertDialogAction onClick={remove} disabled={deleting} className="min-h-11 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
              {tmed.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* حاجز الحذف — الوسيلة مستخدمة */}
      <AlertDialog open={blockedUsage !== null} onOpenChange={(open) => { if (!open) setBlockedUsage(null); }}>
        <AlertDialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-navy">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                <ShieldAlert className="size-4" aria-hidden="true" />
              </span>
              {tmed.deleteBlockedTitle}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {blockedUsage?.item.filename}
              {blockedUsage && blockedUsage.usage.length > 0 ? ` — ${tmed.deleteBlockedDesc}` : ` — ${tmed.usedWhere}`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {blockedUsage && blockedUsage.usage.length > 0 ? (
            <ul className="max-h-64 space-y-1.5 overflow-y-auto rounded-xl border border-border bg-accent/30 p-3 text-sm">
              {blockedUsage.usage.map((u, i) => (
                <li key={`${u.entityId}-${u.kind}-${u.locale ?? "og"}-${i}`} className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium text-navy">
                    {locale === "en" ? u.titleEn : u.titleAr}
                    {u.archived ? <span className="ms-1.5 text-xs font-normal text-muted-foreground">({tmed.usageArchived})</span> : null}
                    {u.locale ? <span className="ms-1.5 text-xs text-muted-foreground">({u.locale.toUpperCase()})</span> : null}
                  </span>
                  <Badge variant="secondary" className="shrink-0 text-[10px]">
                    {usageKindLabel(u.kind)}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : blockedUsage ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {tmed.inUse} · {blockedUsage.item.usageCount}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => setBlockedUsage(null)}
              className="min-h-11 rounded-full"
            >
              {t.admin.users.cancel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
