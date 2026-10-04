"use client";

/**
 * حوار تاريخ الإصدارات — قائمة إصدارات الصفحة بتبويب لغة (عربي/إنجليزي):
 * الرقم والمؤلف والتاريخ وعدد الكتل وزر استعادة لكل صف مع تأكيد
 * (الاستعادة تعيد الإصدار «مسودة» — النشر قرار مستقل لاحقًا).
 *
 * مقارنة الإصدارات (خارطة الطريق 1.4 — G4): كل صف يفتح لوحة مقارنة
 * تُجيب سؤال «ما الذي يتغيّر بالاستعادة؟» — عمودان جانبيان (المسودة الحالية
 * مقابل الإصدار) بمدخلات بصمة خفيفة، مع تلوين ما يعود بالاستعادة (زمردي)
 * وما يُزال (وردي)، وإعادة الترتيب وحدها لا تُعد تغييرًا (مقارنة على المحتوى).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Equal, GitCompareArrows, History, Loader2, Minus, Plus, RotateCcw } from "lucide-react";
import { BLOCK_LIBRARY } from "@/lib/blocks/types";
import {
  diffFingerprints,
  fingerprintFromNodes,
  type DiffEntry,
  type VersionDiffResult,
} from "@/lib/blocks/version-diff";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { getPortalContent } from "@/content/portal";
import { can } from "@/lib/auth/permissions";
import type { Locale } from "@/lib/i18n";
import { apiErrorMessage, apiGet, apiSend, ApiError, fmtDateTime } from "@/components/admin/helpers";
import type { Me } from "@/components/admin/types";
import { cn } from "@/lib/utils";
import type { DraftState, RestoreResponse, VersionsResponse } from "./types";

interface VersionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pageId: string;
  locale: Locale;
  me: Me;
  /** شجرة المسودة الحية للغتين — المرجع الذي تُقارن عليه الإصدارات */
  draft: DraftState;
  baseRevision: number; // مراجعة المسودة الحالية
  onRestored: () => void; // يعيد المحرر تحميل المسودة بعد الاستعادة
}

/** شارة مدخل واحد في عمود المقارنة — نوع الكتلة + مستخلصه النصي */
function EntryChip({ entry, locale, tone }: { entry: DiffEntry; locale: "ar" | "en"; tone: "neutral" | "added" | "removed" }) {
  const typeLabel = BLOCK_LIBRARY.find((b) => b.type === entry.type)?.[locale] ?? entry.type;
  return (
    <li
      className={cn(
        "flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs transition-colors",
        tone === "added" && "border-emerald-300 bg-emerald-50 text-emerald-900",
        tone === "removed" && "border-rose-300 bg-rose-50 text-rose-900",
        tone === "neutral" && "border-border/70 bg-white text-foreground/75"
      )}
    >
      <span className="shrink-0 rounded-md bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold text-navy ring-1 ring-border/60">
        {typeLabel}
      </span>
      {entry.label && <span className="truncate" title={entry.label}>{entry.label}</span>}
    </li>
  );
}

/** عمود جانبي في المقارنة — قائمة مدخلات بصمة واحدة بتمرير عمودي */
function DiffColumn({ title, entries, locale, toneOf }: {
  title: string;
  entries: DiffEntry[];
  locale: "ar" | "en";
  toneOf: (entry: DiffEntry) => "neutral" | "added" | "removed";
}) {
  return (
    <div className="min-w-0 rounded-xl border border-border/60 bg-muted/30 p-2">
      <p className="mb-1.5 truncate px-1 text-xs font-bold text-navy">{title}</p>
      {entries.length === 0 ? (
        <p className="px-1 py-2 text-xs text-muted-foreground">—</p>
      ) : (
        <ul className="max-h-56 space-y-1.5 overflow-y-auto px-0.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:w-1.5">
          {entries.map((entry, index) => (
            <EntryChip key={`${index}-${entry.type}-${entry.label}`} entry={entry} locale={locale} tone={toneOf(entry)} />
          ))}
        </ul>
      )}
    </div>
  );
}

