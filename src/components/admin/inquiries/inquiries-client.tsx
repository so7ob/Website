"use client";

/**
 * قائمة الاستفسارات: بحث وتصفية (حالة/تصنيف/مؤرشف) + تحديد جماعي
 * للأرشفة + ترقيم صفحات.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Search, MessageCircleQuestion, MessageSquareText, Eye, Loader2, RotateCcw, Download, Archive, ArchiveRestore } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { getPortalContent } from "@/content/portal";
import type { PortalContent } from "@/content/portal/types";
import { can } from "@/lib/auth/permissions";
import type { Locale } from "@/lib/i18n";
import { StatusBadge } from "@/components/admin/badges";
import { AdminPagination } from "@/components/admin/pagination";
import { EmptyState } from "@/components/admin/empty-state";
import { useDebounced } from "@/components/admin/use-debounced";
import { apiGet, apiSend, ApiError, apiErrorMessage, buildQuery, fmtRelative } from "@/components/admin/helpers";
import type { InquiriesResponse, Me } from "../types";
import { cn } from "@/lib/utils";

interface InquiriesClientProps {
  me: Me;
  locale: Locale;
  /** حالة مبدئية من رابط الصفحة (مثل ?status=new من اللوحة) */
  initialStatus?: string;
}

/** شارة عمر الانتظار — منذ آخر رسالة عميل: محايدة تحت 24 ساعة، تحذير كهرماني
 *  بعدها (نسخة مطابقة لشارة قائمة الطلبات، مفاتيح الترجمة نفسها) */
