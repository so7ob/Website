"use client";

/**
 * قائمة صفحات المحتوى — بحث وتصفية حالة، جدول بالعنوانين والمسار والحالة
 * (منشورة/مسودة/قيد المراجعة/مؤرشفة) ونقطة «تغييرات غير منشورة» والترتيب
 * والإصدارات، وإجراءات محمية بالصلاحيات: تحرير، معاينة، نسخة (لاحقة -copy)،
 * تعيين رئيسية، أرشفة. حوار «صفحة جديدة» بتحقق مسار محلي وقالب بداية.
 */
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  Archive,
  Copy,
  ExternalLink,
  FileText,
  Home,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCw,
  Search,
  Star,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getPortalContent } from "@/content/portal";
import { can } from "@/lib/auth/permissions";
import { isValidSlug, type Block } from "@/lib/blocks/types";
import type { Locale } from "@/lib/i18n";
import { apiErrorMessage, apiGet, apiSend, ApiError, buildQuery, fmtRelative } from "@/components/admin/helpers";
import { EmptyState } from "@/components/admin/empty-state";
import { useDebounced } from "@/components/admin/use-debounced";
import type { Me } from "@/components/admin/types";
import { cn } from "@/lib/utils";
import { PAGE_TEMPLATE_OPTIONS, defaultProps } from "@/components/admin/editor/prop-fields";
import { newBlockId, type CreatePageResponse, type PageRow, type PagesResponse } from "@/components/admin/editor/types";

interface PagesClientProps {
  me: Me;
  locale: Locale;
}

const STATUS_TONES: Record<string, string> = {
  published: "border-transparent bg-emerald-100 text-emerald-800",
  draft: "border-transparent bg-secondary text-secondary-foreground",
  in_review: "border-transparent bg-amber-100 text-amber-800",
  archived: "border-transparent bg-slate-200 text-slate-500",
};

/** شارة أيقونة ملونة حسب حالة الصفحة (تشخيص بصرية بجانب الشارة النصية) */
const STATUS_CHIP_TONES: Record<string, string> = {
  published: "bg-emerald-100 text-emerald-800",
  draft: "bg-amber-100 text-amber-800",
  in_review: "bg-skydrop/20 text-brand-strong",
  archived: "bg-muted text-muted-foreground",
};

const DUPLICATE_ATTEMPTS = 5;