export function VersionsDialog({ open, onOpenChange, pageId, locale, me, draft, baseRevision, onRestored }: VersionsDialogProps) {
  const t = getPortalContent(locale);
  const tp = t.admin.pages;
  const te = t.admin.editor;

  const [tab, setTab] = useState<"ar" | "en">(locale === "en" ? "en" : "ar");
  const [data, setData] = useState<VersionsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmVersion, setConfirmVersion] = useState<number | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [expandedVersion, setExpandedVersion] = useState<number | null>(null);

  const canRestore = can(me, "pages.restore");

  /** بصمة المسودة الحية للغة المختارة — المرجع الذي تُقارن عليه الإصدارات */
  const draftFingerprint = useMemo(() => fingerprintFromNodes(draft[tab]), [draft, tab]);

  /** إغلاق المقارنة المفتوحة عند تبديل اللغة — بصمة المرجع تتغير */
  useEffect(() => {
    setExpandedVersion(null);
  }, [tab]);

  const load = useCallback(
    async (signal: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiGet<VersionsResponse>(`/api/admin/pages/${pageId}/versions`);
        if (!signal.aborted) setData(res);
      } catch (err) {
        if (!signal.aborted && err instanceof ApiError) setError(apiErrorMessage(err, t.auth.errors));
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    },
    [pageId, t.auth.errors]
  );

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [open, load]);

  const versions = (data?.versions ?? []).filter((v) => v.locale === tab);

  /** الاستعادة للغة المختارة من التبويب فقط — استعادة اللغتين تحتاج اختيارًا صريحًا */
  const restore = async (version: number, both: boolean) => {
    setRestoring(true);
    try {
      await apiSend<RestoreResponse>(`/api/admin/pages/${pageId}/versions/${version}/restore`, "POST", {
        locales: both ? ["ar", "en"] : [tab],
        baseRevision: baseRevision,
      });
      toast.success(both ? tp.restoreBoth : tp.restore);
      setConfirmVersion(null);
      onRestored(); // يعيد المحرر جلب المسودة المستعادة ويصفّر التاريخ
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError && err.code === "version_not_found") {
        toast.error(tp.versionNotFound);
      } else if (err instanceof ApiError && (err.code === "conflict" || err.code === "revision_required")) {
        toast.error(te.conflictTitle);
      } else {
        toast.error(apiErrorMessage(err, t.auth.errors));
      }
    } finally {
      setRestoring(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[85vh] overflow-y-auto rounded-2xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-navy">
              <History className="size-5 text-brand" aria-hidden="true" />
              {tp.versionHistory}
            </DialogTitle>
            <DialogDescription>{tp.subtitle}</DialogDescription>
          </DialogHeader>

          <Tabs value={tab} onValueChange={(v) => setTab(v as "ar" | "en")}>
            <TabsList className="grid h-9 w-full grid-cols-2">
              <TabsTrigger value="ar" className="text-xs">
                {te.ar}
              </TabsTrigger>
              <TabsTrigger value="en" className="text-xs">
                {te.en}
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="min-h-40 space-y-2">
            {loading && !data && (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 rounded-xl" />
                ))}
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            {data && versions.length === 0 && !loading && (
              <p className="flex min-h-40 items-center justify-center text-sm text-muted-foreground">
                {tp.empty}
              </p>
            )}

            <ul className="space-y-2">
              {versions.map((version) => {
                const isNewest = version.version === Math.max(...versions.map((v) => v.version));
                const expanded = expandedVersion === version.version;
                // الفرق: المرجع = المسودة الحية، الهدف = الإصدار — يجيب «ماذا يتغير بالاستعادة؟»
                const diff: VersionDiffResult | null = expanded
                  ? diffFingerprints(draftFingerprint, version.summary)
                  : null;
                const addedKeys = new Set(diff?.added.map((e) => `${e.type}\u0000${e.label}`) ?? []);
                const removedKeys = new Set(diff?.removed.map((e) => `${e.type}\u0000${e.label}`) ?? []);
                const toneOf = (entry: DiffEntry): "neutral" | "added" | "removed" => {
                  const key = `${entry.type}\u0000${entry.label}`;
                  if (addedKeys.has(key)) return "added";
                  if (removedKeys.has(key)) return "removed";
                  return "neutral";
                };

                return (
                  <li
                    key={version.id}
                    className={cn(
                      "rounded-xl border border-border/70 bg-white p-3 transition-colors hover:bg-muted/50",
                      isNewest && "border-brand/40",
                      expanded && "border-brand/40 bg-muted/20"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-sm font-bold text-brand-strong tabular-nums" aria-hidden="true">
                        {version.version}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-navy">
                          {tp.currentVersion} #{version.version} · {version.blockCount} {te.blocks}
                        </p>
                        <p className="truncate text-xs tabular-nums text-muted-foreground">
                          {version.author} · {fmtDateTime(version.createdAt, locale)}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        className="min-h-11 shrink-0 rounded-full px-3 text-xs"
                        aria-expanded={expanded}
                        onClick={() => setExpandedVersion(expanded ? null : version.version)}
                      >
                        <GitCompareArrows className="size-3.5" aria-hidden="true" />
                        {tp.compare}
                      </Button>
                      {canRestore && (
                        <Button
                          type="button"
                          variant="outline"
                          className="min-h-11 shrink-0 rounded-full px-4"
                          onClick={() => setConfirmVersion(version.version)}
                        >
                          <RotateCcw className="size-3.5" aria-hidden="true" />
                          {tp.restoreVersion}
                        </Button>
                      )}
                    </div>

                    {expanded && (
                      <div className="mt-3 space-y-3 rounded-xl border border-border/60 bg-muted/30 p-3" role="region" aria-label={`${tp.diffPanelTitle} #${version.version}`}>
                        {version.summary.length === 0 ? (
                          <p className="text-xs text-muted-foreground">{tp.diffUnavailable}</p>
                        ) : diff?.identical ? (
                          <p className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
                            <Equal className="size-3.5 shrink-0" aria-hidden="true" />
                            {tp.diffIdentical}
                          </p>
                        ) : (
                          diff && (
                            <>
                              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-800">
                                  <Plus className="size-3" aria-hidden="true" />
                                  {tp.diffComesBack} · {diff.added.length}
                                </span>
                                <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 text-rose-800">
                                  <Minus className="size-3" aria-hidden="true" />
                                  {tp.diffGetsRemoved} · {diff.removed.length}
                                </span>
                                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-muted-foreground tabular-nums">
                                  <Equal className="size-3" aria-hidden="true" />
                                  {tp.diffUnchanged} · {diff.unchangedCount}
                                </span>
                              </div>
                              <div className="grid gap-3 sm:grid-cols-2">
                                <DiffColumn
                                  title={tp.diffDraftCol}
                                  entries={draftFingerprint}
                                  locale={tab}
                                  toneOf={toneOf}
                                />
                                <DiffColumn
                                  title={tp.diffVersionCol.replace("{n}", String(version.version))}
                                  entries={version.summary}
                                  locale={tab}
                                  toneOf={toneOf}
                                />
                              </div>
                              <p className="text-[11px] text-muted-foreground">{tp.diffComparedWith}</p>
                            </>
                          )
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmVersion !== null} onOpenChange={(o) => !o && setConfirmVersion(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-bold text-navy">{tp.restoreVersion}</AlertDialogTitle>
            <AlertDialogDescription>
              #{confirmVersion} — {te.restoreScopeHint}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <AlertDialogCancel disabled={restoring}>{t.admin.users.cancel}</AlertDialogCancel>
            {canRestore && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  disabled={restoring}
                  onClick={(e) => {
                    e.preventDefault();
                    if (confirmVersion !== null) void restore(confirmVersion, true);
                  }}
                >
                  {restoring && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                  {tp.restoreBoth}
                </Button>
                <AlertDialogAction
                  disabled={restoring}
                  onClick={(e) => {
                    e.preventDefault();
                    if (confirmVersion !== null) void restore(confirmVersion, false);
                  }}
                >
                  {restoring && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                  {tp.restoreThisLocale} ({tab === "ar" ? te.ar : te.en})
                </AlertDialogAction>
              </>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
