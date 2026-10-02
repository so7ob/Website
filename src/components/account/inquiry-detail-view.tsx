"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Clock,
  Download,
  Loader2,
  Lock,
  MessageSquare,
  Paperclip,
  Printer,
  SearchX,
  Send,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/i18n";
import type { PortalContent } from "@/content/portal/types";
import { fetchInquiryDetail, sendInquiryReply } from "./api";
import { formatBytes, formatDate, formatRelative } from "./format";
import { StatusBadge } from "./status-badge";
import type { InquiryDetail, InquiryMessage } from "./types";

/** رسالة نظامية — شريحة وسطى بحالة جديدة (نفس تحليل محادثة الإدارة) */
function InquirySystemNote({ message, t }: { message: InquiryMessage; t: PortalContent["account"]["inquiries"] }) {
  const [, status, ...rest] = message.body.split(":");
  const note = rest.join(":").trim();
  const statusLabel = status && t.statuses[status] ? `${t.statuses[status]}${note ? ` — ${note}` : ""}` : message.body;
  return (
    <div className="flex justify-center print:break-inside-avoid" role="note">
      <span className="mx-auto max-w-lg rounded-full bg-muted px-3 py-1 text-center text-xs text-muted-foreground">
        {statusLabel}
      </span>
    </div>
  );
}

