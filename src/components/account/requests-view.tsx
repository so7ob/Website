"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Inbox, Link2, Loader2, MessageCircle, Plus, Search, SearchX, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/admin/empty-state";
import { toast } from "sonner";
import type { Locale } from "@/lib/i18n";
import type { PortalContent } from "@/content/portal/types";
import { apiFetch } from "./api";
import { DevLink } from "./dev-link";
import { formatRelative, formatDateOnly } from "./format";
import { StatusBadge } from "./status-badge";
import { useDebounced } from "./use-debounced";
import type { RequestListResponse } from "./types";

const STATUS_KEYS = ["new", "in_review", "awaiting_info", "in_progress", "responded", "closed", "cancelled"] as const;

/** قيمة وسمية لتبويب «بانتظار ردك» — عرضٌ حصري (awaiting=you) وليس حالة طلب */
const AWAITING_YOU = "awaiting_you";

/** لغة حبوب التبويب — مشتركة بين «الكل» وحالات الطلب (كحلي عند التفعيل) */
const TAB_PILL_CLASS =
  "min-h-9 rounded-full px-4 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring/40 data-[state=inactive]:hover:bg-muted data-[state=active]:bg-navy data-[state=active]:text-white data-[state=active]:shadow-none";

/** تبويب «بانتظار ردك» — تفعيل كهرماني بدل الكحلي ليُقرأ عرضًا خاصًّا لا حالة،
 *  بنفس لغة شارة الانتظار ومؤشر لوحة الحساب (amber-300 على amber-100) */
const AWAITING_TAB_PILL_CLASS =
  "min-h-9 rounded-full border border-transparent px-4 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring/40 data-[state=inactive]:hover:bg-muted data-[state=active]:border-amber-300 data-[state=active]:bg-amber-100 data-[state=active]:text-amber-900 data-[state=active]:shadow-none";

type ClaimBanner = { kind: "ok" | "invalid" | "login_required"; ref?: string };

/** شارة «بانتظار ردك» بجانب الحالة — محايدة تحت 24 ساعة، كهرمانية بعدها (بلغة شارات لوحة الإدارة) */
function AwaitingYouChip({
  since,
  label,
  plainLabel,
  hoursLabel,
  daysLabel,
}: {
  since: string | null;
  label: string;
  plainLabel: string;
  hoursLabel: string;
  daysLabel: string;
}) {
  if (since === null) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
        {plainLabel}
      </span>
    );
  }
  const ageMs = Date.now() - new Date(since).getTime();
  const days = Math.max(0, Math.floor(ageMs / 86_400_000));
  const hours = Math.max(0, Math.floor(ageMs / 3_600_000));
  if (days >= 1) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-100 px-2.5 py-0.5 text-[11px] font-medium tabular-nums text-amber-900">
        {label} · {daysLabel.replace("{n}", String(days))}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
      {label} · {hoursLabel.replace("{n}", String(hours))}
    </span>
  );
}

