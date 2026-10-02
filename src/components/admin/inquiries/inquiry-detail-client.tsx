"use client";

/**
 * تفاصيل الاستفسار: محادثة (رد/ملاحظة داخلية) + تعيين + تغيير حالة +
 * أرشفة/استعادة + طباعة — نسخة أخف من تفاصيل الطلب بنفس عناصر المحادثة المشتركة.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, MessageSquareText, Loader2, RotateCcw, Archive, ArchiveRestore, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { getPortalContent } from "@/content/portal";
import { ar as siteAr } from "@/content/ar";
import { en as siteEn } from "@/content/en";
import type { PortalContent } from "@/content/portal/types";
import { can } from "@/lib/auth/permissions";
import type { Locale } from "@/lib/i18n";
import { StatusBadge } from "@/components/admin/badges";
import { EmptyState } from "@/components/admin/empty-state";
import { MessageBubble, ReplyComposer } from "@/components/admin/conversation";
import { apiGet, apiSend, ApiError, apiErrorMessage, fmtDateTime } from "@/components/admin/helpers";
import type { InquiryDetail, InquiryDetailResponse, Me, MessageRow, RequestsResponse, StaffOption } from "../types";

const INQUIRY_STATUS_KEYS = ["new", "in_review", "awaiting_info", "responded", "closed"];

/** شارة عمر الانتظار — منذ آخر رسالة عميل: محايدة تحت 24 ساعة، تحذير
 *  كهرماني بعدها (نسخة مطابقة لشارة قائمة الطلبات، مفاتيح الترجمة نفسها) */
