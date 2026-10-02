"use client";

/**
 * حوار قوالب الصفحات (§5) — يعرض القوالب المدمجة والمخصصة بتطبيق آمن:
 * - تطبيق قالب: تأكيد + لقطة احتياطية تلقائية في الخادم قبل الاستبدال.
 * - حفظ المحتوى الحالي كقالب: من لغة المسودة النشطة فقط.
 * - إعادة تسمية/تعديل وصف القوالب المخصصة (§D جولة 34) — المدمجة للقراءة.
 * - حذف القوالب المخصصة فقط (المدمجة للقراءة).
 * - أعداد الاستخدام والعناصر مُصرَّفة صياغيًا (arabicCountPhrase — مفرد/مثنى/جمع).
 * المحرر يعيد تحميل المسودة بعد التطبيق عبر onApplied — فتُصفَّر الواجهة
 * والمراجعة والتاريخ من مصدر الحقيقة الوحيد (الخادم).
 */
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, FileStack, Loader2, LayoutTemplate, Pencil, Sparkles, Trash2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { getPortalContent } from "@/content/portal";
import type { Locale } from "@/lib/i18n";
import { arabicCountPhrase } from "@/lib/i18n/ar-plural";
import { apiErrorMessage, apiGet, apiSend, ApiError, fmtDateTime } from "@/components/admin/helpers";
import { cn } from "@/lib/utils";
import type { DraftLocale } from "./types";
import { TemplatePreview } from "./template-preview";

interface TemplateItem {
  id: string;
  key: string | null;
  nameAr: string;
  nameEn: string;
  descAr: string | null;
  descEn: string | null;
  kind: string; // builtin | custom
  hasAr: boolean;
  hasEn: boolean;
  /** بصمة معاينة مصغرة — أنواع الكتل العلوية بترتيبها (جولة 37) */
  arPreview: string[];
  enPreview: string[];
  arNodeCount: number;
  enNodeCount: number;
  usageCount: number;
  createdBy: string | null;
  updatedAt: string;
}

interface TemplatesResponse {
  ok: boolean;
  templates: TemplateItem[];
}

interface ApplyResponse {
  ok: boolean;
  page: { id: string; draftRevision: number; backupCreated: boolean };
}

interface TemplatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pageId: string;
  locale: Locale;
  draftLocale: DraftLocale; // لغة المسودة النشطة — التطبيق والحفظ يبدآن منها
  baseRevision: number;
  currentEnvelope: string | null; // مغلف المسودة الحالية للغة النشطة (لحفظ كقالب)
  canEdit: boolean; // pages.edit
  onApplied: () => void; // يعيد المحرر تحميل المسودة بعد التطبيق
}

