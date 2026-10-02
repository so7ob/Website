"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Info,
  Loader2,
  MessageSquare,
  Paperclip,
  Printer,
  Send,
  ShieldX,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/i18n";
import type { SiteContent } from "@/content/types";
import type { PortalContent } from "@/content/portal/types";
import { apiFetch } from "./api";
import { formatDate, formatRelative, formatBytes } from "./format";
import { StatusBadge } from "./status-badge";
import type { RequestDetail, RequestDetailResponse } from "./types";

const CANCELLABLE = ["new", "in_review", "awaiting_info"];

/** تفاصيل الطلب من منظور العميل: بيانات + محادثة + مرفقات + مسار الحالة */
export function RequestDetailView({
  locale,
  id,
  t,
  d,
  content,
  authErrors,
  priorities,
}: {
  locale: Locale;
  id: string;
  t: PortalContent["account"]["requests"];
  d: PortalContent["account"]["detail"];
  content: SiteContent;
  authErrors: PortalContent["auth"]["errors"];
  priorities: Record<string, string>;
}) {
  const [request, setRequest] = useState<RequestDetail | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelNote, setCancelNote] = useState("");
  const [cancelling, setCancelling] = useState(false);

  const conversationRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const result = await apiFetch<RequestDetailResponse>(`/api/account/requests/${id}`);
    if (result.data.ok && result.data.request) {
      setRequest(result.data.request);
      setPhase("ready");
    } else {
      setErrorCode(result.data.code ?? "error");
      setPhase("error");
    }
  }, [id]);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  // استقصاء دوري للمحادثة — يتوقف عند إخفاء التبويب
  useEffect(() => {
    if (phase !== "ready") return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 20_000);
    return () => clearInterval(timer);
  }, [phase, load]);

  // تمرير المحادثة لآخر رسالة عند وصولها
  const messageCount = request?.messages.length ?? 0;
  useEffect(() => {
    const el = conversationRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messageCount]);

  const conversationLocked = request ? request.status === "closed" || request.status === "cancelled" : false;

  async function sendReply(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (sending || !request) return;
    const body = reply.trim();
    if (!body) {
      toast.error(d.replyEmpty);
      return;
    }
    setSending(true);
    const result = await apiFetch<{ ok?: boolean; code?: string }>(`/api/account/requests/${id}/messages`, {
      method: "POST",
      body: JSON.stringify({ body }),
    });
    setSending(false);

    if (result.data.ok) {
      setReply("");
      toast.success(d.replySuccess);
      await load();
      return;
    }
    if (result.status === 409) {
      await load(); // المحادثة قُفلت من الطاقم meanwhile
      return;
    }
    toast.error(result.status === 429 ? authErrors.rateLimited : authErrors.generic);
  }

  async function onFileSelected(ev: React.ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0];
    ev.target.value = "";
    if (!file || uploading || !request) return;
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    form.append("requestId", id);
    const result = await apiFetch<{ ok?: boolean; code?: string }>(`/api/attachments`, {
      method: "POST",
      body: form,
    });
    setUploading(false);

    if (result.data.ok) {
      await load();
      return;
    }
    if (result.data.code === "too_large") {
      toast.error(d.fileTooLarge);
    } else if (result.data.code === "type_not_allowed") {
      toast.error(d.fileTypeInvalid);
    } else if (result.data.code === "locked") {
      await load();
    } else {
      toast.error(authErrors.generic);
    }
  }

  async function confirmCancel() {
    if (cancelling) return;
    setCancelling(true);
    const result = await apiFetch<{ ok?: boolean; code?: string }>(`/api/account/requests/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ action: "cancel", note: cancelNote.trim() || undefined }),
    });
    setCancelling(false);
    setCancelOpen(false);
    setCancelNote("");
    if (result.data.ok) {
      await load();
      return;
    }
    toast.error(result.status === 409 ? authErrors.invalid : authErrors.generic);
  }

  if (phase === "loading") {
    return (
      <div className="space-y-6" aria-busy="true" aria-label={d.requestInfo}>
        <Skeleton className="animate-shimmer h-9 w-48" />
        <Skeleton className="animate-shimmer h-40 w-full rounded-2xl" />
        <Skeleton className="animate-shimmer h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (phase === "error" || !request) {
    return (
      <div className="rounded-2xl border border-border bg-white p-8 text-center sm:p-12" role="alert">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-100 text-rose-800">
          <ShieldX className="h-7 w-7" aria-hidden="true" />
        </span>
        <p className="mt-4 font-semibold text-navy">{errorCode === "forbidden" || errorCode === "not_found" ? authErrors.invalid : authErrors.generic}</p>
        <Button asChild variant="outline" className="mt-6 h-11 rounded-full px-6 font-semibold">
          <Link href={`/${locale}/account/requests`}>{t.title}</Link>
        </Button>
      </div>
    );
  }

  const statusLabel = t.statuses[request.status] ?? request.status;
  const canCancel = CANCELLABLE.includes(request.status) && !request.archivedAt;

  return (
    <div className="space-y-6">
      {/* ترويسة الطباعة — تظهر على الورق فقط: العلامة + التاريخ */}
      <div className="hidden print:block print:border-b print:border-border print:pb-2">
        <p className="text-xs font-medium text-muted-foreground">
          {content.meta.siteName} · {new Date().toLocaleDateString(locale)}
        </p>
      </div>
      <header className="flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" className="h-11 rounded-full px-4 font-semibold text-muted-foreground print:hidden">
          <Link href={`/${locale}/account/requests`}>
            {locale === "ar" ? <ChevronRight className="h-4 w-4" aria-hidden="true" /> : <ChevronLeft className="h-4 w-4" aria-hidden="true" />}
            {t.title}
          </Link>
        </Button>
        <h1 className="font-mono text-xl font-bold text-navy" dir="ltr">
          {request.refCode}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={request.status} label={statusLabel} className="text-sm print:border print:border-border print:break-inside-avoid" />
        </div>
        <Button
          variant="outline"
          onClick={() => window.print()}
          aria-label={d.print}
          className="ms-auto h-11 rounded-full px-5 font-semibold print:hidden"
        >
          <Printer className="h-4 w-4" aria-hidden="true" />
          {d.print}
        </Button>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] print:block print:space-y-6">
        {/* المحادثة */}
        <div className="min-w-0 space-y-4">
          <section className="rounded-2xl border border-border bg-white p-4 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-lg font-bold text-navy">
                <MessageSquare className="h-5 w-5 text-brand" aria-hidden="true" />
                {d.conversation}
              </h2>
              <p className="hidden text-xs text-muted-foreground sm:block">{d.internalHidden}</p>
            </div>

            <div
              ref={conversationRef}
              className="mt-4 max-h-[28rem] space-y-4 overflow-y-auto rounded-xl bg-muted/30 p-4 print:max-h-none print:overflow-visible print:bg-transparent"
              aria-live="polite"
            >
              {request.messages.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">{d.noMessages}</p>
              ) : (
                request.messages.map((message) =>
                  message.kind === "system" ? (
                    <div key={message.id} className="flex items-center gap-3 print:break-inside-avoid" role="note">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        <Info className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-muted-foreground">
                          {d.system}
                          <span className="ms-2 text-xs font-normal text-muted-foreground/70">
                            {formatRelative(message.createdAt, locale)}
                          </span>
                        </p>
                        {message.body && <p className="mt-1 text-sm leading-7 text-foreground/90">{message.body}</p>}
                      </div>
                    </div>
                  ) : (
                    <div key={message.id} className={cn("flex print:break-inside-avoid", message.authorType === "client" ? "justify-end" : "justify-start")}>
                      <div
                        className={cn(
                          "max-w-[85%] rounded-2xl border px-4 py-3 text-sm leading-7 shadow-sm sm:max-w-[75%] print:border-border print:bg-transparent print:text-foreground print:shadow-none",
                          message.authorType === "client"
                            ? "rounded-se-sm border-brand/10 bg-accent/60 text-foreground"
                            : "rounded-ss-sm border-navy bg-navy text-white shadow-navy/10"
                        )}
                      >
                        <p
                          className={cn(
                            "mb-1 text-xs font-bold",
                            message.authorType === "client" ? "text-brand-strong" : "text-skydrop print:text-navy"
                          )}
                        >
                          {message.authorType === "client" ? d.you : d.staff}
                          <span
                            className={cn(
                              "ms-2 font-normal",
                              message.authorType === "client" ? "text-muted-foreground/80" : "text-white/60 print:text-muted-foreground"
                            )}
                          >
                            {formatRelative(message.createdAt, locale)}
                          </span>
                        </p>
                        <p className="whitespace-pre-wrap break-words">{message.body}</p>
                      </div>
                    </div>
                  )
                )
              )}
            </div>
          </section>

          {/* ملحن الرد — مخفي عند الطباعة */}
          <section className="rounded-2xl border border-border bg-white p-4 sm:p-6 print:hidden">
            {conversationLocked ? (
              <div role="status" className="flex flex-col gap-2 rounded-xl bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">
                <p className="font-semibold text-foreground">{statusLabel}</p>
                {request.resolutionNote && (
                  <p>
                    <span className="font-semibold">{d.closedNote}: </span>
                    {request.resolutionNote}
                  </p>
                )}
              </div>
            ) : (
              <form onSubmit={sendReply} noValidate className="space-y-3">
                <Textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder={d.replyPlaceholder}
                  rows={4}
                  maxLength={8000}
                  aria-label={d.replyPlaceholder}
                  className="min-h-24 resize-y leading-8 focus-visible:ring-2 focus-visible:ring-ring/40"
                  disabled={sending}
                />
                <div className="flex flex-wrap items-center gap-3">
                  <input ref={fileInputRef} type="file" className="hidden" onChange={onFileSelected} aria-hidden="true" tabIndex={-1} />
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 rounded-full px-5 font-semibold"
                    disabled={uploading || sending}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Paperclip className="h-4 w-4" aria-hidden="true" />}
                    {d.attachFile}
                  </Button>
                  <Button
                    type="submit"
                    disabled={sending || uploading}
                    className="ms-auto h-11 rounded-full bg-primary px-8 font-bold text-primary-foreground shadow-md shadow-brand/20 transition-all hover:bg-brand-strong"
                  >
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
                    {sending ? d.sending : d.send}
                  </Button>
                </div>
              </form>
            )}
          </section>
        </div>

        {/* العمود الجانبي: بيانات الطلب + المرفقات + المسار */}
        <div className="space-y-4">
          <section className="rounded-2xl border border-border bg-white p-4 sm:p-6">
            <h2 className="text-lg font-bold text-navy">{d.requestInfo}</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <InfoRow label={t.status} value={<StatusBadge status={request.status} label={statusLabel} className="print:border print:border-border print:break-inside-avoid" />} />
              <InfoRow label={t.service} value={t.services[request.serviceType] ?? request.serviceType} />
              <InfoRow label={d.priority} value={priorities[request.priority] ?? request.priority} />
              <InfoRow label={d.assignedTo} value={request.assignee?.name ?? d.unassigned} icon={<User className="h-3.5 w-3.5" aria-hidden="true" />} />
              <InfoRow label={t.created} value={formatDate(request.createdAt, locale)} icon={<Calendar className="h-3.5 w-3.5" aria-hidden="true" />} />
              <InfoRow label={t.lastActivity} value={formatRelative(request.lastActivityAt, locale)} icon={<Clock className="h-3.5 w-3.5" aria-hidden="true" />} />
              <InfoRow label={d.budget} value={content.form.budgets[request.budget as keyof typeof content.form.budgets] ?? request.budget} />
              {request.currency && <InfoRow label={d.currency} value={content.form.currencies[request.currency as keyof typeof content.form.currencies] ?? request.currency} />}
              <InfoRow label={d.timeline} value={content.form.timelines[request.timeline as keyof typeof content.form.timelines] ?? request.timeline} />
              <InfoRow label={d.contactPref} value={content.form.contactMethods[request.preferredContact as keyof typeof content.form.contactMethods] ?? request.preferredContact} />
              {request.referenceUrl && (
                <InfoRow
                  label={d.reference}
                  value={
                    <a
                      href={request.referenceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      dir="ltr"
                      className="block max-w-full truncate font-mono text-xs text-brand underline decoration-brand/40 underline-offset-4 hover:text-brand-strong"
                    >
                      {request.referenceUrl}
                    </a>
                  }
                />
              )}
              {request.resolutionNote && <InfoRow label={d.closedNote} value={request.resolutionNote} />}
            </dl>

            {canCancel && (
              <Button
                variant="outline"
                className="mt-5 h-11 w-full rounded-full font-semibold text-red-700 hover:border-red-300 hover:bg-red-50 hover:text-red-800 print:hidden"
                onClick={() => setCancelOpen(true)}
              >
                {t.cancelEdit} · {statusLabel}
              </Button>
            )}
          </section>

          {request.attachments.length > 0 && (
            <section className="rounded-2xl border border-border bg-white p-4 sm:p-6">
              <h2 className="text-lg font-bold text-navy">{d.attachments}</h2>
              <ul className="mt-4 space-y-2">
                {request.attachments.map((file) => (
                  <li key={file.id} className="print:break-inside-avoid">
                    <a
                      href={`/api/attachments/${file.id}`}
                      download={file.filename}
                      className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5 text-sm transition-colors hover:border-brand hover:bg-accent/40"
                    >
                      <Paperclip className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate font-medium text-navy">{file.filename}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(file.size, locale)}</span>
                      <Download className="h-4 w-4 shrink-0 text-muted-foreground print:hidden" aria-hidden="true" />
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="rounded-2xl border border-border bg-white p-4 sm:p-6">
            <h2 className="text-lg font-bold text-navy">{d.statusTimeline}</h2>
            <ol className="mt-4 space-y-5">
              {request.statusHistory.map((event, index) => {
                const latest = index === request.statusHistory.length - 1;
                return (
                  <li key={event.id} className="relative ps-6 print:break-inside-avoid">
                    {index < request.statusHistory.length - 1 && (
                      <span className="absolute start-[0.3125rem] top-3 bottom-[-1.25rem] w-px bg-border" aria-hidden="true" />
                    )}
                    <span
                      className={cn(
                        "absolute start-0 top-1.5 size-2.5 rounded-full transition-all duration-300",
                        latest ? "bg-brand ring-4 ring-brand/15" : "bg-border"
                      )}
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-navy">
                        {event.fromStatus ? `${t.statuses[event.fromStatus] ?? event.fromStatus} → ` : ""}
                        {t.statuses[event.toStatus] ?? event.toStatus}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatDate(event.createdAt, locale)}
                        {event.changedBy?.name ? ` · ${event.changedBy.name}` : ""}
                      </p>
                      {event.note && <p className="mt-1 text-sm leading-6 text-muted-foreground">{event.note}</p>}
                    </div>
                  </li>
                );
              })}
              {request.statusHistory.length === 0 && (
                <li className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-green-600" aria-hidden="true" />
                  {statusLabel} · {formatDate(request.createdAt, locale)}
                </li>
              )}
            </ol>
          </section>
        </div>
      </div>

      {/* حوار إلغاء الطلب */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-navy">
              {t.cancelEdit} · {request.refCode}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              value={cancelNote}
              onChange={(e) => setCancelNote(e.target.value)}
              rows={3}
              maxLength={500}
              aria-label={d.closedNote}
              placeholder={d.closedNote}
              className="focus-visible:ring-2 focus-visible:ring-ring/40"
            />
            <Button
              onClick={confirmCancel}
              disabled={cancelling}
              className="h-11 w-full rounded-full bg-red-600 font-bold text-white hover:bg-red-700"
            >
              {cancelling ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              {t.cancelEdit} · {t.statuses.cancelled}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoRow({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="min-w-0 border-s-2 border-border/60 ps-3 text-sm font-medium text-navy">
        {icon && <span className="me-1 inline-flex align-middle text-muted-foreground">{icon}</span>}
        {value}
      </dd>
    </div>
  );
}