function AgingBadge({ since, tr }: { since: string; tr: PortalContent["admin"]["requests"] }) {
  const ageMs = Date.now() - new Date(since).getTime();
  const hours = Math.max(0, Math.floor(ageMs / 3_600_000));
  const days = Math.max(0, Math.floor(ageMs / 86_400_000));
  if (days >= 1) {
    return (
      <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-xs font-medium tabular-nums text-amber-900">
        {tr.overdueReply} · {tr.agingDays.replace("{n}", String(days))}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
      {tr.awaitingTeam} · {tr.agingHours.replace("{n}", String(hours))}
    </span>
  );
}

/** لغة حبوب التصفية (حالة/تصنيف) — بنية حبة «متأخر الرد» في قائمة الطلبات
 *  مع تفعيل بحد brand وخلفية accent (لغة عناصر التنقل النشطة) */
const FILTER_PILL_CLASS =
  "inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40";

export function InquiriesClient({ me, locale, initialStatus }: InquiriesClientProps) {
  const t = getPortalContent(locale);
  const ti = t.admin.inquiries;

  const [q, setQ] = useState("");
  const debouncedQ = useDebounced(q);
  const [status, setStatus] = useState(initialStatus ?? "all");
  const [category, setCategory] = useState("all");
  const [archived, setArchived] = useState(false);
  const [page, setPage] = useState(1);
  const [reloadToken, setReloadToken] = useState(0);

  const [data, setData] = useState<InquiriesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const load = useCallback(
    async (signal: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const query = buildQuery({
          q: debouncedQ,
          status: status !== "all" ? status : "",
          category: category !== "all" ? category : "",
          archived,
          page,
        });
        const res = await apiGet<InquiriesResponse>(`/api/admin/inquiries${query}`);
        if (!signal.aborted) {
          setData(res);
          setSelected(new Set());
        }
      } catch (err) {
        if (!signal.aborted && err instanceof ApiError) setError(apiErrorMessage(err, t.auth.errors));
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    },
    [debouncedQ, status, category, archived, page, t.auth.errors]
  );

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load, reloadToken]);

  const reload = () => setReloadToken((v) => v + 1);
  const inquiries = data?.inquiries ?? [];
  const statusKeys = useMemo(() => Object.keys(ti.statuses), [ti.statuses]);
  const categoryKeys = useMemo(() => Object.keys(ti.categories), [ti.categories]);

  const mayExport = can(me, "inquiries.export");
  const mayArchive = can(me, "inquiries.archive");

  // ——— الأرشفة الجماعية ———
  const bulk = async (action: "archive" | "restore") => {
    if (selected.size === 0) return;
    try {
      await apiSend<{ ok: boolean; count: number }>("/api/admin/inquiries/bulk", "POST", {
        ids: Array.from(selected),
        action,
      });
      toast.success(action === "archive" ? ti.archived : ti.restore);
      reload();
    } catch (err) {
      toast.error(apiErrorMessage(err, t.auth.errors));
    }
  };

  const toggleAll = (checked: boolean) => {
    setSelected(checked ? new Set(inquiries.map((i) => i.id)) : new Set());
  };

  const toggleOne = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const allChecked = inquiries.length > 0 && inquiries.every((i) => selected.has(i.id));
  const someChecked = inquiries.some((i) => selected.has(i.id)) && !allChecked;

  // تصدير CSV بنفس تصفية العرض الحالية — رابط نسبي فيرسل الكوكيز تلقائيًا
  const exportCsv = () => {
    const query = buildQuery({
      q: debouncedQ,
      status: status !== "all" ? status : "",
      category: category !== "all" ? category : "",
      // تصدير ما يُرى: عرض المؤرشف يصدّر المؤرشف فقط — اتساقًا مع القائمة
      archived,
    });
    window.open(`/api/admin/inquiries/export${query}`, "_blank");
    toast.success(ti.exportOk);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-brand-strong">
            <MessageCircleQuestion className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-navy">{ti.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{ti.subtitle}</p>
          </div>
        </div>
        {mayExport ? (
          <Button variant="outline" onClick={exportCsv} className="min-h-11 rounded-full">
            <Download className="size-4" aria-hidden="true" />
            {ti.export}
          </Button>
        ) : null}
      </div>

      {/* أدوات التصفية: بحث + حبوب حالة/تصنيف — نفس قيم القوائم المنسدلة السابقة */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1 sm:max-w-xs">
          <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder={t.admin.requests.searchPlaceholder}
            aria-label={t.admin.users.search}
            className="min-h-11 ps-9 focus-visible:ring-2 focus-visible:ring-ring/40"
          />
        </div>
      </div>

      {/* حبوب الحالة — «الكل» + المرشّح المركّب «مفتوحة» (رابط عميق ?status=open
          من اللوحة) + الحالات + حبة عرض «المؤرشف» (تحوّل زر التحديد الجماعي
          إلى استعادة وتخفي شارات الانتظار) */}
      <div role="group" aria-label={t.admin.requests.filterStatus} className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground" aria-hidden="true">
          {t.admin.requests.filterStatus}
        </span>
        {[
          { value: "all", label: t.admin.requests.filterAll },
          { value: "open", label: t.admin.dashboard.openInquiries },
          ...statusKeys.map((s) => ({ value: s, label: ti.statuses[s] })),
        ].map(({ value, label }) => (
          <button
            key={value}
            type="button"
            aria-pressed={status === value}
            onClick={() => {
              setStatus(value);
              setPage(1);
            }}
            className={cn(
              FILTER_PILL_CLASS,
              status === value
                ? "border-brand bg-accent text-brand-strong"
                : "border-border bg-white text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            )}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={archived}
          onClick={() => {
            setArchived((v) => !v);
            setPage(1);
          }}
          className={cn(
            FILTER_PILL_CLASS,
            archived
              ? "border-brand bg-accent text-brand-strong"
              : "border-border bg-white text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          )}
        >
          <Archive className="size-4" aria-hidden="true" />
          {ti.archived}
        </button>
      </div>

      {/* حبوب التصنيف */}
      <div role="group" aria-label={ti.category} className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground" aria-hidden="true">
          {ti.category}
        </span>
        {[{ value: "all", label: t.admin.requests.filterAll }, ...categoryKeys.map((c) => ({ value: c, label: ti.categories[c] }))].map(
          ({ value, label }) => (
            <button
              key={value}
              type="button"
              aria-pressed={category === value}
              onClick={() => {
                setCategory(value);
                setPage(1);
              }}
              className={cn(
                FILTER_PILL_CLASS,
                category === value
                  ? "border-brand bg-accent text-brand-strong"
                  : "border-border bg-white text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
            >
              {label}
            </button>
          )
        )}
      </div>

      {/* شريط التحديد الجماعي — زر أرشفة، أو استعادة في عرض «المؤرشف» */}
      {mayArchive && selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-accent/60 px-4 py-3">
          <p className="text-sm font-semibold text-brand-strong">
            {selected.size} {ti.selected}
          </p>
          <div className="ms-auto flex items-center gap-2">
            <Button
              variant={archived ? "outline" : "default"}
              onClick={() => bulk(archived ? "restore" : "archive")}
              className="min-h-10 rounded-full"
            >
              {archived ? <ArchiveRestore className="size-4" aria-hidden="true" /> : <Archive className="size-4" aria-hidden="true" />}
              {archived ? ti.restore : ti.bulkArchive}
            </Button>
            <Button variant="ghost" onClick={() => setSelected(new Set())} className="min-h-10 rounded-full">
              {t.admin.users.cancel}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-border bg-white">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50 [&_th]:text-xs [&_th]:font-medium [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-muted-foreground">
                {mayArchive ? (
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allChecked ? true : someChecked ? "indeterminate" : false}
                      onCheckedChange={(checked) => toggleAll(checked === true)}
                      aria-label={ti.bulkArchive}
                    />
                  </TableHead>
                ) : null}
                <TableHead className="min-w-24">{t.account.requests.refCode}</TableHead>
                <TableHead className="min-w-44">{ti.subject}</TableHead>
                <TableHead className="min-w-24">{ti.category}</TableHead>
                <TableHead className="min-w-28">{t.admin.requests.filterStatus}</TableHead>
                <TableHead className="min-w-44">{t.admin.requests.client}</TableHead>
                <TableHead className="min-w-32">{t.admin.requests.filterAssignee}</TableHead>
                <TableHead className="w-16"><span className="sr-only">{t.admin.requests.messages}</span></TableHead>
                <TableHead className="min-w-32">{t.admin.requests.lastActivity}</TableHead>
                <TableHead className="w-14"><span className="sr-only">{t.admin.requests.viewDetails}</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && !data ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={`sk-${i}`}>
                    {Array.from({ length: mayArchive ? 10 : 9 }).map((__, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : inquiries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={mayArchive ? 10 : 9} className="p-0">
                    <EmptyState icon={MessageSquareText} title={ti.empty} />
                  </TableCell>
                </TableRow>
              ) : (
                inquiries.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={selected.has(row.id) ? "selected" : undefined}
                    className="transition-colors hover:bg-muted/50"
                  >
                    {mayArchive ? (
                      <TableCell>
                        <Checkbox
                          checked={selected.has(row.id)}
                          onCheckedChange={(checked) => toggleOne(row.id, checked === true)}
                          aria-label={row.refCode}
                        />
                      </TableCell>
                    ) : null}
                    <TableCell className="font-mono text-xs font-bold text-navy ltr-isolate">{row.refCode}</TableCell>
                    <TableCell>
                      <Link
                        href={`/${locale}/admin/inquiries/${row.id}`}
                        className="block max-w-64 truncate rounded-sm text-sm font-medium text-navy transition-colors hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                      >
                        {row.subject}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-brand-strong">
                        {ti.categories[row.category] ?? row.category}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <StatusBadge status={row.status} label={ti.statuses[row.status] ?? row.status} />
                        {row.awaitingSince ? <AgingBadge since={row.awaitingSince} tr={t.admin.requests} /> : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="truncate text-sm font-medium text-navy">{row.name}</p>
                      <p className="truncate text-xs text-muted-foreground ltr-isolate">{row.email}</p>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.assigneeName ?? <span className="text-muted-foreground/60">{t.admin.requests.unassigned}</span>}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1 text-sm tabular-nums text-muted-foreground">
                        <MessageSquareText className="size-3.5" aria-hidden="true" />
                        {row.messageCount}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm tabular-nums text-muted-foreground">{fmtRelative(row.lastActivityAt, locale)}</TableCell>
                    <TableCell>
                      <Button asChild variant="ghost" size="icon" className="size-10" aria-label={t.admin.requests.viewDetails}>
                        <Link href={`/${locale}/admin/inquiries/${row.id}`}>
                          <Eye className="size-4" aria-hidden="true" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {error ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="icon" onClick={reload} className="size-10 shrink-0" aria-label={t.admin.users.search}>
            <RotateCcw className="size-4" aria-hidden="true" />
          </Button>
        </div>
      ) : null}

      {data ? (
        <AdminPagination page={page} total={data.total} pageSize={data.pageSize} locale={locale} onPage={setPage} />
      ) : null}

      {loading && data ? (
        <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden="true" />
      ) : null}
    </div>
  );
}