export function PagesClient({ me, locale }: PagesClientProps) {
  const t = getPortalContent(locale);
  const tp = t.admin.pages;
  const te = t.admin.editor;
  const router = useRouter();

  const canEdit = can(me, "pages.edit");
  const canDelete = can(me, "pages.delete");

  const [q, setQ] = useState("");
  const debouncedQ = useDebounced(q);
  const [status, setStatus] = useState("all");
  const [reloadToken, setReloadToken] = useState(0);

  const [data, setData] = useState<PagesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (signal: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const query = buildQuery({ q: debouncedQ, status: status !== "all" ? status : "" });
        const res = await apiGet<PagesResponse>(`/api/admin/pages${query}`);
        if (!signal.aborted) setData(res);
      } catch (err) {
        if (!signal.aborted && err instanceof ApiError) setError(apiErrorMessage(err, t.auth.errors));
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    },
    [debouncedQ, status, t.auth.errors]
  );

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load, reloadToken]);

  const reload = () => setReloadToken((v) => v + 1);

  const statusLabel = (value: string): string => {
    if (value === "published") return tp.published;
    if (value === "in_review") return tp.inReview;
    if (value === "archived") return tp.archivedStatus;
    return tp.draft;
  };

  // ——— حوار صفحة جديدة ———
  const [newOpen, setNewOpen] = useState(false);
  const [newTitleAr, setNewTitleAr] = useState("");
  const [newTitleEn, setNewTitleEn] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newTemplate, setNewTemplate] = useState("empty");
  const [creating, setCreating] = useState(false);

  const slugOk = isValidSlug(newSlug);
  const titleOk = newTitleAr.trim() !== "" || newTitleEn.trim() !== "";

  const create = async () => {
    if (creating) return;
    if (!slugOk || !titleOk) return;
    setCreating(true);
    try {
      // قالب البداية يُبنى من نفس خصائص المحرر الافتراضية (صالح حسب zod):
      // إنشاء فارغ ثم PATCH فوري بكتلتَي القالب — يتفادى قالب الخادم القديم
      const res = await apiSend<CreatePageResponse>("/api/admin/pages", "POST", {
        titleAr: newTitleAr.trim(),
        titleEn: newTitleEn.trim(),
        slug: newSlug.trim(),
        template: "empty",
      });
      if (newTemplate === "blank-section") {
        const titleAr = newTitleAr.trim() || newTitleEn.trim();
        const titleEn = newTitleEn.trim() || newTitleAr.trim();
        const build = (title: string): Block[] => [
          { id: newBlockId("pageHeader", []), type: "pageHeader", props: { ...defaultProps("pageHeader"), kicker: title, title } },
          { id: newBlockId("richText", []), type: "richText", props: { ...defaultProps("richText") } },
        ];
        await apiSend(`/api/admin/pages/${res.page.id}`, "PATCH", {
          draftBlocksAr: JSON.stringify(build(titleAr)),
          draftBlocksEn: JSON.stringify(build(titleEn)),
        });
      }
      router.push(`/${locale}/admin/pages/${res.page.id}/edit`);
    } catch (err) {
      if (err instanceof ApiError && (err.code === "slug_taken" || err.code === "invalid_slug")) {
        toast.error(tp.slugHint);
      } else {
        toast.error(apiErrorMessage(err, t.auth.errors));
      }
    } finally {
      setCreating(false);
    }
  };

  // ——— نسخ صفحة ———
  const duplicate = async (row: PageRow) => {
    const base = row.slug || "home";
    for (let attempt = 1; attempt <= DUPLICATE_ATTEMPTS; attempt++) {
      const candidate = attempt === 1 ? `${base}-copy` : `${base}-copy-${attempt}`;
      if (!isValidSlug(candidate)) continue;
      try {
        await apiSend<CreatePageResponse>("/api/admin/pages", "POST", {
          titleAr: row.titleAr,
          titleEn: row.titleEn,
          slug: candidate,
        });
        toast.success(tp.duplicate);
        reload();
        return;
      } catch (err) {
        if (err instanceof ApiError && err.code === "slug_taken") continue; // جرب اللحقة التالية
        toast.error(apiErrorMessage(err, t.auth.errors));
        return;
      }
    }
    toast.error(tp.slugHint);
  };

  // ——— تعيين رئيسية ———
  const setHome = async (row: PageRow) => {
    try {
      await apiSend(`/api/admin/pages/${row.id}`, "PATCH", { isHome: true });
      toast.success(t.admin.users.saved);
      reload();
    } catch (err) {
      toast.error(apiErrorMessage(err, t.auth.errors));
    }
  };

  // ——— أرشفة ———
  const [archiveTarget, setArchiveTarget] = useState<PageRow | null>(null);
  const [archiving, setArchiving] = useState(false);

  const archive = async (row: PageRow) => {
    setArchiving(true);
    try {
      await apiSend(`/api/admin/pages/${row.id}`, "DELETE");
      toast.success(tp.archivedStatus);
      setArchiveTarget(null);
      reload();
    } catch (err) {
      toast.error(apiErrorMessage(err, t.auth.errors));
    } finally {
      setArchiving(false);
    }
  };

  const rows = data?.pages ?? [];

  return (
    <div className="space-y-4">
      {/* الترويسة */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-navy">{tp.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{tp.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="icon" className="size-10" onClick={reload} aria-label={t.admin.users.filterAll} title={tp.updated}>
            <RotateCw className="size-4" aria-hidden="true" />
          </Button>
          {canEdit && (
            <Button type="button" className="min-h-10 rounded-full px-5" onClick={() => setNewOpen(true)}>
              <Plus className="size-4" aria-hidden="true" />
              {tp.createPage}
            </Button>
          )}
        </div>
      </div>

      {/* البحث والتصفية */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tp.title} className="min-h-10 ps-9 focus-visible:ring-2 focus-visible:ring-ring/40" aria-label={tp.title} />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="min-h-10 w-40 focus-visible:ring-2 focus-visible:ring-ring/40" aria-label={tp.status}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.admin.users.filterAll}</SelectItem>
            <SelectItem value="published">{tp.published}</SelectItem>
            <SelectItem value="draft">{tp.draft}</SelectItem>
            <SelectItem value="in_review">{tp.inReview}</SelectItem>
            <SelectItem value="archived">{tp.archivedStatus}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* الجدول */}
      {loading && !data ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <p className="rounded-xl border border-destructive/30 bg-red-50 p-4 text-sm text-destructive">{error}</p>
      ) : rows.length === 0 ? (
        <EmptyState icon={FileText} title={tp.empty} body={tp.emptyBody} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-white shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50 [&_th]:text-xs [&_th]:font-medium [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-muted-foreground">
                <TableHead className="min-w-56">{t.admin.menus.labelAr} / {t.admin.menus.labelEn}</TableHead>
                <TableHead className="min-w-32">{tp.slug}</TableHead>
                <TableHead>{tp.status}</TableHead>
                <TableHead className="text-center">{tp.order}</TableHead>
                <TableHead className="min-w-36">{tp.updated}</TableHead>
                <TableHead className="text-center">{tp.versions}</TableHead>
                <TableHead className="w-12">{t.admin.media.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const archived = row.status === "archived";
                return (
                  <TableRow key={row.id} className={cn("group/row transition-colors hover:bg-muted/50", archived && "opacity-60")}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span
                          aria-hidden="true"
                          className={cn(
                            "flex size-9 shrink-0 items-center justify-center rounded-xl",
                            STATUS_CHIP_TONES[row.status] ?? STATUS_CHIP_TONES.draft
                          )}
                        >
                          <FileText className="size-4" aria-hidden="true" />
                        </span>
                        {row.isHome ? (
                          <Star className="size-4 shrink-0 fill-amber-400 text-amber-500" aria-hidden="true" />
                        ) : null}
                        <div className="min-w-0">
                          <p className={cn("truncate text-sm font-semibold text-navy", archived && "line-through")}>
                            {locale === "en" ? row.titleEn || row.titleAr : row.titleAr || row.titleEn}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {locale === "en" ? row.titleAr : row.titleEn}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="ltr-isolate font-mono text-xs text-muted-foreground" title={row.isHome ? tp.home : undefined}>
                        {row.slug === "" ? "—" : row.slug}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Badge className={STATUS_TONES[row.status] ?? STATUS_TONES.draft}>{statusLabel(row.status)}</Badge>
                        {row.hasUnpublishedChanges && (
                          <span className="size-2 shrink-0 rounded-full bg-amber-500" title={te.unsaved} aria-label={te.unsaved} />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center text-sm tabular-nums text-foreground">{row.order}</TableCell>
                    <TableCell>
                      <p className="text-xs text-muted-foreground">{fmtRelative(row.draftUpdatedAt, locale)}</p>
                      {row.publishedAt && (
                        <p className="text-[11px] text-muted-foreground/70">{tp.published} · {fmtRelative(row.publishedAt, locale)}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-center text-sm tabular-nums text-foreground">{row.versionCount}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-10 text-muted-foreground transition-colors group-hover/row:text-foreground"
                            aria-label={tp.rowActions.replace("{title}", locale === "en" ? row.titleEn || row.titleAr : row.titleAr || row.titleEn)}
                          >
                            <MoreHorizontal className="size-4" aria-hidden="true" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          {canEdit && (
                            <DropdownMenuItem asChild>
                              <Link href={`/${locale}/admin/pages/${row.id}/edit`}>
                                <Pencil className="size-4" aria-hidden="true" />
                                {tp.edit}
                              </Link>
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem asChild>
                            <Link href={`/${locale}/admin/pages/${row.id}/preview`} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="size-4" aria-hidden="true" />
                              {tp.preview}
                            </Link>
                          </DropdownMenuItem>
                          {canEdit && (
                            <DropdownMenuItem onClick={() => void duplicate(row)} disabled={archived}>
                              <Copy className="size-4" aria-hidden="true" />
                              {tp.duplicate}
                            </DropdownMenuItem>
                          )}
                          {canEdit && !row.isHome && !archived && (
                            <DropdownMenuItem onClick={() => void setHome(row)}>
                              <Home className="size-4" aria-hidden="true" />
                              {tp.setHome}
                            </DropdownMenuItem>
                          )}
                          {canDelete && !row.isHome && !archived && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem variant="destructive" onClick={() => setArchiveTarget(row)}>
                                <Archive className="size-4" aria-hidden="true" />
                                {tp.archive}
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ——— حوار صفحة جديدة ——— */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{tp.newPageTitle}</DialogTitle>
            <DialogDescription>{tp.slugHint}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="np-title-ar">{t.admin.menus.labelAr}</Label>
                <Input id="np-title-ar" value={newTitleAr} onChange={(e) => setNewTitleAr(e.target.value)} dir="rtl" className="min-h-10" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="np-title-en">{t.admin.menus.labelEn}</Label>
                <Input id="np-title-en" value={newTitleEn} onChange={(e) => setNewTitleEn(e.target.value)} dir="ltr" className="min-h-10" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="np-slug">{tp.slug}</Label>
              <Input
                id="np-slug"
                value={newSlug}
                onChange={(e) => setNewSlug(e.target.value.toLowerCase())}
                placeholder="about"
                dir="ltr"
                className={cn("min-h-10 font-mono text-xs", newSlug !== "" && !slugOk && "border-destructive focus-visible:ring-destructive")}
              />
              <p className={cn("text-[11px] leading-5", newSlug !== "" && !slugOk ? "text-destructive" : "text-muted-foreground")}>
                {tp.slugHint}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="np-template">{tp.pageTitle}</Label>
              <Select value={newTemplate} onValueChange={setNewTemplate}>
                <SelectTrigger id="np-template" className="min-h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_TEMPLATE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <div className="flex flex-col items-start">
                        <span>{locale === "en" ? opt.label.en : opt.label.ar}</span>
                        <span className="text-[11px] text-muted-foreground">{locale === "en" ? opt.note.en : opt.note.ar}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setNewOpen(false)} disabled={creating}>
              {t.admin.users.cancel}
            </Button>
            <Button type="button" onClick={() => void create()} disabled={creating || !slugOk || !titleOk}>
              {creating ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
              {tp.createPage}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ——— تأكيد الأرشفة ——— */}
      <AlertDialog open={archiveTarget !== null} onOpenChange={(o) => !o && setArchiveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {tp.archive} — {archiveTarget ? (locale === "en" ? archiveTarget.titleEn : archiveTarget.titleAr) : ""}
            </AlertDialogTitle>
            <AlertDialogDescription className="ltr-isolate">
              {archiveTarget ? (archiveTarget.slug === "" ? "/" : `/${archiveTarget.slug}`) : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archiving}>{t.admin.users.cancel}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={archiving}
              onClick={(e) => {
                e.preventDefault();
                if (archiveTarget) void archive(archiveTarget);
              }}
            >
              {archiving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
              {tp.archive}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