function AgingBadge({ since, tr }: { since: string; tr: PortalContent["admin"]["requests"] }) {
  const ageMs = Date.now() - new Date(since).getTime();
  const hours = Math.max(0, Math.floor(ageMs / 3_600_000));
  const days = Math.max(0, Math.floor(ageMs / 86_400_000));
  if (days >= 1) {
    return (
      <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-xs font-medium tabular-nums text-amber-900 print:break-inside-avoid print:border-border">
        {tr.overdueReply} · {tr.agingDays.replace("{n}", String(days))}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground print:break-inside-avoid print:border-border">
      {tr.awaitingTeam} · {tr.agingHours.replace("{n}", String(hours))}
    </span>
  );
}

interface InquiryDetailClientProps {
  me: Me;
  locale: Locale;
  inquiryId: string;
}

export function InquiryDetailClient({ me, locale, inquiryId }: InquiryDetailClientProps) {
  const t = getPortalContent(locale);
  const ti = t.admin.inquiries;
  const td = t.account.detail;
  const siteMeta = locale === "en" ? siteEn.meta : siteAr.meta;

  const [detail, setDetail] = useState<InquiryDetail | null>(null);
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const mayReply = can(me, "inquiries.reply");
  const mayAssign = can(me, "inquiries.assign");
  const mayStatus = can(me, "inquiries.status");
  const mayArchive = can(me, "inquiries.archive");

  const load = useCallback(
    async (signal: AbortSignal, quiet = false) => {
      if (!quiet) setLoading(true);
      try {
        const res = await apiGet<InquiryDetailResponse>(`/api/admin/inquiries/${inquiryId}`);
        if (!signal.aborted) {
          setDetail(res.inquiry);
          setNotFound(false);
          setError(null);
        }
      } catch (err) {
        if (signal.aborted) return;
        if (err instanceof ApiError && (err.code === "not_found" || err.status === 404)) {
          setNotFound(true);
        } else if (err instanceof ApiError) {
          setError(apiErrorMessage(err, t.auth.errors));
        }
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    },
    [inquiryId, t.auth.errors]
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load, reloadToken]);

  // قائمة الطاقم القابلة للتعيين (من استجابة قائمة الطلبات)
  useEffect(() => {
    if (!mayAssign) return;
    const controller = new AbortController();
    apiGet<RequestsResponse>("/api/admin/requests?page=1")
      .then((res) => {
        if (!controller.signal.aborted) setStaffOptions(res.staff);
      })
      .catch(() => {
        // غير حرج
      });
    return () => controller.abort();
  }, [mayAssign]);

  const reload = () => setReloadToken((v) => v + 1);

  const patch = async (body: Record<string, unknown>, successMsg?: string) => {
    setBusy(true);
    busyRef.current = true;
    try {
      await apiSend(`/api/admin/inquiries/${inquiryId}`, "PATCH", body);
      if (successMsg) toast.success(successMsg);
      reload();
    } catch (err) {
      toast.error(apiErrorMessage(err, t.auth.errors));
    } finally {
      setBusy(false);
      busyRef.current = false;
    }
  };

  const sendMessage = async (kind: "message" | "internal_note", body: string) => {
    setSending(true);
    busyRef.current = true;
    try {
      const res = await apiSend<{ ok: boolean; message: MessageRow }>(
        `/api/admin/inquiries/${inquiryId}/messages`,
        "POST",
        { body, kind }
      );
      setDetail((prev) =>
        prev
          ? {
              ...prev,
              messages: [
                ...prev.messages,
                { ...res.message, author: { id: me.id, name: me.name, roleKey: me.roleKey } },
              ],
            }
          : prev
      );
      toast.success(kind === "internal_note" ? t.admin.requests.sentNote : t.admin.requests.sentReply);
      const controller = new AbortController();
      void load(controller.signal, true);
    } catch (err) {
      toast.error(apiErrorMessage(err, t.auth.errors));
    } finally {
      setSending(false);
      busyRef.current = false;
    }
  };

  if (loading && !detail) {
    return (
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <Skeleton className="h-9 w-72 rounded-xl" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (notFound) {
    return <EmptyState icon={MessageSquareText} title={ti.empty} className="py-20" />;
  }

  if (!detail) {
    return (
      <div className="flex flex-col items-center gap-4 py-20">
        <p className="text-sm text-destructive">{error ?? t.auth.errors.generic}</p>
        <Button variant="outline" onClick={reload} className="min-h-11 rounded-full">
          <RotateCcw className="size-4" aria-hidden="true" />
        </Button>
      </div>
    );
  }

  const BackIcon = locale === "ar" ? ArrowRight : ArrowLeft;
  // شارة عمر الانتظار في الترويسة — تُحسب من المحادثة المحمّلة نفسها بنفس
  // دلالات القائمة: آخر رسالة ظاهرة (kind=message) من العميل، أو تاريخ
  // الإنشاء إن لم توجد رسائل بعد؛ المغلق/المؤرشف بلا شارة (بلا تغيير API).
  const visibleMessages = detail.messages.filter((m) => m.kind === "message");
  const lastVisible = visibleMessages.length > 0 ? visibleMessages[visibleMessages.length - 1] : null;
  const awaitingSince =
    detail.status !== "closed" && detail.archivedAt === null
      ? lastVisible
        ? lastVisible.authorType === "client"
          ? lastVisible.createdAt
          : null
        : detail.createdAt
      : null;
  const bubbleLabels = {
    client: t.admin.requests.client,
    staff: td.staff,
    system: td.system,
    internalHint: t.admin.requests.internalNoteHint,
    statuses: ti.statuses,
  };

  return (
    <div className="space-y-5">
      {/* ترويسة الطباعة — تظهر على الورق فقط: العلامة + التاريخ + الرقم المرجعي */}
      <div className="hidden print:block print:border-b print:border-border print:pb-2">
        <p className="text-xs font-medium text-muted-foreground">
          {siteMeta.siteName} · {new Date().toLocaleDateString(locale)} · <span className="font-mono">{detail.refCode}</span>
        </p>
      </div>

      {/* الترويسة */}
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="sm" className="min-h-11 rounded-full print:hidden">
          <Link href={`/${locale}/admin/inquiries`}>
            <BackIcon className="size-4" aria-hidden="true" />
            <span className="sr-only">{ti.title}</span>
            {ti.title}
          </Link>
        </Button>
        <h1 className="font-mono text-xl font-bold text-navy ltr-isolate">{detail.refCode}</h1>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <StatusBadge
            status={detail.status}
            label={ti.statuses[detail.status] ?? detail.status}
            className="print:break-inside-avoid print:border-border"
          />
          <span className="inline-flex items-center rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-brand-strong print:break-inside-avoid print:border print:border-border">
            {ti.categories[detail.category] ?? detail.category}
          </span>
          {awaitingSince ? <AgingBadge since={awaitingSince} tr={t.admin.requests} /> : null}
          {detail.archivedAt ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground print:break-inside-avoid print:border print:border-border">
              <Archive className="size-3" aria-hidden="true" />
              {ti.archived}
            </span>
          ) : null}
        </div>
        {/* زر الطباعة — مخفي على الورق (ترويسة الطباعة الخاصة تظهر بدله) */}
        <Button
          variant="outline"
          onClick={() => window.print()}
          aria-label={ti.print}
          className="ms-auto min-h-11 rounded-full px-5 font-semibold focus-visible:ring-2 focus-visible:ring-ring/40 print:hidden"
        >
          <Printer className="size-4" aria-hidden="true" />
          {ti.print}
        </Button>
      </div>

      <h2 className="text-lg font-semibold break-words text-navy">{detail.subject}</h2>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px] print:block print:space-y-6">
        {/* المحادثة */}
        <div className="space-y-4">
          <section
            aria-label={ti.conversation}
            className="rounded-2xl border border-border bg-white p-4 sm:p-6"
          >
            <h3 className="mb-3 text-sm font-semibold text-navy">
              {ti.conversation}
              <span className="ms-2 font-normal tabular-nums text-muted-foreground">
                {detail.messages.length} {t.admin.requests.messages}
              </span>
            </h3>
            {detail.messages.length === 0 ? (
              <EmptyState icon={MessageSquareText} title={td.noMessages} />
            ) : (
              <div className="flex max-h-[60vh] flex-col gap-1 overflow-y-auto rounded-xl bg-muted/30 p-4 print:max-h-none print:overflow-visible print:bg-transparent">
                {detail.messages.map((message) => (
                  <div
                    key={message.id}
                    className="print:break-inside-avoid print:[&_div]:bg-transparent print:[&_div]:text-foreground print:[&_div]:shadow-none"
                  >
                    <MessageBubble message={message} locale={locale} labels={bubbleLabels} />
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* الملحن — مخفي عند الطباعة */}
          <div className="print:hidden">
            <ReplyComposer
              canReply={mayReply}
              canNote={mayReply}
              sending={sending}
              onSend={sendMessage}
              savedReplies={
                mayReply
                  ? {
                      trigger: t.admin.savedReplies.useReply,
                      insert: t.admin.savedReplies.insert,
                      empty: t.admin.savedReplies.empty,
                    }
                  : undefined
              }
              labels={{
                reply: ti.reply,
                internalNote: t.admin.requests.internalNote,
                internalHint: t.admin.requests.internalNoteHint,
                placeholder: td.replyPlaceholder,
                send: td.send,
                sending: td.sending,
              }}
            />
          </div>
        </div>

        {/* عمود الإدارة */}
        <aside className="space-y-4">
          <section className="rounded-2xl border border-border bg-white p-4">
            <h3 className="text-sm font-semibold text-navy">{t.admin.requests.client}</h3>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex items-start justify-between gap-3">
                <dt className="text-muted-foreground">{t.account.profile.name}</dt>
                <dd className="border-s-2 border-border/60 ps-3 font-medium text-navy">{detail.client?.name ?? detail.name}</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-muted-foreground">{t.admin.settings.email}</dt>
                <dd className="min-w-0 truncate border-s-2 border-border/60 ps-3">
                  <a
                    href={`mailto:${detail.email}`}
                    className="break-all rounded-sm text-brand transition-colors hover:text-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 ltr-isolate"
                  >
                    {detail.email}
                  </a>
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-muted-foreground">{t.admin.users.createdAt}</dt>
                <dd className="border-s-2 border-border/60 ps-3 font-medium tabular-nums text-navy">{fmtDateTime(detail.createdAt, locale)}</dd>
              </div>
              {/* المعيّن — سطر طِباعي فقط (قائمة التعيين التفاعلية مخفية عند الطباعة) */}
              <div className="hidden print:flex items-start justify-between gap-3">
                <dt className="text-muted-foreground">{t.admin.requests.filterAssignee}</dt>
                <dd className="border-s-2 border-border/60 ps-3 font-medium text-navy">
                  {detail.assignee?.name ?? t.admin.requests.unassigned}
                </dd>
              </div>
            </dl>
          </section>

          {/* الإدارة: تعيين/حالة — مخفية عند الطباعة (المعيّن يظهر في بطاقة العميل) */}
          <section className="space-y-4 rounded-2xl border border-border bg-white p-4 print:hidden">
            {mayAssign ? (
              <div className="space-y-2">
                <Label>{ti.assign}</Label>
                <Select
                  value={detail.assigneeId ?? "none"}
                  onValueChange={(v) => patch({ assigneeId: v === "none" ? null : v }, v === "none" ? t.admin.requests.unassigned : undefined)}
                  disabled={busy}
                >
                  <SelectTrigger className="min-h-11 w-full focus-visible:ring-2 focus-visible:ring-ring/40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t.admin.requests.unassigned}</SelectItem>
                    {detail.assignee && !staffOptions.some((s) => s.id === detail.assignee?.id) ? (
                      <SelectItem value={detail.assignee.id}>{detail.assignee.name}</SelectItem>
                    ) : null}
                    {staffOptions.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {mayStatus ? (
              <div className="space-y-2">
                <Label>{t.admin.requests.changeStatus}</Label>
                <Select
                  value={detail.status}
                  onValueChange={(v) => patch({ status: v }, ti.statuses[v] ?? v)}
                  disabled={busy}
                >
                  <SelectTrigger className="min-h-11 w-full focus-visible:ring-2 focus-visible:ring-ring/40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INQUIRY_STATUS_KEYS.map((s) => (
                      <SelectItem key={s} value={s}>{ti.statuses[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {mayArchive ? (
              <Button
                variant="outline"
                onClick={() =>
                  patch({ action: detail.archivedAt ? "restore" : "archive" }, detail.archivedAt ? ti.restore : ti.archived)
                }
                disabled={busy}
                className="min-h-11 w-full rounded-full"
              >
                {detail.archivedAt ? (
                  <ArchiveRestore className="size-4" aria-hidden="true" />
                ) : (
                  <Archive className="size-4" aria-hidden="true" />
                )}
                {detail.archivedAt ? ti.restore : ti.archive}
              </Button>
            ) : null}
          </section>
        </aside>
      </div>
    </div>
  );
}