/** تفاصيل الاستفسار من منظور العميل: محادثة + ملحن رد + بيانات جانبية */
export function InquiryDetailView({
  locale,
  id,
  t,
  authErrors,
  siteName,
}: {
  locale: Locale;
  id: string;
  t: PortalContent["account"]["inquiries"];
  authErrors: PortalContent["auth"]["errors"];
  siteName: string;
}) {
  const [inquiry, setInquiry] = useState<InquiryDetail | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "notFound">("loading");
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const conversationRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const result = await fetchInquiryDetail(id);
    if (result.data.ok && result.data.inquiry) {
      setInquiry(result.data.inquiry);
      setPhase("ready");
    } else {
      // 404 not_found أو أي فشل — رسالة ودّية موحدة مع زر عودة
      setPhase("notFound");
    }
  }, [id]);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  // تمرير المحادثة لآخر رسالة عند وصولها
  const messageCount = inquiry?.messages.length ?? 0;
  useEffect(() => {
    const el = conversationRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messageCount]);

  const conversationLocked = inquiry ? inquiry.status === "closed" : false;

  async function sendReply(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (sending || !inquiry) return;
    const body = reply.trim();
    if (!body) {
      toast.error(t.replyEmpty);
      return;
    }
    setSending(true);
    const result = await sendInquiryReply(id, body);
    setSending(false);

    if (result.data.ok) {
      setReply("");
      toast.success(t.replySuccess);
      if (result.data.message) {
        // إلحاق الرسالة الجديدة بالمحادثة مباشرة دون إعادة جلب
        const sent = result.data.message;
        setInquiry((prev) => (prev ? { ...prev, messages: [...prev.messages, sent] } : prev));
      } else {
        await load();
      }
      return;
    }
    if (result.data.code === "closed") {
      await load(); // قُفل الاستفسار من الطاقم أثناء الكتابة
      return;
    }
    if (result.data.code === "empty") {
      toast.error(t.replyEmpty);
      return;
    }
    if (result.status === 429) {
      toast.error(authErrors.rateLimited);
      return;
    }
    toast.error(authErrors.generic);
  }

  if (phase === "loading") {
    return (
      <div className="space-y-5" aria-busy="true" aria-label={t.title}>
        <Skeleton className="animate-shimmer h-9 w-48" />
        <Skeleton className="animate-shimmer h-6 w-2/3" />
        <Skeleton className="animate-shimmer h-72 w-full rounded-2xl" />
      </div>
    );
  }

  if (phase === "notFound" || !inquiry) {
    return (
      <div className="rounded-2xl border border-border bg-white p-8 text-center sm:p-12" role="alert">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-100 text-rose-800">
          <SearchX className="h-7 w-7" aria-hidden="true" />
        </span>
        <p className="mt-4 font-semibold text-navy">{t.notFound}</p>
        <Button
          asChild
          variant="outline"
          className="mt-6 h-11 rounded-full px-6 font-semibold focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <Link href={`/${locale}/account/inquiries`}>{t.back}</Link>
        </Button>
      </div>
    );
  }

  const BackIcon = locale === "ar" ? ArrowRight : ArrowLeft;
  const statusLabel = t.statuses[inquiry.status] ?? inquiry.status;

  return (
    <div className="space-y-5">
      {/* ترويسة الطباعة — تظهر على الورق فقط: العلامة + التاريخ */}
      <div className="hidden print:block print:border-b print:border-border print:pb-2">
        <p className="text-xs font-medium text-muted-foreground">
          {siteName} · {new Date().toLocaleDateString(locale)}
        </p>
      </div>
      <header className="flex flex-wrap items-center gap-3">
        <Button
          asChild
          variant="ghost"
          className="h-11 rounded-full px-4 font-semibold text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/40 print:hidden"
        >
          <Link href={`/${locale}/account/inquiries`}>
            <BackIcon className="h-4 w-4" aria-hidden="true" />
            {t.back}
          </Link>
        </Button>
        <h1 className="font-mono text-lg font-bold text-navy ltr-isolate" dir="ltr">
          {inquiry.refCode}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge
            status={inquiry.status}
            label={statusLabel}
            className="text-sm print:border print:border-border print:break-inside-avoid"
          />
          <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-brand-strong">
            {t.categories[inquiry.category] ?? inquiry.category}
          </span>
        </div>
        <Button
          variant="outline"
          onClick={() => window.print()}
          aria-label={t.print}
          className="ms-auto h-11 rounded-full px-5 font-semibold focus-visible:ring-2 focus-visible:ring-ring/40 print:hidden"
        >
          <Printer className="h-4 w-4" aria-hidden="true" />
          {t.print}
        </Button>
      </header>

      <h2 className="text-lg font-semibold text-navy">{inquiry.subject}</h2>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px] print:block print:space-y-6">
        {/* المحادثة + ملحن الرد */}
        <div className="min-w-0 space-y-4">
          <section className="rounded-2xl border border-border bg-white p-4 sm:p-6">
            <h2 className="flex items-center gap-2 text-lg font-bold text-navy">
              <MessageSquare className="h-5 w-5 text-brand" aria-hidden="true" />
              {t.conversation}
            </h2>

            <div
              ref={conversationRef}
              className="mt-4 max-h-[28rem] space-y-4 overflow-y-auto rounded-xl bg-muted/30 p-4 print:max-h-none print:overflow-visible print:bg-transparent"
              aria-live="polite"
            >
              {inquiry.messages.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">{t.noMessages}</p>
              ) : (
                inquiry.messages.map((message) =>
                  message.kind === "system" ? (
                    <InquirySystemNote key={message.id} message={message} t={t} />
                  ) : (
                    <div
                      key={message.id}
                      className={cn("flex print:break-inside-avoid", message.authorType === "client" ? "justify-end" : "justify-start")}
                    >
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
                          {message.authorType === "client" ? t.you : (message.author?.name ?? t.team)}
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
              <div
                role="status"
                className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-7 text-amber-900"
              >
                <Lock className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" />
                <p>{t.closedNote}</p>
              </div>
            ) : (
              <form onSubmit={sendReply} noValidate className="space-y-3">
                <Textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder={t.replyPlaceholder}
                  rows={4}
                  maxLength={8000}
                  aria-label={t.replyPlaceholder}
                  className="min-h-24 resize-y leading-8 focus-visible:ring-2 focus-visible:ring-ring/40"
                  disabled={sending}
                />
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    type="submit"
                    disabled={sending || reply.trim().length === 0}
                    className="ms-auto h-11 rounded-full bg-primary px-8 font-bold text-primary-foreground shadow-md shadow-brand/20 transition-all hover:bg-brand-strong focus-visible:ring-2 focus-visible:ring-ring/40"
                  >
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
                    {sending ? t.sending : t.send}
                  </Button>
                </div>
              </form>
            )}
          </section>
        </div>

        {/* العمود الجانبي: بيانات الاستفسار + المرفقات */}
        <div className="space-y-4">
          <section className="rounded-2xl border border-border bg-white p-4 sm:p-6">
            <h2 className="text-lg font-bold text-navy">{t.meta}</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <InfoRow
                label={t.refCode}
                value={
                  <span className="font-mono ltr-isolate" dir="ltr">
                    {inquiry.refCode}
                  </span>
                }
              />
              <InfoRow label={t.subject} value={inquiry.subject} />
              <InfoRow label={t.category} value={t.categories[inquiry.category] ?? inquiry.category} />
              <InfoRow
                label={t.status}
                value={
                  <StatusBadge
                    status={inquiry.status}
                    label={statusLabel}
                    className="print:border print:border-border print:break-inside-avoid"
                  />
                }
              />
              <InfoRow label={t.created} value={formatDate(inquiry.createdAt, locale)} icon={<Calendar className="h-3.5 w-3.5" aria-hidden="true" />} />
              <InfoRow
                label={t.lastActivity}
                value={formatRelative(inquiry.lastActivityAt, locale)}
                icon={<Clock className="h-3.5 w-3.5" aria-hidden="true" />}
              />
              <InfoRow
                label={t.assignedTo}
                value={inquiry.assignee?.name ?? t.unassigned}
                icon={<User className="h-3.5 w-3.5" aria-hidden="true" />}
              />
            </dl>
          </section>

          {inquiry.attachments.length > 0 && (
            <section className="rounded-2xl border border-border bg-white p-4 sm:p-6">
              <h2 className="text-lg font-bold text-navy">{t.attachments}</h2>
              <ul className="mt-4 space-y-2">
                {inquiry.attachments.map((file) => {
                  const name = file.filename ?? file.name ?? file.id;
                  const href = file.url ?? `/api/attachments/${file.id}`;
                  return (
                    <li key={file.id} className="print:break-inside-avoid">
                      <a
                        href={href}
                        download={name}
                        className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5 text-sm transition-colors hover:border-brand hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                      >
                        <Paperclip className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
                        <span className="min-w-0 flex-1 truncate font-medium text-navy">{name}</span>
                        {typeof file.size === "number" ? (
                          <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(file.size, locale)}</span>
                        ) : null}
                        <Download className="h-4 w-4 shrink-0 text-muted-foreground print:hidden" aria-hidden="true" />
                        <span className="sr-only">{t.download}</span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>
      </div>
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