/** قائمة طلبات العميل: تصفية بالحالة + جدول + ربط طلب سابق + لوائح نتائج الربط */
export function RequestsView({
  locale,
  t,
  authErrors,
  awaitingLabel,
  allLabel,
}: {
  locale: Locale;
  t: PortalContent["account"]["requests"];
  authErrors: PortalContent["auth"]["errors"];
  awaitingLabel: string;
  allLabel: string;
}) {
  const params = useSearchParams();

  // الحالة المبدئية من الرابط — ?awaiting=you (بطاقة «بانتظار ردك» في لوحة الحساب)
  // تتقدم على ?status= تمامًا كالواجهة الخادمية؛ قيمة غير معروفة أو غياب المعاملين
  // يسقط إلى «الكل»
  const [status, setStatus] = useState<string>(() => {
    if (params.get("awaiting") === "you") return AWAITING_YOU;
    const value = params.get("status") ?? "";
    return (STATUS_KEYS as readonly string[]).includes(value) ? value : "all";
  });
  const [q, setQ] = useState("");
  const debouncedQ = useDebounced(q);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<RequestListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  // تسلسل الطلبات: تجاهل الاستجابات القديمة عند تغير البحث/التصفية بسرعة
  const seqRef = useRef(0);

  // حوار ربط طلب سابق — يُفتح آليًا من لوحة الحساب (?claim=open)
  const [claimOpen, setClaimOpen] = useState(() => params.get("claim") === "open");
  const [claimRef, setClaimRef] = useState("");
  const [claimSending, setClaimSending] = useState(false);
  const [claimResult, setClaimResult] = useState<{ sent: boolean; devVerifyUrl?: string } | null>(null);

  // لوائح ?claim=ok|invalid|login_required
  const banner = useMemo<ClaimBanner | null>(() => {
    const value = params.get("claim");
    if (value === "ok" || value === "invalid" || value === "login_required") {
      return { kind: value, ref: params.get("ref") ?? undefined };
    }
    return null;
  }, [params]);

  const load = useCallback(async (filterStatus: string, pageNumber: number, search: string) => {
    const seq = ++seqRef.current;
    setLoading(true);
    const query = new URLSearchParams({ page: String(pageNumber) });
    // تبويب «بانتظار ردك» عرضٌ حصري: يرسل awaiting=you بلا تصفية حالة
    if (filterStatus === AWAITING_YOU) query.set("awaiting", "you");
    else if (filterStatus !== "all") query.set("status", filterStatus);
    if (search) query.set("q", search);
    const result = await apiFetch<RequestListResponse>(`/api/account/requests?${query.toString()}`);
    if (seq !== seqRef.current) return; // استجابة متأخرة عن طلب أحدث
    if (result.data.ok) {
      setData(result.data);
      setFailed(false);
    } else {
      setFailed(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void (async () => {
      await load(status, page, debouncedQ);
    })();
  }, [status, page, debouncedQ, load]);

  function onStatusChange(value: string) {
    setStatus(value);
    setPage(1);
    setFailed(false);
  }

  function onSearchChange(value: string) {
    setQ(value);
    setPage(1);
  }

  async function submitClaim(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (claimSending) return;
    const refCode = claimRef.trim().toUpperCase();
    if (!refCode) {
      toast.error(t.claimBody);
      return;
    }
    setClaimSending(true);
    const result = await apiFetch<{ ok?: boolean; devVerifyUrl?: string }>("/api/account/requests/claim", {
      method: "POST",
      body: JSON.stringify({ refCode }),
    });
    setClaimSending(false);
    if (result.status === 429) {
      toast.error(authErrors.rateLimited);
      return;
    }
    if (result.status === 0) {
      toast.error(authErrors.generic);
      return;
    }
    setClaimResult({ sent: true, devVerifyUrl: result.data.devVerifyUrl });
  }

  function resetClaim() {
    setClaimOpen(false);
    setClaimRef("");
    setClaimResult(null);
  }

  const requests = data?.requests ?? [];
  const totalPages = data ? Math.max(1, Math.ceil(data.total / Math.max(1, data.pageSize))) : 1;
  const detailHref = (id: string) => `/${locale}/account/requests/${id}`;
  // البحث يُفعّل من حرفين — يطابق شرط الواجهة الخادمية
  const searchActive = debouncedQ.trim().length >= 2;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-brand-strong">
            <Inbox className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-navy">{t.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t.subtitle}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            className="h-11 rounded-full px-5 font-semibold focus-visible:ring-2 focus-visible:ring-ring/40"
            onClick={() => {
              resetClaim();
              setClaimOpen(true);
            }}
          >
            <Link2 className="h-4 w-4" aria-hidden="true" />
            {t.claimTitle}
          </Button>
          <Button
            asChild
            className="h-11 rounded-full bg-primary px-6 font-bold text-primary-foreground shadow-md shadow-brand/20 transition-all hover:bg-brand-strong focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <Link href={`/${locale}/account/requests/new`}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t.create}
            </Link>
          </Button>
        </div>
      </header>

      {banner && (
        <div
          role="status"
          className={`flex flex-wrap items-center gap-3 rounded-2xl border p-4 text-sm font-medium ${
            banner.kind === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : banner.kind === "invalid"
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : "border-amber-200 bg-amber-50 text-amber-900"
          }`}
        >
          {banner.kind === "ok" ? t.claimVerifyOk : banner.kind === "invalid" ? authErrors.invalid : authErrors.generic}
          {banner.ref && (
            <span className="rounded-full bg-white/70 px-2.5 py-0.5 font-mono text-xs font-bold" dir="ltr">
              {banner.ref}
            </span>
          )}
        </div>
      )}

      <Tabs value={status} onValueChange={onStatusChange}>
        <div className="overflow-x-auto pb-1">
          <TabsList className="h-auto w-max flex-wrap gap-1 rounded-full bg-muted/60 p-1">
            <TabsTrigger value="all" className={TAB_PILL_CLASS}>
              {allLabel}
            </TabsTrigger>
            {STATUS_KEYS.map((key) => (
              <Fragment key={key}>
                <TabsTrigger value={key} className={TAB_PILL_CLASS}>
                  {t.statuses[key] ?? key}
                </TabsTrigger>
                {/* «بانتظار ردك» — عرضٌ حصري بعد «تم الرد» وقبل الحالات الختامية */}
                {key === "responded" && (
                  <TabsTrigger value={AWAITING_YOU} className={AWAITING_TAB_PILL_CLASS}>
                    {t.awaitingYou}
                  </TabsTrigger>
                )}
              </Fragment>
            ))}
          </TabsList>
        </div>
      </Tabs>

      {/* حقل البحث — مؤجل ٣٠٠ مللي ويمسح بزر مستقل */}
      <div className="flex justify-start">
        <div className="relative w-full max-w-xs">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            value={q}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t.searchPlaceholder}
            aria-label={t.search}
            maxLength={100}
            className="min-h-11 ps-9 pe-9 focus-visible:ring-2 focus-visible:ring-ring/40"
          />
          {q ? (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              aria-label={t.clearSearch}
              className="absolute end-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>

      <section className="rounded-2xl border border-border bg-white p-4 sm:p-6">
        {loading ? (
          <div className="space-y-3" aria-busy="true" aria-label={t.title}>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="animate-shimmer h-5 w-24" />
                <Skeleton className="animate-shimmer h-5 w-20" />
                <Skeleton className="animate-shimmer h-5 w-24" />
                <Skeleton className="animate-shimmer ms-auto h-5 w-16" />
              </div>
            ))}
          </div>
        ) : failed ? (
          <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
            {authErrors.generic}
          </div>
        ) : requests.length === 0 ? (
          searchActive ? (
            <div>
              <EmptyState icon={SearchX} title={t.noResults} />
              <p className="mx-auto mt-3 max-w-md text-center font-mono text-sm text-muted-foreground" dir="ltr">
                {debouncedQ.trim()}
              </p>
            </div>
          ) : (
            <div>
              <EmptyState icon={Inbox} title={t.empty} body={t.emptyBody} />
              <div className="mt-6 flex justify-center">
                <Button
                  asChild
                  className="h-11 rounded-full bg-primary px-6 font-bold text-primary-foreground shadow-md shadow-brand/20 transition-all hover:bg-brand-strong focus-visible:ring-2 focus-visible:ring-ring/40"
                >
                  <Link href={`/${locale}/account/requests/new`}>{t.create}</Link>
                </Button>
              </div>
            </div>
          )
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[44rem] text-sm">
                <thead>
                  <tr className="border-b border-border text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <th scope="col" className="px-3 py-3 text-start font-semibold">{t.refCode}</th>
                    <th scope="col" className="px-3 py-3 text-start font-semibold">{t.service}</th>
                    <th scope="col" className="px-3 py-3 text-start font-semibold">{t.status}</th>
                    <th scope="col" className="px-3 py-3 text-start font-semibold">{t.created}</th>
                    <th scope="col" className="px-3 py-3 text-start font-semibold">{t.lastActivity}</th>
                    <th scope="col" className="px-3 py-3 text-end font-semibold">{t.viewDetails}</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((r) => (
                    <tr key={r.id} className="border-b border-border/60 transition-colors last:border-0 hover:bg-muted/50">
                      <td className="px-3 py-3.5 font-mono text-xs font-semibold text-navy ltr-isolate">
                        <Link
                          href={detailHref(r.id)}
                          className="underline decoration-transparent underline-offset-4 hover:decoration-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                        >
                          {r.refCode}
                        </Link>
                      </td>
                      <td className="px-3 py-3.5 text-muted-foreground">
                        <span>{t.services[r.serviceType] ?? r.serviceType}</span>
                        {r.messageCount > 0 && (
                          <span className="ms-2 inline-flex items-center gap-1 text-xs text-muted-foreground/80">
                            <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
                            <span className="tabular-nums">{r.messageCount}</span>
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge status={r.status} label={t.statuses[r.status] ?? r.status} />
                          {r.awaitingClientReply && (
                            <AwaitingYouChip
                              since={r.lastStaffReplyAt}
                              label={t.awaitingYou}
                              plainLabel={awaitingLabel}
                              hoursLabel={t.awaitingHours}
                              daysLabel={t.awaitingDays}
                            />
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3.5 whitespace-nowrap text-muted-foreground">{formatDateOnly(r.createdAt, locale)}</td>
                      <td className="px-3 py-3.5 text-xs whitespace-nowrap text-muted-foreground">{formatRelative(r.lastActivityAt, locale)}</td>
                      <td className="px-3 py-3.5 text-end">
                        <Link
                          href={detailHref(r.id)}
                          className="font-semibold text-brand underline decoration-brand/40 underline-offset-4 hover:text-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                        >
                          {t.viewDetails}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 rounded-full focus-visible:ring-2 focus-visible:ring-ring/40"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  aria-label="←"
                >
                  {locale === "ar" ? <ChevronRight className="h-4 w-4" aria-hidden="true" /> : <ChevronLeft className="h-4 w-4" aria-hidden="true" />}
                </Button>
                <span className="px-2 text-sm font-semibold tabular-nums text-muted-foreground" aria-live="polite">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 rounded-full focus-visible:ring-2 focus-visible:ring-ring/40"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  aria-label="→"
                >
                  {locale === "ar" ? <ChevronLeft className="h-4 w-4" aria-hidden="true" /> : <ChevronRight className="h-4 w-4" aria-hidden="true" />}
                </Button>
              </div>
            )}
          </>
        )}
      </section>

      {/* حوار ربط طلب سابق */}
      <Dialog open={claimOpen} onOpenChange={(open) => (open ? setClaimOpen(true) : resetClaim())}>
        <DialogContent className="max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-navy">{t.claimTitle}</DialogTitle>
            <DialogDescription className="leading-7 text-muted-foreground">{t.claimBody}</DialogDescription>
          </DialogHeader>

          {claimResult?.sent ? (
            <div className="space-y-4">
              <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
                {t.claimSent}
              </p>
              {claimResult.devVerifyUrl && <DevLink url={claimResult.devVerifyUrl} hint={t.claimVerifyTitle} />}
              <Button
                onClick={resetClaim}
                className="h-11 w-full rounded-full bg-primary font-bold text-primary-foreground hover:bg-brand-strong focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                {t.cancelEdit}
              </Button>
            </div>
          ) : (
            <form onSubmit={submitClaim} noValidate className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="claim-ref" className="text-sm font-semibold text-navy">
                  {t.refCode}
                </Label>
                <Input
                  id="claim-ref"
                  value={claimRef}
                  onChange={(e) => setClaimRef(e.target.value)}
                  dir="ltr"
                  className="min-h-11 font-mono uppercase text-start focus-visible:ring-2 focus-visible:ring-ring/40"
                  maxLength={30}
                  autoComplete="off"
                  required
                />
              </div>
              <Button
                type="submit"
                disabled={claimSending}
                className="h-11 w-full rounded-full bg-primary font-bold text-primary-foreground shadow-md shadow-brand/20 transition-all hover:bg-brand-strong focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                {claimSending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
                {t.claimButton}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
