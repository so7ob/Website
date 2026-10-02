"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bot,
  Calendar,
  Check,
  Clock,
  Copy,
  History,
  Hourglass,
  Info,
  Loader2,
  LogIn,
  MessageSquare,
  Paperclip,
  Send,
  ShieldAlert,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import type { Locale } from "@/lib/i18n";
import type { PortalContent } from "@/content/portal/types";
import { formatBytes, formatDate } from "@/components/account/format";
import { cn } from "@/lib/utils";

type TrackStrings = PortalContent["track"];

/* ===== عقود واجهة المتابعة — مطابقة لمسارات /api/track ===== */

type Scope = "request" | "inquiry";

interface TrackTimelineEvent {
  toStatus: string;
  at: string;
}

interface TrackAttachment {
  id: string;
  filename: string;
  size: number;
  mimeType: string;
}

interface TrackMessage {
  id: string;
  authorType: "client" | "staff" | "system";
  authorName: string | null;
  body: string;
  createdAt: string;
  attachments: TrackAttachment[];
}

interface TrackCard {
  scope: Scope;
  id: string;
  refCode: string;
  typeLabel: string;
  subject: string;
  description: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  timeline: TrackTimelineEvent[];
  messages: TrackMessage[];
}

interface TrackPolicy {
  mode: "login_required" | "link_view" | "link_reply" | "link_view_login_reply";
  source: string;
  canViewViaLink: boolean;
  canReplyViaLink: boolean;
  canReplyByOwner: boolean;
  cardClosed: boolean;
}

interface TrackLink {
  expiresAt: string;
  state: "valid" | "expired" | "revoked";
}

interface TrackAccess {
  via: "account" | "link";
}

interface CardPayload {
  card: TrackCard;
  policy: TrackPolicy;
  link: TrackLink | null;
  access: TrackAccess;
}

type Phase = "loading" | "ready" | FailurePhase;
type FailurePhase = "invalid" | "expired" | "revoked" | "policy_denied" | "login_required" | "rate_limited";

/* ===== ثوابت العرض ===== */

/** ألوان شريحة الحالة — أزواج ناعمة بهوية العلامة (بلا نيلي) */
const STATUS_CHIP_CLASSES: Record<string, string> = {
  new: "bg-brand-soft text-brand-strong",
  in_review: "bg-amber-100 text-amber-800",
  awaiting_info: "bg-amber-100 text-amber-800",
  in_progress: "bg-amber-100 text-amber-800",
  responded: "bg-green-100 text-green-800",
  closed: "bg-muted text-muted-foreground",
  cancelled: "bg-muted text-muted-foreground",
};

const STATUS_CHIP_FALLBACK = "bg-muted text-muted-foreground";

/** أيقونة ودائرة لون لكل حالة فشل */
const FAILURE_META: Record<FailurePhase, { icon: LucideIcon; circle: string }> = {
  invalid: { icon: XCircle, circle: "bg-rose-100 text-rose-700" },
  expired: { icon: Hourglass, circle: "bg-amber-100 text-amber-800" },
  revoked: { icon: ShieldAlert, circle: "bg-rose-100 text-rose-700" },
  policy_denied: { icon: ShieldAlert, circle: "bg-amber-100 text-amber-800" },
  login_required: { icon: LogIn, circle: "bg-brand-soft text-brand-strong" },
  rate_limited: { icon: Hourglass, circle: "bg-amber-100 text-amber-800" },
};

/** تحليل معامل card بصيغة scope:id — يقبل "?card=..." أو القيمة المجردة */
function parseCardParam(raw: string): { scope: Scope; id: string } | null {
  const value = raw.startsWith("?") ? raw.slice(1) : raw;
  const card = new URLSearchParams(value).get("card") ?? (value.includes(":") ? value : "");
  const sep = card.indexOf(":");
  if (sep < 1 || sep === card.length - 1) return null;
  const scope = card.slice(0, sep);
  const id = card.slice(sep + 1);
  return scope === "request" || scope === "inquiry" ? { scope, id } : null;
}

/** تحصين أشكال المصفوفات القادمة من الخادم */
function normalizeCard(card: TrackCard): TrackCard {
  return {
    ...card,
    timeline: Array.isArray(card.timeline) ? card.timeline : [],
    messages: Array.isArray(card.messages)
      ? card.messages.map((message) => ({ ...message, attachments: Array.isArray(message.attachments) ? message.attachments : [] }))
      : [],
  };
}

