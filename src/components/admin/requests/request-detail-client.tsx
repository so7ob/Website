"use client";

/**
 * تفاصيل الطلب (طاقم): المحادثة الكاملة بالملاحظات الداخلية + معاينة ما يراه
 * العميل، وعمود إدارة (تعيين/أولوية/حالة/أرشفة) وبيانات الطلب والمرفقات
 * والخط الزمني. تحديث دوري كل 20 ثانية.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  UserPlus,
  Paperclip,
  Download,
  Archive,
  ArchiveRestore,
  Inbox,
  Loader2,
  Printer,
  RotateCcw,
  History,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { getPortalContent } from "@/content/portal";
import { ar as siteAr } from "@/content/ar";
import { en as siteEn } from "@/content/en";
import { can } from "@/lib/auth/permissions";
import { localeMeta, type Locale } from "@/lib/i18n";
import { StatusBadge, PriorityBadge, UserStatusBadge } from "@/components/admin/badges";
import { EmptyState } from "@/components/admin/empty-state";
import { MessageBubble, ReplyComposer } from "@/components/admin/conversation";
import {
  apiGet,
  apiSend,
  apiUpload,
  ApiError,
  apiErrorMessage,
  buildQuery,
  fmtDate,
  fmtDateTime,
  formatBytes,
} from "@/components/admin/helpers";
import type { AttachmentRow, Me, MessageRow, RequestDetail, RequestDetailResponse, RequestsResponse, StaffOption } from "../types";
import { cn } from "@/lib/utils";

interface RequestDetailClientProps {
  me: Me;
  locale: Locale;
  requestId: string;
}

const STATUS_KEYS = ["new", "in_review", "awaiting_info", "in_progress", "responded", "closed", "cancelled"];
const PRIORITY_KEYS = ["low", "normal", "high", "urgent"];

export function RequestDetailClient({ me, locale, requestId }: RequestDetailClientProps) {
  const t = getPortalContent(locale);
  const tr = t.admin.requests;
  const td = t.account.detail;
  const siteForm = locale === "en" ? siteEn.form : siteAr.form;
  // اسم الموقع لسطر الترويسة الطِباعية فقط (لا نصوص ثابتة هنا)
  const siteMeta = locale === "en" ? siteEn.meta : siteAr.meta;

  const [detail, setDetail] = useState<RequestDetail | null>(null);
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [clientView, setClientView] = useState(false);
  const [sending, setSending] = useState(false);

  // إدارة الحالة/الأولوية/التعيين
  const [statusTarget, setStatusTarget] = useState("");
  const [statusNote, setStatusNote] = useState("");
  const [closeReason, setCloseReason] = useState("");
  const [applying, setApplying] = useState(false);
  const [busy, setBusy] = useState(false);

  const busyRef = useRef(false);

  const load = useCallback(
    async (signal: AbortSignal, quiet = false) => {
      if (!quiet) setLoading(true);
      try {
        const res = await apiGet<RequestDetailResponse>(`/api/admin/requests/${requestId}`);
        if (!signal.aborted) {
          setDetail(res.request);
          setNotFound(false);
          setError(null);
          setStatusTarget((prev) => prev || res.request.status);
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
    [requestId, t.auth.errors]
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load, reloadToken]);

  // قائمة الطاقم القابلة للتعيين (تأتي مع استجابة قائمة الطلبات)
  useEffect(() => {
    const controller = new AbortController();
    apiGet<RequestsResponse>("/api/admin/requests?page=1")
      .then((res) => {
        if (!controller.signal.aborted) setStaffOptions(res.staff);
      })
      .catch(() => {
        // قائمة الطاقم تحسّن فقط — الفشل غير حرج
      });
    return () => controller.abort();
  }, []);

  // تحديث دوري كل 20 ثانية (يتوقف أثناء الإرسال أو حين تكون الصفحة مخفية)
  useEffect(() => {
    const timer = setInterval(() => {
      if (busyRef.current || document.hidden) return;
      const controller = new AbortController();
      void load(controller.signal, true);
    }, 20000);
    return () => clearInterval(timer);
  }, [load]);

  const reload = () => setReloadToken((v) => v + 1);

  // ——— الأذونات ———
  const mayReply = can(me, "requests.reply");
  const mayNote = can(me, "requests.internal_notes");
  const mayAssign = can(me, "requests.assign");
  const mayStatus = can(me, "requests.status");
  const mayArchive = can(me, "requests.archive");

  // ——— الإجراءات ———
  const patch = async (body: Record<string, unknown>, successMsg?: string) => {
    setBusy(true);
    busyRef.current = true;
    try {
      await apiSend(`/api/admin/requests/${requestId}`, "PATCH", body);
      if (successMsg) toast.success(successMsg);
      reload();
    } catch (err) {
      if (err instanceof ApiError && err.code === "invalid_transition") {
        toast.error(t.auth.errors.generic);
      } else {
        toast.error(apiErrorMessage(err, t.auth.errors));
      }
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
        `/api/account/requests/${requestId}/messages`,
        "POST",
        { body, kind }
      );
      // إلحاق متفائل ثم جلب هادئ لتوحيد البيانات
      setDetail((prev) =>
        prev
          ? {
              ...prev,
              messages: [
                ...prev.messages,
                {
                  ...res.message,
                  author: { id: me.id, name: me.name, roleKey: me.roleKey },
                },
              ],
            }
          : prev
      );
      toast.success(kind === "internal_note" ? tr.sentNote : tr.sentReply);
      const controller = new AbortController();
      void load(controller.signal, true);
    } catch (err) {
      toast.error(apiErrorMessage(err, t.auth.errors));
    } finally {
      setSending(false);
      busyRef.current = false;
    }
  };

  const attachFile = async (file: File) => {
    busyRef.current = true;
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("requestId", requestId);
      await apiUpload("/api/attachments", form);
      toast.success(t.admin.media.uploadedOk);
      reload();
    } catch (err) {
      if (err instanceof ApiError && (err.code === "too_large" || err.code === "file_too_large")) {
        toast.error(td.fileTooLarge);
      } else if (err instanceof ApiError && (err.code === "type_not_allowed" || err.code === "extension_mismatch")) {
        toast.error(td.fileTypeInvalid);
      } else {
        toast.error(apiErrorMessage(err, t.auth.errors));
      }
    } finally {
      busyRef.current = false;
    }
  };

  const applyStatus = async () => {
    if (!statusTarget) return;
    const isClosure = statusTarget === "closed" || statusTarget === "cancelled";
    if (isClosure && closeReason.trim().length === 0) {
      toast.error(t.auth.errors.required);
      return;
    }
    setApplying(true);
    try {
      await patch({ status: statusTarget, note: isClosure ? closeReason.trim() : statusNote.trim() || undefined }, tr.statuses[statusTarget]);
      setStatusNote("");
      setCloseReason("");
    } finally {
      setApplying(false);
    }
  };

  const visibleMessages = useMemo(
    () => (detail ? detail.messages.filter((m) => !(clientView && m.kind === "internal_note")) : []),
    [detail, clientView]
  );

  // ——— الحالات ———
  if (loading && !detail) {
    return (
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <Skeleton className="h-9 w-64 rounded-xl" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-56 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (notFound) {
    return <EmptyState icon={Inbox} title={tr.empty} body={tr.emptyBody} className="py-20" />;
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
  const statusLabel = tr.statuses[detail.status] ?? detail.status;
  const isClosureTarget = statusTarget === "closed" || statusTarget === "cancelled";
  const contactPrefLabel =
    detail.preferredContact === "email" ? siteForm.contactMethods.email
    : detail.preferredContact === "phone" ? siteForm.contactMethods.phone
    : siteForm.contactMethods.any;
  const budgetLabel = siteForm.budgets[detail.budget as keyof typeof siteForm.budgets] ?? detail.budget;
  const currencyLabel = detail.currency
    ? (siteForm.currencies[detail.currency as keyof typeof siteForm.currencies] ?? detail.currency)
    : null;
  const timelineLabel = siteForm.timelines[detail.timeline as keyof typeof siteForm.timelines] ?? detail.timeline;

  return (
    <div className="space-y-5">
      {/* ترويسة الطباعة — تظهر على الورق فقط: العلامة + التاريخ */}
      <div className="hidden print:block print:border-b print:border-border print:pb-2">
        <p className="text-xs font-medium text-muted-foreground">
          {siteMeta.siteName} · {new Date().toLocaleDateString(locale)}
        </p>
      </div>
      {/* الترويسة */}
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="sm" className="min-h-11 rounded-full print:hidden">
          <Link href={`/${locale}/admin/requests`}>
            <BackIcon className="size-4" aria-hidden="true" />
            <span className="sr-only">{tr.title}</span>
            {tr.title}
          </Link>
        </Button>
        <h1 className="font-mono text-xl font-bold text-navy ltr-isolate">{detail.refCode}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={detail.status} label={statusLabel} className="print:break-inside-avoid print:border-border" />
          <PriorityBadge priority={detail.priority} label={tr.priorities[detail.priority] ?? detail.priority} className="print:break-inside-avoid print:border-border" />
          {detail.archivedAt ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              <Archive className="size-3" aria-hidden="true" />
              {tr.archived}
            </span>
          ) : null}
        </div>
        <div className="ms-auto flex flex-wrap items-center gap-2 print:hidden">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            aria-label={tr.print}
            className="min-h-11 rounded-full"
          >
            <Printer className="size-4" aria-hidden="true" />
            {tr.print}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setClientView((v) => !v)}
            aria-pressed={clientView}
            className="min-h-11 rounded-full"
          >
            {clientView ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
            {tr.clientView}
          </Button>
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px] print:block print:space-y-6">
        {/* المحادثة + الملحن */}
        <div className="space-y-4">
          <section aria-label={tr.conversation} className="rounded-2xl border border-border bg-muted/30 p-4 sm:p-5 print:bg-transparent">
            <h2 className="mb-3 text-sm font-semibold text-navy">
              {tr.conversation}
              <span className="ms-2 font-normal text-muted-foreground">
                {detail.messages.length} {tr.messages}
              </span>
            </h2>

            {visibleMessages.length === 0 && !detail.description ? (
              <EmptyState icon={Inbox} title={td.noMessages} />
            ) : (
              <div className="flex max-h-[60vh] flex-col gap-1 overflow-y-auto pe-1 print:max-h-none print:overflow-visible">
                {/* نص الطلب الأصلي كفقاعة افتتاحية من العميل */}
                {detail.description ? (
                  <div className="print:break-inside-avoid print:[&_div]:bg-transparent print:[&_div]:text-foreground print:[&_div]:shadow-none">
                    <MessageBubble
                      locale={locale}
                      message={{
                        id: "opening",
                        authorId: null,
                        authorType: "client",
                        kind: "message",
                        body: detail.description,
                        editedAt: null,
                        createdAt: detail.createdAt,
                        author: null,
                      }}
                      labels={{
                        client: detail.name,
                        staff: td.staff,
                        system: td.system,
                        internalHint: tr.internalNoteHint,
                        statuses: tr.statuses,
                      }}
                    />
                  </div>
                ) : null}
                {visibleMessages.map((message) => (
                  <div
                    key={message.id}
                    className="print:break-inside-avoid print:[&_div]:bg-transparent print:[&_div]:text-foreground print:[&_div]:shadow-none"
                  >
                    <MessageBubble
                      message={message}
                      locale={locale}
                      labels={{
                        client: tr.client,
                        staff: td.staff,
                        system: td.system,
                        internalHint: tr.internalNoteHint,
                        statuses: tr.statuses,
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* الملحن — مخفي عند الطباعة */}
          <div className="print:hidden">
          <ReplyComposer
              canReply={mayReply}
              canNote={!clientView && mayNote}
              sending={sending}
              onSend={sendMessage}
              onAttach={clientView ? undefined : attachFile}
              savedReplies={
                mayReply && !clientView
                  ? {
                      trigger: t.admin.savedReplies.useReply,
                      insert: t.admin.savedReplies.insert,
                      empty: t.admin.savedReplies.empty,
                    }
                  : undefined
              }
              labels={{
                reply: tr.reply,
                internalNote: tr.internalNote,
                internalHint: tr.internalNoteHint,
                placeholder: td.replyPlaceholder,
                send: td.send,
                sending: td.sending,
                attachFile: td.attachFile,
              }}
            />
          </div>
        </div>

        {/* عمود المعلومات */}
        <aside className="space-y-4">
          {/* العميل */}
          <section className="rounded-2xl border border-border bg-white p-4">
            <h2 className="text-sm font-semibold text-navy">{tr.client}</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex items-start justify-between gap-3">
                <dt className="text-muted-foreground">{t.account.profile.name}</dt>
                <dd className="border-s-2 border-border/60 ps-3 font-medium text-navy">
                  {detail.client?.name ?? detail.name}
                  {detail.client?.status ? <UserStatusBadge
                    status={detail.client.status}
                    label={detail.client.status === "active" ? t.admin.users.statusActive : detail.client.status === "pending_verification" ? t.admin.users.statusPending : t.admin.users.statusSuspended}
                    className="ms-2 align-top"
                  /> : null}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-muted-foreground">{t.admin.settings.email}</dt>
                <dd className="min-w-0 truncate border-s-2 border-border/60 ps-3">
                  <a href={`mailto:${detail.email}`} className="break-all text-brand transition-colors hover:text-brand-strong ltr-isolate">
                    {detail.email}
                  </a>
                </dd>
              </div>
              {detail.phone ? (
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-muted-foreground">{t.admin.settings.phone}</dt>
                  <dd className="border-s-2 border-border/60 ps-3 font-medium text-navy ltr-isolate">{detail.phone}</dd>
                </div>
              ) : null}
              {detail.company ? (
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-muted-foreground">{t.account.profile.company}</dt>
                  <dd className="flex items-center gap-1.5 border-s-2 border-border/60 ps-3 font-medium text-navy">
                    <Building2 className="size-3.5 text-muted-foreground" aria-hidden="true" />
                    {detail.company}
                  </dd>
                </div>
              ) : null}
            </dl>
            {detail.clientId ? (
              <Button asChild variant="outline" size="sm" className="mt-3 min-h-10 w-full rounded-xl print:hidden">
                <Link href={`/${locale}/admin/users${buildQuery({ q: detail.email })}`}>
                  {t.admin.users.title}
                </Link>
              </Button>
            ) : null}
          </section>

          {/* بيانات الطلب */}
          <section className="rounded-2xl border border-border bg-white p-4">
            <h2 className="text-sm font-semibold text-navy">{td.requestInfo}</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex items-start justify-between gap-3">
                <dt className="text-muted-foreground">{tr.requestType}</dt>
                <dd className="border-s-2 border-border/60 ps-3 font-medium text-navy">
                  {detail.requestType === "quote" ? tr.quote : tr.discussion}
                </dd>
              </div>
              {/* المعيَّن — سطر طِباعي فقط (نموذج التعيين التفاعلي مخفي في الطباعة) */}
              <div className="hidden print:flex items-start justify-between gap-3">
                <dt className="text-muted-foreground">{tr.filterAssignee}</dt>
                <dd className="border-s-2 border-border/60 ps-3 font-medium text-navy">
                  {detail.assignee?.name ?? tr.unassigned}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-muted-foreground">{tr.filterService}</dt>
                <dd className="border-s-2 border-border/60 ps-3 font-medium text-navy">{tr.services[detail.serviceType] ?? detail.serviceType}</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-muted-foreground">{tr.budget}</dt>
                <dd className="border-s-2 border-border/60 ps-3 font-medium text-navy">{budgetLabel}{currencyLabel ? ` (${currencyLabel})` : ""}</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-muted-foreground">{tr.timelinePref}</dt>
                <dd className="border-s-2 border-border/60 ps-3 font-medium text-navy">{timelineLabel}</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-muted-foreground">{tr.contactPref}</dt>
                <dd className="border-s-2 border-border/60 ps-3 font-medium text-navy">{contactPrefLabel}</dd>
              </div>
              {detail.referenceUrl ? (
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-muted-foreground">{tr.reference}</dt>
                  <dd className="min-w-0 border-s-2 border-border/60 ps-3">
                    <a
                      href={detail.referenceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block truncate text-brand transition-colors hover:text-brand-strong ltr-isolate"
                    >
                      {detail.referenceUrl}
                    </a>
                  </dd>
                </div>
              ) : null}
              <div className="flex items-start justify-between gap-3">
                <dt className="text-muted-foreground">{t.account.profile.language}</dt>
                <dd className="border-s-2 border-border/60 ps-3 font-medium text-navy">{localeMeta[detail.locale === "en" ? "en" : "ar"].label}</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-muted-foreground">{t.admin.users.createdAt}</dt>
                <dd className="border-s-2 border-border/60 ps-3 font-medium text-navy">{fmtDate(detail.createdAt, locale)}</dd>
              </div>
            </dl>
          </section>

          {/* الإدارة: تعيين/أولوية/حالة/أرشفة — مخفية عند الطباعة (المعيَّن يظهر في بيانات الطلب) */}
          <section className="space-y-4 rounded-2xl border border-border bg-white p-4 print:hidden">
            {mayAssign ? (
              <div className="space-y-2">
                <Label>{tr.filterAssignee}</Label>
                <div className="flex items-center gap-2">
                  <Select
                    value={detail.assigneeId ?? "none"}
                    onValueChange={(v) => patch({ assigneeId: v === "none" ? null : v }, v === "none" ? tr.unassigned : undefined)}
                    disabled={busy}
                  >
                    <SelectTrigger className="min-h-11 flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{tr.unassigned}</SelectItem>
                      {staffOptions.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                          {s.id === me.id ? ` (${tr.assignToMe})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-11 shrink-0"
                    disabled={busy || detail.assigneeId === me.id}
                    onClick={() => patch({ assigneeId: me.id }, me.name)}
                    aria-label={tr.assignToMe}
                    title={tr.assignToMe}
                  >
                    <UserPlus className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            ) : null}

            {mayStatus ? (
              <div className="space-y-2">
                <Label>{tr.priority}</Label>
                <Select
                  value={detail.priority}
                  onValueChange={(v) => patch({ priority: v }, tr.priorities[v] ?? v)}
                  disabled={busy}
                >
                  <SelectTrigger className="min-h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_KEYS.map((p) => (
                      <SelectItem key={p} value={p}>{tr.priorities[p]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {mayStatus ? (
              <div className="space-y-2">
                <Label>{tr.changeStatus}</Label>
                <Select value={statusTarget || detail.status} onValueChange={setStatusTarget}>
                  <SelectTrigger className="min-h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_KEYS.map((s) => (
                      <SelectItem key={s} value={s}>{tr.statuses[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isClosureTarget ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="close-reason" className="text-destructive">{tr.closeReason}</Label>
                    <Input
                      id="close-reason"
                      value={closeReason}
                      onChange={(e) => setCloseReason(e.target.value)}
                      placeholder={tr.closeReasonPlaceholder}
                      maxLength={500}
                      className="min-h-11"
                    />
                  </div>
                ) : (
                  <Input
                    value={statusNote}
                    onChange={(e) => setStatusNote(e.target.value)}
                    placeholder={tr.statusNotePlaceholder}
                    maxLength={500}
                    className="min-h-11"
                    aria-label={tr.changeStatus}
                  />
                )}
                <Button
                  onClick={applyStatus}
                  disabled={applying || busy || (statusTarget || detail.status) === detail.status}
                  className="min-h-11 w-full rounded-full"
                >
                  {applying ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
                  {tr.applyStatus}
                </Button>
              </div>
            ) : null}

            {mayArchive ? (
              <Button
                variant={detail.archivedAt ? "outline" : "destructive"}
                onClick={() =>
                  patch({ action: detail.archivedAt ? "restore" : "archive" }, detail.archivedAt ? tr.restore : tr.archived)
                }
                disabled={busy}
                className="min-h-11 w-full rounded-full"
              >
                {detail.archivedAt ? (
                  <ArchiveRestore className="size-4" aria-hidden="true" />
                ) : (
                  <Archive className="size-4" aria-hidden="true" />
                )}
                {detail.archivedAt ? tr.restore : tr.archive}
              </Button>
            ) : null}
          </section>

          {/* المرفقات */}
          <section className="rounded-2xl border border-border bg-white p-4">
            <h2 className="text-sm font-semibold text-navy">{td.attachments}</h2>
            {detail.attachments.length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">{tr.none}</p>
            ) : (
              <ul className="mt-3 space-y-1.5">
                {detail.attachments.map((file: AttachmentRow) => (
                  <li key={file.id} className="print:break-inside-avoid">
                    <a
                      href={`/api/attachments/${file.id}`}
                      className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm transition-colors hover:border-brand hover:bg-accent/40"
                    >
                      <Paperclip className="size-3.5 shrink-0 text-brand" aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate ltr-isolate">{file.filename}</span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{formatBytes(file.size)}</span>
                      <Download className="size-3.5 shrink-0 text-muted-foreground print:hidden" aria-hidden="true" />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* الخط الزمني للحالة */}
          <section className="rounded-2xl border border-border bg-white p-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-navy">
              <History className="size-4 text-brand" aria-hidden="true" />
              {td.statusTimeline}
            </h2>
            {detail.statusHistory.length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">{tr.none}</p>
            ) : (
              <ol className="mt-3 space-y-0">
                {detail.statusHistory.map((event) => (
                  <li key={event.id} className="relative border-s-2 border-border ps-4 pb-4 last:pb-0 print:break-inside-avoid">
                    <span
                      className={cn(
                        "absolute -start-[5px] top-1 size-2 rounded-full",
                        event.toStatus === "closed" || event.toStatus === "cancelled" ? "bg-muted-foreground" : "bg-brand"
                      )}
                      aria-hidden="true"
                    />
                    <p className="text-xs font-semibold text-navy">
                      {event.fromStatus ? `${tr.statuses[event.fromStatus] ?? event.fromStatus} → ` : ""}
                      {tr.statuses[event.toStatus] ?? event.toStatus}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {event.changedBy?.name ?? "—"} · {fmtDateTime(event.createdAt, locale)}
                    </p>
                    {event.note ? (
                      <p className="mt-1 rounded-lg bg-muted px-2 py-1 text-xs text-muted-foreground">{event.note}</p>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
            {detail.resolutionNote ? (
              <p className="mt-2 rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">
                {td.closedNote}: {detail.resolutionNote}
              </p>
            ) : null}
          </section>
        </aside>
      </div>
    </div>
  );
}
