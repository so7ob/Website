"use client";

/**
 * حوار جدولة النشر — يعرض الجدولة القائمة ويسمح بتأكيدها أو إلغائها.
 *
 * قواعد السلامة المعروضة للمستخدم:
 * - الجدولة ترتبط بمراجعة المسودة الحالية؛ تغيير المسودة قبل الموعد يُسقط النشر آليًا.
 * - الإلغاء آمن دائمًا ولا يربط بمراجعة.
 * كل التواريخ بإدخال datetime-local مع حد أدنى = الآن (بالتوقيت المحلي).
 */
import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getPortalContent } from "@/content/portal";
import type { Locale } from "@/lib/i18n";
import { ApiError, apiSend, fmtDateTime } from "@/components/admin/helpers";
import type { PageDetail, ScheduleResponse } from "./types";

interface ScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locale: Locale;
  page: PageDetail;
  /** يُستدعى بعد نجاح الجدولة/الإلغاء بموعد الجدولة الجديد (null بعد الإلغاء) */
  onApplied: (scheduledPublishAt: string | null) => void;
}

/** صيغة datetime-local محلية: YYYY-MM-DDTHH:mm */
function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function ScheduleDialog({ open, onOpenChange, locale, page, onApplied }: ScheduleDialogProps) {
  const t = getPortalContent(locale);
  const te = t.admin.editor;
  const [dateValue, setDateValue] = useState("");
  const [busy, setBusy] = useState(false);

  // عند الفتح: الحقل يبدأ من غدٍ 09:00 (أو القيمة القائمة) — والحد الأدنى الآن
  const nowValue = useMemo(() => toLocalInputValue(new Date()), [open]);
  useEffect(() => {
    if (!open) return;
    if (page.scheduledPublishAt) {
      setDateValue(toLocalInputValue(new Date(page.scheduledPublishAt)));
    } else {
      const tomorrow9 = new Date();
      tomorrow9.setDate(tomorrow9.getDate() + 1);
      tomorrow9.setHours(9, 0, 0, 0);
      setDateValue(toLocalInputValue(tomorrow9));
    }
  }, [open, page.scheduledPublishAt]);

  const schedule = async () => {
    if (busy || !dateValue) return;
    const when = new Date(dateValue);
    if (Number.isNaN(when.getTime())) {
      toast.error(te.scheduleInvalidTime);
      return;
    }
    setBusy(true);
    try {
      const res = await apiSend<ScheduleResponse>(`/api/admin/pages/${page.id}/schedule`, "POST", {
        publishAt: when.toISOString(),
        baseRevision: page.draftRevision,
      });
      onOpenChange(false);
      onApplied(res.scheduledPublishAt);
      toast.success(te.scheduleSetOk.replace("{time}", fmtDateTime(res.scheduledPublishAt, locale)));
    } catch (err) {
      if (err instanceof ApiError && err.code === "conflict") {
        toast.error(t.admin.editor.unpublishedHint);
      } else if (err instanceof ApiError && err.code === "past_time") {
        toast.error(te.schedulePastTime);
      } else if (err instanceof ApiError && err.code === "invalid_time" || err instanceof ApiError && err.code === "far_future") {
        toast.error(te.scheduleInvalidTime);
      } else if (err instanceof ApiError && err.code === "archived") {
        toast.error(te.archivedError);
      } else {
        toast.error(err instanceof Error ? err.message : te.scheduleInvalidTime);
      }
    } finally {
      setBusy(false);
    }
  };

  const cancelSchedule = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await apiSend<ScheduleResponse>(`/api/admin/pages/${page.id}/schedule`, "POST", { publishAt: null });
      onOpenChange(false);
      onApplied(null);
      toast.success(te.scheduleCancelOk);
    } catch (err) {
      if (err instanceof ApiError && err.code === "nothing_scheduled") {
        onOpenChange(false);
        onApplied(null);
      } else {
        toast.error(err instanceof Error ? err.message : t.auth.errors.generic);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-navy">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-700">
              <CalendarClock className="size-4" aria-hidden="true" />
            </span>
            {te.schedule}
          </DialogTitle>
          <DialogDescription>{te.scheduleDesc}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* الجدولة القائمة */}
          {page.scheduledPublishAt && (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-violet-200 bg-violet-50/60 p-3">
              <div className="min-w-0">
                <p className="text-xs font-bold text-violet-800">{te.scheduleCurrent}</p>
                <p className="text-sm font-semibold text-navy">{fmtDateTime(page.scheduledPublishAt, locale)}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 border-violet-300 text-violet-700 hover:bg-violet-100 hover:text-violet-800"
                onClick={() => void cancelSchedule()}
                disabled={busy}
              >
                {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
                {te.scheduleCancelSchedule}
              </Button>
            </div>
          )}

          {/* اختيار الموعد */}
          <div className="space-y-1.5">
            <Label htmlFor="schedule-when" className="text-sm font-semibold text-navy">
              {te.scheduleWhen}
            </Label>
            <Input
              id="schedule-when"
              type="datetime-local"
              value={dateValue}
              min={nowValue}
              onChange={(e) => setDateValue(e.target.value)}
              dir="ltr"
              className="h-11 rounded-xl"
              disabled={busy}
            />
          </div>

          {/* ملاحظة الربط بالمراجعة */}
          <p className="rounded-xl bg-muted/60 p-3 text-xs leading-5 text-muted-foreground">
            {te.scheduleBindHint.replace("{rev}", `#${page.draftRevision}`)}
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" className="min-h-11 rounded-full" onClick={() => onOpenChange(false)} disabled={busy}>
            {t.admin.users.cancel}
          </Button>
          <Button
            type="button"
            className="min-h-11 rounded-full bg-violet-700 text-white hover:bg-violet-800"
            onClick={() => void schedule()}
            disabled={busy || !dateValue}
          >
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <CalendarClock className="size-4" aria-hidden="true" />}
            {te.scheduleConfirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
