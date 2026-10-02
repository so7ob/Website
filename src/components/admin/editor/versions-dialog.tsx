"use client";

/**
 * حوار تاريخ الإصدارات — قائمة إصدارات الصفحة بتبويب لغة (عربي/إنجليزي):
 * الرقم والمؤلف والتاريخ وعدد الكتل وزر استعادة لكل صف مع تأكيد
 * (الاستعادة تعيد الإصدار «مسودة» — النشر قرار مستقل لاحقًا).
 */
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { History, Loader2, RotateCcw } from "lucide-react";
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
import type { RestoreResponse, VersionsResponse } from "./types";

interface VersionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pageId: string;
  locale: Locale;
  me: Me;
  onRestored: () => void; // يعيد المحرر تحميل المسودة بعد الاستعادة
}

export function VersionsDialog({ open, onOpenChange, pageId, locale, me, onRestored }: VersionsDialogProps) {
  const t = getPortalContent(locale);
  const tp = t.admin.pages;
  const te = t.admin.editor;

  const [tab, setTab] = useState<"ar" | "en">(locale === "en" ? "en" : "ar");
  const [data, setData] = useState<VersionsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmVersion, setConfirmVersion] = useState<number | null>(null);
  const [restoring, setRestoring] = useState(false);

  const canRestore = can(me, "pages.restore");

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

  const restore = async (version: number) => {
    setRestoring(true);
    try {
      await apiSend<RestoreResponse>(`/api/admin/pages/${pageId}/versions/${version}/restore`, "POST");
      toast.success(tp.restore);
      setConfirmVersion(null);
      onRestored(); // يعيد المحرر جلب المسودة المستعادة ويصفّر التاريخ
      onOpenChange(false);
    } catch (err) {
      toast.error(apiErrorMessage(err, t.auth.errors));
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
              {versions.map((version) => (
                <li
                  key={version.id}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border border-border/70 bg-white p-3 transition-colors hover:bg-muted/50",
                    version.version === Math.max(...versions.map((v) => v.version)) && "border-brand/40"
                  )}
                >
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
                </li>
              ))}
            </ul>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmVersion !== null} onOpenChange={(o) => !o && setConfirmVersion(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-bold text-navy">{tp.restoreVersion}</AlertDialogTitle>
            <AlertDialogDescription>
              #{confirmVersion} — {te.leaveWarning}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restoring}>{t.admin.users.cancel}</AlertDialogCancel>
            <AlertDialogAction
              disabled={restoring}
              onClick={(e) => {
                e.preventDefault();
                if (confirmVersion !== null) void restore(confirmVersion);
              }}
            >
              {restoring && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {tp.restore}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
