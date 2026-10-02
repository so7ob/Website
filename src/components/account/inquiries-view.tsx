"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, MessageCircle, MessageCircleQuestion, Plus, Search, SearchX, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/admin/empty-state";
import type { Locale } from "@/lib/i18n";
import type { PortalContent } from "@/content/portal/types";
import { fetchInquiries } from "./api";
import { formatRelative } from "./format";
import { StatusBadge } from "./status-badge";
import { useDebounced } from "./use-debounced";
import { NewInquiryDialog } from "./new-inquiry-dialog";
import type { InquiryListResponse } from "./types";

const STATUS_KEYS = ["new", "in_review", "awaiting_info", "responded", "closed"] as const;

/** قيمة مركّبة لتبويب «استفسارات مفتوحة» — تصفية status=open الخادمية وليست حالة */
const OPEN_SHORTCUT = "open";

/** لغة حبوب التبويب — منسوخة من قائمة الطلبات (كحلي عند التفعيل) */
const TAB_PILL_CLASS =
  "min-h-9 rounded-full px-4 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring/40 data-[state=inactive]:hover:bg-muted data-[state=active]:bg-navy data-[state=active]:text-white data-[state=active]:shadow-none";

/** قائمة استفسارات العميل: تبويبات حالة (URL) + بحث مؤجل + جدول + حوار استفسار جديد */
export function InquiriesView({
  locale,
  t,
  authErrors,
  searchLabel,
  searchPlaceholder,
  clearSearchLabel,
}: {
  locale: Locale;
  t: PortalContent["account"]["inquiries"];
  authErrors: PortalContent["auth"]["errors"];
  searchLabel: string;
  searchPlaceholder: string;
  clearSearchLabel: string;
}) {
  const params = useSearchParams();

  // الحالة المبدئية من الرابط — ?status= من بطاقات لوحة الحساب؛
  // قيمة غير معروفة أو غياب المعامل يسقط إلى «الكل»
  const [status, setStatus] = useState<string>(() => {
    const value = params.get("status") ?? "";
    return value === OPEN_SHORTCUT || (STATUS_KEYS as readonly string[]).includes(value) ? value : "all";
  });
  const [q, setQ] = useState("");
  const debouncedQ = useDebounced(q);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<InquiryListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  // تسلسل الطلبات: تجاهل الاستجابات القديمة عند تغير البحث/التصفية بسرعة
  const seqRef = useRef(0);

  // حوار استفسار جديد
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async (filterStatus: string, pageNumber: number, search: string) => {
    const seq = ++seqRef.current;
    setLoading(true);
    const result = await fetchInquiries({
      status: filterStatus === "all" ? undefined : filterStatus,
      q: search || undefined,
      page: pageNumber,
    });
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

  const inquiries = data?.inquiries ?? [];
  const totalPages = data ? Math.max(1, Math.ceil(data.total / Math.max(1, data.pageSize))) : 1;
  const detailHref = (id: string) => `/${locale}/account/inquiries/${id}`;
  // البحث يُفعّل من حرفين — يطابق شرط الواجهة الخادمية
  const searchActive = debouncedQ.trim().length >= 2;
  // «لا نتائج» عند تصفية نشطة (بحث أو تبويب غير «الكل») — وإلا فحالة فراغ مع دعوة إنشاء
  const filterActive = searchActive || status !== "all";

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-brand-strong">
            <MessageCircleQuestion className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-navy">{t.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t.subtitle}</p>
          </div>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          className="h-11 rounded-full bg-primary px-6 font-bold text-primary-foreground shadow-md shadow-brand/20 transition-all hover:bg-brand-strong focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t.create}
        </Button>
      </header>

      <Tabs value={status} onValueChange={onStatusChange}>
        <div className="overflow-x-auto pb-1">
          <TabsList className="h-auto w-max flex-wrap gap-1 rounded-full bg-muted/60 p-1">
            <TabsTrigger value="all" className={TAB_PILL_CLASS}>
              {t.all}
            </TabsTrigger>
            <TabsTrigger value={OPEN_SHORTCUT} className={TAB_PILL_CLASS}>
              {t.openShortcut}
            </TabsTrigger>
            {STATUS_KEYS.map((key) => (
              <TabsTrigger key={key} value={key} className={TAB_PILL_CLASS}>
                {t.statuses[key] ?? key}
              </TabsTrigger>
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
            placeholder={searchPlaceholder}
            aria-label={searchLabel}
            maxLength={100}
            className="min-h-11 ps-9 pe-9 focus-visible:ring-2 focus-visible:ring-ring/40"
          />
          {q ? (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              aria-label={clearSearchLabel}
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
                <Skeleton className="animate-shimmer h-5 w-32" />
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
        ) : inquiries.length === 0 ? (
          filterActive ? (
            <div>
              <EmptyState icon={SearchX} title={t.noResults} />
              {searchActive && (
                <p className="mx-auto mt-3 max-w-md text-center font-mono text-sm text-muted-foreground" dir="ltr">
                  {debouncedQ.trim()}
                </p>
              )}
            </div>
          ) : (
            <div>
              <EmptyState icon={MessageCircleQuestion} title={t.empty} body={t.emptyBody} />
              <div className="mt-6 flex justify-center">
                <Button
                  onClick={() => setCreateOpen(true)}
                  className="h-11 rounded-full bg-primary px-6 font-bold text-primary-foreground shadow-md shadow-brand/20 transition-all hover:bg-brand-strong focus-visible:ring-2 focus-visible:ring-ring/40"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  {t.create}
                </Button>
              </div>
            </div>
          )
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[48rem] text-sm">
                <thead>
                  <tr className="border-b border-border text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <th scope="col" className="px-3 py-3 text-start font-semibold">{t.refCode}</th>
                    <th scope="col" className="px-3 py-3 text-start font-semibold">{t.subject}</th>
                    <th scope="col" className="px-3 py-3 text-start font-semibold">{t.category}</th>
                    <th scope="col" className="px-3 py-3 text-start font-semibold">{t.status}</th>
                    <th scope="col" className="px-3 py-3 text-start font-semibold">{t.messages}</th>
                    <th scope="col" className="px-3 py-3 text-start font-semibold">{t.lastActivity}</th>
                    <th scope="col" className="px-3 py-3 text-end font-semibold">{t.viewDetails}</th>
                  </tr>
                </thead>
                <tbody>
                  {inquiries.map((inquiry) => (
                    <tr key={inquiry.id} className="border-b border-border/60 transition-colors last:border-0 hover:bg-muted/50">
                      <td className="px-3 py-3.5 font-mono text-xs font-semibold text-navy ltr-isolate">
                        <Link
                          href={detailHref(inquiry.id)}
                          className="underline decoration-transparent underline-offset-4 hover:decoration-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                        >
                          {inquiry.refCode}
                        </Link>
                      </td>
                      <td className="max-w-[16rem] truncate px-3 py-3.5 font-medium text-navy">{inquiry.subject}</td>
                      <td className="px-3 py-3.5">
                        <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs text-brand-strong">
                          {t.categories[inquiry.category] ?? inquiry.category}
                        </span>
                      </td>
                      <td className="px-3 py-3.5">
                        <StatusBadge status={inquiry.status} label={t.statuses[inquiry.status] ?? inquiry.status} />
                      </td>
                      <td className="px-3 py-3.5 text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
                          <span className="tabular-nums">{inquiry.messageCount}</span>
                        </span>
                      </td>
                      <td className="px-3 py-3.5 text-xs whitespace-nowrap text-muted-foreground">
                        {formatRelative(inquiry.lastActivityAt, locale)}
                      </td>
                      <td className="px-3 py-3.5 text-end">
                        <Link
                          href={detailHref(inquiry.id)}
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
                  className="size-11 rounded-full focus-visible:ring-2 focus-visible:ring-ring/40"
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
                  className="size-11 rounded-full focus-visible:ring-2 focus-visible:ring-ring/40"
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

      <NewInquiryDialog locale={locale} t={t} authErrors={authErrors} open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