export function TemplatesDialog({
  open,
  onOpenChange,
  pageId,
  locale,
  draftLocale,
  baseRevision,
  currentEnvelope,
  canEdit,
  onApplied,
}: TemplatesDialogProps) {
  const t = getPortalContent(locale);
  const tt = t.admin.templates;
  const te = t.admin.editor;

  const [filter, setFilter] = useState<"all" | "builtin" | "custom">("all");
  const [data, setData] = useState<TemplatesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmTemplate, setConfirmTemplate] = useState<TemplateItem | null>(null);
  const [applying, setApplying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [nameAr, setNameAr] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [descAr, setDescAr] = useState("");
  const [descEn, setDescEn] = useState("");
  const [deleteTemplate, setDeleteTemplate] = useState<TemplateItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [renameTemplate, setRenameTemplate] = useState<TemplateItem | null>(null);
  const [renameNameAr, setRenameNameAr] = useState("");
  const [renameNameEn, setRenameNameEn] = useState("");
  const [renameDescAr, setRenameDescAr] = useState("");
  const [renameDescEn, setRenameDescEn] = useState("");
  const [renaming, setRenaming] = useState(false);

  const load = useCallback(
    async (signal: AbortSignal) => {
      setLoading(true);
      try {
        const res = await apiGet<TemplatesResponse>("/api/admin/templates");
        if (!signal.aborted) setData(res);
      } catch (err) {
        if (!signal.aborted) {
          toast.error(err instanceof ApiError ? apiErrorMessage(err, t.auth.errors) : tt.loadFailed);
        }
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    },
    [t.auth.errors, tt.loadFailed]
  );

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [open, load]);

  const templates = (data?.templates ?? []).filter((tpl) => filter === "all" || tpl.kind === filter);
  const nameOf = (tpl: TemplateItem) => (locale === "en" ? tpl.nameEn : tpl.nameAr);
  const descOf = (tpl: TemplateItem) => (locale === "en" ? tpl.descEn : tpl.descAr);
  const nodesOf = (tpl: TemplateItem) => (draftLocale === "en" ? tpl.enNodeCount : tpl.arNodeCount);
  const previewOf = (tpl: TemplateItem) => (draftLocale === "en" ? tpl.enPreview : tpl.arPreview);

  /** تصريف العدد حسب اللغة — العربية 4 صيغ (مفرد/مثنى/جمع/مفرد منصوب) والإنجليزية صيغتان */
  const usageLabel = (n: number) =>
    locale === "ar"
      ? arabicCountPhrase(n, { one: tt.usageCountOne, two: tt.usageCountTwo, few: tt.usageCountFew, many: tt.usageCountMany })
      : n === 1
        ? tt.usageCountOne
        : n === 2
          ? tt.usageCountTwo
          : tt.usageCountMany;
  const nodesLabel = (n: number) =>
    locale === "ar"
      ? arabicCountPhrase(n, { one: tt.nodesCountOne, two: tt.nodesCountTwo, few: tt.nodesCountFew, many: tt.nodesCountMany })
      : n === 1
        ? tt.nodesCountOne
        : n === 2
          ? tt.nodesCountTwo
          : tt.nodesCountMany;

  const openRename = (tpl: TemplateItem) => {
    setRenameTemplate(tpl);
    setRenameNameAr(tpl.nameAr);
    setRenameNameEn(tpl.nameEn);
    setRenameDescAr(tpl.descAr ?? "");
    setRenameDescEn(tpl.descEn ?? "");
  };

  const saveRename = async () => {
    if (!renameTemplate) return;
    setRenaming(true);
    try {
      const res = await apiSend<{ ok: boolean; template: TemplateItem }>(`/api/admin/templates/${renameTemplate.id}`, "PATCH", {
        nameAr: renameNameAr,
        nameEn: renameNameEn,
        descAr: renameDescAr,
        descEn: renameDescEn,
      });
      toast.success(tt.renamedOk);
      setRenameTemplate(null);
      // تحديث في المكان — نستبدل العنصر المحدّث فقط ونبقي ترتيب القائمة
      setData((prev) =>
        prev ? { ok: true, templates: prev.templates.map((tpl) => (tpl.id === res.template.id ? res.template : tpl)) } : prev
      );
    } catch (err) {
      if (err instanceof ApiError && err.code === "builtin_readonly") {
        toast.error(tt.builtinReadonly);
      } else {
        toast.error(apiErrorMessage(err, t.auth.errors) || tt.renameFailed);
      }
    } finally {
      setRenaming(false);
    }
  };

  const apply = async () => {
    if (!confirmTemplate) return;
    setApplying(true);
    try {
      await apiSend<ApplyResponse>(`/api/admin/templates/${confirmTemplate.id}/apply`, "POST", {
        pageId,
        locale: draftLocale,
        baseRevision,
      });
      toast.success(tt.appliedOk);
      setConfirmTemplate(null);
      onApplied();
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError && err.code === "template_locale_missing") {
        toast.error(tt.missingLocale);
      } else if (err instanceof ApiError && (err.code === "conflict" || err.code === "revision_required")) {
        toast.error(tt.conflict);
      } else {
        toast.error(apiErrorMessage(err, t.auth.errors));
      }
    } finally {
      setApplying(false);
    }
  };

  const saveAsTemplate = async () => {
    if (!nameAr.trim() && !nameEn.trim()) {
      toast.error(tt.nameRequired);
      return;
    }
    if (!currentEnvelope) return;
    setSaving(true);
    try {
      await apiSend<TemplatesResponse>("/api/admin/templates", "POST", {
        nameAr: nameAr.trim(),
        nameEn: nameEn.trim(),
        descAr: descAr.trim(),
        descEn: descEn.trim(),
        [draftLocale === "en" ? "blocksEn" : "blocksAr"]: currentEnvelope,
      });
      toast.success(tt.savedOk);
      setNameAr("");
      setNameEn("");
      setDescAr("");
      setDescEn("");
      setShowSaveForm(false);
      const controller = new AbortController();
      void load(controller.signal);
    } catch (err) {
      toast.error(apiErrorMessage(err, t.auth.errors) || tt.saveFailed);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleteTemplate) return;
    setDeleting(true);
    try {
      await apiSend(`/api/admin/templates/${deleteTemplate.id}`, "DELETE");
      toast.success(tt.deletedOk);
      setDeleteTemplate(null);
      setData((prev) =>
        prev ? { ok: true, templates: prev.templates.filter((tpl) => tpl.id !== deleteTemplate.id) } : prev
      );
    } catch (err) {
      if (err instanceof ApiError && err.code === "builtin_readonly") {
        toast.error(tt.builtinReadonly);
      } else {
        toast.error(apiErrorMessage(err, t.auth.errors));
      }
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden rounded-2xl sm:max-w-2xl">
          <DialogHeader className="pb-1">
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-navy">
              <LayoutTemplate className="size-5 text-brand" aria-hidden="true" />
              {tt.title}
            </DialogTitle>
            <DialogDescription>{tt.subtitle}</DialogDescription>
          </DialogHeader>

          {/* حفظ كقالب — مطوي أنيق أعلى القائمة */}
          {canEdit && (
            <div className="rounded-xl border border-brand/25 bg-gradient-to-l from-accent/60 via-accent/30 to-transparent p-3">
              {showSaveForm ? (
                <div className="space-y-3">
                  <p className="flex items-center gap-2 text-sm font-semibold text-navy">
                    <Sparkles className="size-4 text-brand" aria-hidden="true" />
                    {tt.saveFromCurrent}
                  </p>
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    <Input
                      value={nameAr}
                      onChange={(e) => setNameAr(e.target.value)}
                      placeholder={tt.formNameAr}
                      maxLength={120}
                      className="min-h-10 rounded-lg bg-white"
                      aria-label={tt.formNameAr}
                    />
                    <Input
                      value={nameEn}
                      onChange={(e) => setNameEn(e.target.value)}
                      placeholder={tt.formNameEn}
                      maxLength={120}
                      className="min-h-10 rounded-lg bg-white"
                      aria-label={tt.formNameEn}
                    />
                    <Textarea
                      value={descAr}
                      onChange={(e) => setDescAr(e.target.value)}
                      placeholder={tt.formDescAr}
                      maxLength={400}
                      rows={2}
                      className="resize-none rounded-lg bg-white"
                      aria-label={tt.formDescAr}
                    />
                    <Textarea
                      value={descEn}
                      onChange={(e) => setDescEn(e.target.value)}
                      placeholder={tt.formDescEn}
                      maxLength={400}
                      rows={2}
                      className="resize-none rounded-lg bg-white"
                      aria-label={tt.formDescEn}
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">{tt.saveHint}</p>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="min-h-9 rounded-full px-4"
                        onClick={() => setShowSaveForm(false)}
                        disabled={saving}
                      >
                        {t.admin.users.cancel}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="min-h-9 rounded-full px-5"
                        onClick={() => void saveAsTemplate()}
                        disabled={saving || (!nameAr.trim() && !nameEn.trim())}
                      >
                        {saving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                        <Check className="size-4" aria-hidden="true" />
                        {tt.saveAsTemplate}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 rounded-lg px-1 py-0.5 text-start transition-colors hover:opacity-80"
                  onClick={() => setShowSaveForm(true)}
                >
                  <span className="flex items-center gap-2 text-sm font-semibold text-navy">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand text-white shadow-sm">
                      <Sparkles className="size-4.5" aria-hidden="true" />
                    </span>
                    {tt.saveFromCurrent}
                  </span>
                  <span className="rounded-full bg-brand/10 px-3 py-1 text-xs font-bold text-brand">
                    {draftLocale === "ar" ? te.ar : te.en}
                  </span>
                </button>
              )}
            </div>
          )}

          {/* تصفية القوالب */}
          <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)} className="shrink-0">
            <TabsList className="grid h-9 w-full grid-cols-3">
              <TabsTrigger value="all" className="text-xs">
                {tt.all}
              </TabsTrigger>
              <TabsTrigger value="builtin" className="text-xs">
                {tt.builtin}
              </TabsTrigger>
              <TabsTrigger value="custom" className="text-xs">
                {tt.custom}
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* القائمة — تمرير داخلي بطول محدود */}
          <div className="min-h-40 flex-1 space-y-2.5 overflow-y-auto pe-1">
            {loading && !data && (
              <div className="space-y-2.5">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 rounded-2xl" />
                ))}
              </div>
            )}

            {data && templates.length === 0 && !loading && (
              <div className="flex min-h-40 flex-col items-center justify-center gap-1.5 text-center">
                <FileStack className="size-8 text-muted-foreground/50" aria-hidden="true" />
                <p className="text-sm font-semibold text-muted-foreground">{tt.empty}</p>
                <p className="max-w-xs text-xs text-muted-foreground/80">{tt.emptyBody}</p>
              </div>
            )}

            {templates.map((tpl) => {
              const hasLocaleContent = draftLocale === "en" ? tpl.hasEn : tpl.hasAr;
              return (
                <article
                  key={tpl.id}
                  className="group relative flex gap-3.5 rounded-2xl border border-border/70 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md"
                >
                  {/* شعار النوع */}
                  <span
                    className={cn(
                      "mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-xl shadow-inner",
                      tpl.kind === "builtin" ? "bg-navy text-white" : "bg-accent text-brand-strong"
                    )}
                    aria-hidden="true"
                  >
                    <LayoutTemplate className="size-5" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="truncate text-sm font-bold text-navy">{nameOf(tpl)}</h4>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-bold leading-none",
                          tpl.kind === "builtin" ? "bg-navy/10 text-navy" : "bg-brand/10 text-brand"
                        )}
                      >
                        {tpl.kind === "builtin" ? tt.builtin : tt.custom}
                      </span>
                      {!hasLocaleContent && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold leading-none text-amber-700">
                          {tt.missingLocale}
                        </span>
                      )}
                    </div>
                    {descOf(tpl) && <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{descOf(tpl)}</p>}
                    <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] tabular-nums text-muted-foreground/90">
                      <span>{hasLocaleContent ? nodesLabel(nodesOf(tpl)) : "—"}</span>
                      {tpl.usageCount > 0 && <span>{usageLabel(tpl.usageCount)}</span>}
                      {tpl.createdBy && <span>{tt.createdBy.replace("{name}", tpl.createdBy)}</span>}
                      <span title={tpl.updatedAt}>{fmtDateTime(tpl.updatedAt, locale)}</span>
                    </p>
                    {/* معاينة تخطيطية مصغرة — بنية الكتل بنظرة قبل التطبيق (جولة 37) */}
                    {hasLocaleContent && (
                      <div className="mt-3 border-t border-dashed border-border/70 pt-3">
                        <div className="mb-1.5 flex items-center gap-1.5">
                          <Eye className="size-3 text-brand/70" aria-hidden="true" />
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/80">
                            {tt.previewCaption}
                          </span>
                        </div>
                        <TemplatePreview types={previewOf(tpl)} label={tt.previewLabel.replace("{name}", nameOf(tpl))} className="w-full" />
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-col items-stretch justify-center gap-1.5">
                    {canEdit && (
                      <Button
                        type="button"
                        size="sm"
                        className="min-h-10 rounded-full px-4"
                        disabled={!hasLocaleContent}
                        onClick={() => setConfirmTemplate(tpl)}
                      >
                        {tt.applyTo}
                      </Button>
                    )}
                    {canEdit && tpl.kind === "custom" && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="min-h-9 rounded-full px-3 text-navy hover:bg-accent hover:text-navy"
                        onClick={() => openRename(tpl)}
                        aria-label={`${tt.rename} — ${nameOf(tpl)}`}
                      >
                        <Pencil className="size-3.5" aria-hidden="true" />
                        {tt.rename}
                      </Button>
                    )}
                    {canEdit && tpl.kind === "custom" && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="min-h-9 rounded-full px-3 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setDeleteTemplate(tpl)}
                        aria-label={`${tt.delete} — ${nameOf(tpl)}`}
                      >
                        <Trash2 className="size-3.5" aria-hidden="true" />
                        {tt.delete}
                      </Button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* تأكيد التطبيق */}
      <AlertDialog open={confirmTemplate !== null} onOpenChange={(o) => !o && setConfirmTemplate(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-bold text-navy">
              {confirmTemplate ? nameOf(confirmTemplate) : ""} — {tt.applyConfirmTitle}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">{tt.applyConfirmBody}</span>
              <span className="block rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-navy">
                {tt.applyLocaleNote}
              </span>
              <span className="block rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                {tt.applyBackupNote}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <AlertDialogCancel disabled={applying}>{t.admin.users.cancel}</AlertDialogCancel>
            <AlertDialogAction
              disabled={applying}
              onClick={(e) => {
                e.preventDefault();
                void apply();
              }}
            >
              {applying && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {tt.apply}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* إعادة تسمية قالب مخصص (§D) — الحقول معبّأة مسبقًا؛ الفارغ يحتفظ بالحالي */}
      <Dialog open={renameTemplate !== null} onOpenChange={(o) => !o && setRenameTemplate(null)}>
        <DialogContent className="rounded-2xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-navy">
              <Pencil className="size-4.5 text-brand" aria-hidden="true" />
              {tt.renameTitle}
              {renameTemplate && <span className="text-sm font-semibold text-muted-foreground">— {nameOf(renameTemplate)}</span>}
            </DialogTitle>
            <DialogDescription>{tt.renameDesc}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <Input
              value={renameNameAr}
              onChange={(e) => setRenameNameAr(e.target.value)}
              placeholder={tt.formNameAr}
              maxLength={120}
              className="min-h-10 rounded-lg"
              aria-label={tt.formNameAr}
            />
            <Input
              value={renameNameEn}
              onChange={(e) => setRenameNameEn(e.target.value)}
              placeholder={tt.formNameEn}
              maxLength={120}
              className="min-h-10 rounded-lg"
              aria-label={tt.formNameEn}
            />
            <Textarea
              value={renameDescAr}
              onChange={(e) => setRenameDescAr(e.target.value)}
              placeholder={tt.formDescAr}
              maxLength={400}
              rows={2}
              className="resize-none rounded-lg"
              aria-label={tt.formDescAr}
            />
            <Textarea
              value={renameDescEn}
              onChange={(e) => setRenameDescEn(e.target.value)}
              placeholder={tt.formDescEn}
              maxLength={400}
              rows={2}
              className="resize-none rounded-lg"
              aria-label={tt.formDescEn}
            />
          </div>
          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="min-h-9 rounded-full px-4"
              onClick={() => setRenameTemplate(null)}
              disabled={renaming}
            >
              {t.admin.users.cancel}
            </Button>
            <Button type="button" size="sm" className="min-h-9 rounded-full px-5" onClick={() => void saveRename()} disabled={renaming}>
              {renaming && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              <Check className="size-4" aria-hidden="true" />
              {t.admin.users.save}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* تأكيد حذف قالب مخصص */}
      <AlertDialog open={deleteTemplate !== null} onOpenChange={(o) => !o && setDeleteTemplate(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-bold text-navy">{tt.deleteConfirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTemplate ? nameOf(deleteTemplate) : ""} — {tt.deleteConfirmBody}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <AlertDialogCancel disabled={deleting}>{t.admin.users.cancel}</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                void remove();
              }}
            >
              {deleting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {tt.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