/**
 * صفحة متابعة البطاقة العامة — آلة حالات: تبديل توكن → تحميل بطاقة → عرض/رد.
 * تعمل بحساب مخوّل أو برابط متابعة وفق سياسة الوصول التي يقررها الخادم.
 */
export function TrackClient({
  locale,
  t,
  siteNames,
  token,
  cardParam,
}: {
  locale: Locale;
  t: TrackStrings;
  siteNames: { nameAr: string; nameEn: string };
  token?: string;
  cardParam?: string;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("loading");
  const [data, setData] = useState<CardPayload | null>(null);
  const [cardKey, setCardKey] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [replyBlocked, setReplyBlocked] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // حراس مرجعيون: توقيع المدخل المُعالج (يفصل تشغيلَي StrictMode)، مفتاح آخر بطاقة جُلّيت، ورابط المشاركة الملتقط
  const handledRef = useRef<string | null>(null);
  const loadedCardRef = useRef<string | null>(null);
  const shareUrlRef = useRef<string | null>(null);
  const sendingRef = useRef(false);
  const copyTimerRef = useRef<number | null>(null);
  const conversationRef = useRef<HTMLDivElement>(null);

  /** تحميل بطاقة عبر scope:id — يمنع الجلب المكرر لنفس المفتاح (force يتجاوز الحارس لمسار التبادل) */
  const loadCard = useCallback(async (scope: Scope, id: string, opts?: { force?: boolean }) => {
    const key = `${scope}:${id}`;
    if (!opts?.force && loadedCardRef.current === key) return;
    loadedCardRef.current = key;
    setCardKey(key);
    setPhase("loading");
    setData(null);
    try {
      const res = await fetch(`/api/track/card?scope=${encodeURIComponent(scope)}&id=${encodeURIComponent(id)}`);
      if (res.ok) {
        const json = (await res.json().catch(() => null)) as
          | (CardPayload & { ok?: boolean })
          | { ok?: false }
          | null;
        if (json?.ok && json.card && json.policy && json.access) {
          setData({ card: normalizeCard(json.card), policy: json.policy, link: json.link ?? null, access: json.access });
          setPhase("ready");
          return;
        }
        setPhase("invalid");
        return;
      }
      if (res.status === 403) {
        const err = (await res.json().catch(() => null)) as { code?: string } | null;
        if (err?.code === "policy_denied") {
          setPhase("policy_denied");
          return;
        }
        if (err?.code === "owner_required") {
          setPhase("login_required");
          return;
        }
        if (err?.code === "revoked") {
          setPhase("revoked");
          return;
        }
        if (err?.code === "expired") {
          setPhase("expired");
          return;
        }
      }
      // 404 not_found أو أي فشل آخر — الرابط غير صالح
      setPhase("invalid");
    } catch {
      setPhase("invalid");
    }
  }, []);

  // آلة الحالات عند الدخول: توكن → تبديل، معامل بطاقة → تحميل مباشر، ولا شيء → رابط غير صالح
  useEffect(() => {
    const signature = token ? `t:${token}` : cardParam ? `c:${cardParam}` : "none";
    // حارس متزامن: يمنع إعادة التنفيذ عند تكرار التركيب (StrictMode) أو تكرار نفس المدخل
    if (handledRef.current === signature) return;
    handledRef.current = signature;

    void (async () => {
      if (token) {
        try {
          const res = await fetch("/api/track/exchange", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token }),
          });
          if (res.ok) {
            const json = (await res.json().catch(() => null)) as { ok?: boolean; url?: string } | null;
            const card = json?.ok ? parseCardParam(json.url ?? "") : null;
            if (card) {
              // التقاط الرابط الكامل الحالي (حامل التوكن) قبل استبداله — ليصبح رابط المتابعة القابل للمشاركة
              const href = window.location.href;
              shareUrlRef.current = href;
              setShareUrl(href);
              router.replace(`/${locale}/track?card=${card.scope}:${encodeURIComponent(card.id)}`);
              // جلب قسري: الحارس سيحمي من إعادة الجلب عندما يعيد router.replace التأثير بمفتاح البطاقة نفسه
              await loadCard(card.scope, card.id, { force: true });
              return;
            }
            setPhase("invalid");
            return;
          }
          if (res.status === 429) {
            setPhase("rate_limited");
            return;
          }
          const err = (await res.json().catch(() => null)) as { code?: string } | null;
          if (err?.code === "revoked") setPhase("revoked");
          else if (err?.code === "expired") setPhase("expired");
          else setPhase("invalid");
        } catch {
          // فشل شبكة — الافتراض الآمن: رابط غير صالح
          setPhase("invalid");
        }
        return;
      }

      if (cardParam) {
        const card = parseCardParam(cardParam);
        if (card) {
          await loadCard(card.scope, card.id);
          return;
        }
        setPhase("invalid");
        return;
      }

      setPhase("invalid");
    })();
  }, [token, cardParam, locale, router, loadCard]);

  // تمرير المحادثة إلى آخر رسالة عند وصولها
  const messageCount = data?.card.messages.length ?? 0;
  useEffect(() => {
    const el = conversationRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messageCount]);

  // تنظيف مؤقت شارة «نُسخ الرابط»
  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
    };
  }, []);

  /** إرسال رد الزائر/المالك — لا يُمسّ النص إلا عند النجاح */
  async function submitReply(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (sendingRef.current || !data) return;
    const body = reply.trim();
    if (!body) return;
    sendingRef.current = true;
    setSending(true);
    try {
      const res = await fetch("/api/track/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: data.card.scope, id: data.card.id, body }),
      });
      if (res.ok) {
        const json = (await res.json().catch(() => null)) as { ok?: boolean; message?: TrackMessage } | null;
        if (json?.ok) {
          setReply("");
          toast.success(t.replySent);
          if (json.message) {
            const sent = json.message;
            setData((prev) =>
              prev ? { ...prev, card: { ...prev.card, messages: [...prev.card.messages, sent] } } : prev
            );
          }
          return;
        }
        toast.error(t.replyFailed);
        return;
      }
      if (res.status === 409) {
        toast.error(t.replyDuplicate);
        return;
      }
      if (res.status === 403) {
        toast.error(t.replyDisabledLogin);
        setReplyBlocked(true);
        return;
      }
      toast.error(t.replyFailed);
    } catch {
      toast.error(t.replyFailed);
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }

  /** نسخ رابط المتابعة الملتقط — فشل الحافظة يعالج برسالة ودّية */
  async function copyShareLink() {
    const url = shareUrlRef.current;
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t.replyFailed);
    }
  }

  const siteName = locale === "ar" ? siteNames.nameAr : siteNames.nameEn;

  /* ----- شاشة التحميل: لا شاشة فارغة أبدًا ----- */
  if (phase === "loading") {
    return (
      <div className="flex w-full flex-col">
        <div className="flex min-h-48 items-center justify-center py-16" role="status" aria-busy="true">
          <span className="sr-only">{t.title}</span>
          <Loader2 className="size-8 animate-spin text-brand" aria-hidden="true" />
        </div>
        <p className="mt-10 text-center text-xs text-muted-foreground">{siteName}</p>
      </div>
    );
  }

  /* ----- حالات الفشل: بطاقة كاملة بأيقونة ملونة ورسالة ودية ----- */
  if (phase !== "ready" || !data) {
    const meta = FAILURE_META[phase];
    const text: { title: string; body?: string } =
      phase === "invalid"
        ? { title: t.invalid, body: t.invalidBody }
        : phase === "expired"
          ? { title: t.expired, body: t.expiredBody }
          : phase === "revoked"
            ? { title: t.revoked, body: t.revokedBody }
            : phase === "rate_limited"
              ? { title: t.rateLimited }
              : { title: t.loginRequired, body: t.loginRequiredBody };
    const FailureIcon = meta.icon;
    const needsSignIn = (phase === "login_required" || phase === "policy_denied") && cardKey;

    return (
      <div className="flex w-full flex-col">
        <div className="rounded-3xl border border-border bg-white p-8 text-center sm:p-12" role="alert">
          <span className={cn("mx-auto flex size-16 items-center justify-center rounded-full", meta.circle)}>
            <FailureIcon className="size-8" aria-hidden="true" />
          </span>
          <h1 className="mt-5 text-2xl font-bold text-navy">{text.title}</h1>
          {text.body && <p className="mx-auto mt-3 max-w-md leading-8 text-muted-foreground">{text.body}</p>}
          {needsSignIn && (
            <Button
              asChild
              className="mt-6 h-11 rounded-full bg-primary px-8 font-bold text-primary-foreground shadow-md shadow-brand/20 transition-all hover:bg-brand-strong"
            >
              <Link href={`/${locale}/auth/login?next=${encodeURIComponent(`/${locale}/track?card=${cardKey}`)}`}>
                <LogIn className="size-4" aria-hidden="true" />
                {t.signIn}
              </Link>
            </Button>
          )}
          <div className="mt-8">
            <Link
              href={`/${locale}`}
              className="inline-flex min-h-11 items-center rounded-lg px-4 text-sm text-muted-foreground underline decoration-border underline-offset-4 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              {t.backHome}
            </Link>
          </div>
        </div>
        <p className="mt-10 text-center text-xs text-muted-foreground">{siteName}</p>
      </div>
    );
  }

  /* ----- عرض البطاقة ----- */
  const { card, policy, access } = data;
  const viaLink = access.via === "link";
  const statusLabel = (t.statusLabels as Record<string, string>)[card.status] ?? card.status;
  const statusChip = STATUS_CHIP_CLASSES[card.status] ?? STATUS_CHIP_FALLBACK;
  const typeLabel = t.cardType[card.scope] ?? card.typeLabel;
  const clientAuthorLabel = viaLink ? t.guestAuthor : t.ownerAuthor;
  const timeline = card.timeline;

  // صلاحية الرد: بطاقة غير مغلقة + سياسة تسمح حسب طريقة الوصول (لم يُحجب الرد بخطأ 403 سابقًا)
  const canReply =
    !replyBlocked &&
    !policy.cardClosed &&
    (viaLink ? policy.canReplyViaLink : policy.canReplyByOwner);
  const replyDenial = replyBlocked
    ? t.replyDisabledLogin
    : policy.cardClosed
      ? t.replyDisabledClosed
      : viaLink
        ? t.replyDisabledView
        : t.replyDisabledClosed;

  return (
    <div className="w-full space-y-5">
      {/* ترويسة البطاقة: النوع والحالة، الرقم المرجعي، الموضوع والوصف، التواريخ */}
      <section className="rounded-2xl border border-border bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-brand-strong">{typeLabel}</span>
          <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", statusChip)}>{statusLabel}</span>
        </div>

        <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.refLabel}</p>
        <p className="ltr-isolate mt-1 font-mono text-xl font-bold text-navy" dir="ltr">
          {card.refCode}
        </p>

        <h1 className="mt-3 break-words text-xl font-bold text-navy">{card.subject}</h1>
        {card.description ? (
          <p className="mt-3 whitespace-pre-line break-words text-sm leading-7 text-muted-foreground">{card.description}</p>
        ) : null}

        <dl className="mt-5 space-y-2 border-t border-border pt-4 text-sm">
          <div className="flex items-center gap-2">
            <Calendar className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <dt className="text-muted-foreground">{t.created}:</dt>
            <dd className="font-medium text-navy">{formatDate(card.createdAt, locale)}</dd>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <dt className="text-muted-foreground">{t.lastUpdate}:</dt>
            <dd className="font-medium text-navy">{formatDate(card.updatedAt, locale)}</dd>
          </div>
        </dl>
      </section>

      {/* رابط المتابعة — يظهر لمن دخل عبر توكن: نسخ الرابط القابل للمشاركة */}
      {shareUrl && (
        <section
          className="flex flex-col gap-3 rounded-2xl border border-border bg-accent/40 p-4 sm:flex-row sm:items-center sm:justify-between"
          aria-label={t.copyTracking}
        >
          <p className="text-sm leading-7 text-muted-foreground">{t.trackingHint}</p>
          <Button
            type="button"
            variant="outline"
            onClick={copyShareLink}
            className="h-11 shrink-0 rounded-full border-border px-5 font-semibold text-navy hover:border-brand hover:text-brand"
          >
            {copied ? (
              <Check className="size-4 text-green-700" aria-hidden="true" />
            ) : (
              <Copy className="size-4" aria-hidden="true" />
            )}
            {copied ? t.copied : t.copyTracking}
          </Button>
        </section>
      )}

      {/* تسلسل الحالة — يُخفى إن لم توجد أحداث */}
      {timeline.length > 0 && (
        <section className="rounded-2xl border border-border bg-white p-5 sm:p-6">
          <h2 className="flex items-center gap-2 text-lg font-bold text-navy">
            <History className="size-5 text-brand" aria-hidden="true" />
            {t.timeline}
          </h2>
          <ol className="mt-5">
            {timeline.map((event, index) => (
              <li
                key={`${event.toStatus}-${index}`}
                className={cn("relative border-s-2 border-border ps-4", index < timeline.length - 1 && "pb-5")}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute top-1.5 -start-[5px] size-2 rounded-full",
                    index === timeline.length - 1 ? "bg-brand" : "bg-border"
                  )}
                />
                <p className="text-sm font-semibold text-navy">
                  {(t.statusLabels as Record<string, string>)[event.toStatus] ?? event.toStatus}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{formatDate(event.at, locale)}</p>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* المحادثة */}
      <section className="rounded-2xl border border-border bg-white p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-bold text-navy">
          <MessageSquare className="size-5 text-brand" aria-hidden="true" />
          {t.conversation}
        </h2>
        <div
          ref={conversationRef}
          className="mt-4 max-h-96 space-y-5 overflow-y-auto pe-1"
          aria-live="polite"
        >
          {card.messages.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              {t.noReplies}
            </p>
          ) : (
            card.messages.map((message) => {
              const isStaff = message.authorType === "staff";
              const isClient = message.authorType === "client";
              const name = isStaff
                ? message.authorName ?? t.staffAuthor
                : isClient
                  ? clientAuthorLabel
                  : t.staffAuthor;
              return (
                <div key={message.id} className="flex gap-3">
                  {isStaff ? (
                    <span
                      aria-hidden="true"
                      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground"
                    >
                      {name.trim().charAt(0)}
                    </span>
                  ) : isClient ? (
                    <span
                      aria-hidden="true"
                      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold text-muted-foreground"
                    >
                      {name.trim().charAt(0)}
                    </span>
                  ) : (
                    <span
                      aria-hidden="true"
                      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
                    >
                      <Bot className="size-4" aria-hidden="true" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-navy">
                      {name}
                      <span className="ms-2 font-normal text-muted-foreground">
                        {formatDate(message.createdAt, locale)}
                      </span>
                    </p>
                    <p className="mt-1 whitespace-pre-line break-words text-sm leading-7 text-foreground">{message.body}</p>
                    {message.attachments.length > 0 && (
                      <ul className="mt-2 space-y-1.5">
                        {message.attachments.map((file) => (
                          <li
                            key={file.id}
                            className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs"
                          >
                            <Paperclip className="size-3.5 shrink-0 text-brand" aria-hidden="true" />
                            <span className="min-w-0 flex-1 truncate font-medium text-navy">{file.filename}</span>
                            <span className="shrink-0 text-muted-foreground">{formatBytes(file.size, locale)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* الرد أو سبب تعطيله */}
      <section className="rounded-2xl border border-border bg-white p-5 sm:p-6">
        {canReply ? (
          <form onSubmit={submitReply} noValidate className="space-y-3">
            <label htmlFor="track-reply" className="block text-sm font-bold text-navy">
              {t.replyTitle}
            </label>
            <Textarea
              id="track-reply"
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder={t.replyPlaceholder}
              rows={4}
              maxLength={5000}
              disabled={sending}
              aria-describedby="track-reply-count"
              className="min-h-28 resize-y leading-7"
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span id="track-reply-count" dir="ltr" className="font-mono text-xs text-muted-foreground">
                {reply.length} / 5000
              </span>
              <Button
                type="submit"
                disabled={sending || reply.trim().length === 0}
                className="h-11 rounded-full bg-primary px-8 font-bold text-primary-foreground shadow-md shadow-brand/20 transition-all hover:bg-brand-strong"
              >
                {sending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Send className="size-4" aria-hidden="true" />
                )}
                {sending ? t.sending : t.send}
              </Button>
            </div>
          </form>
        ) : (
          <div
            role="status"
            className="flex items-start gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm leading-7 text-muted-foreground"
          >
            <Info className="mt-1 size-4 shrink-0" aria-hidden="true" />
            <p>{replyDenial}</p>
          </div>
        )}
      </section>

      <p className="text-center text-xs text-muted-foreground">{siteName}</p>
    </div>
  );
}
