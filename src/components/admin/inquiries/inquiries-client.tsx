"use client";

/**
 * قائمة الاستفسارات: بحث + تصفية (حالة/تصنيف) + ترقيم صفحات.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Search, MessageSquareText, Eye, Loader2, RotateCcw, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { getPortalContent } from "@/content/portal";
import { can } from "@/lib/auth/permissions";
import type { Locale } from "@/lib/i18n";
import { StatusBadge } from "@/components/admin/badges";
import { AdminPagination } from "@/components/admin/pagination";
import { EmptyState } from "@/components/admin/empty-state";
import { useDebounced } from "@/components/admin/use-debounced";
import { apiGet, ApiError, apiErrorMessage, buildQuery, fmtRelative } from "@/components/admin/helpers";
import type { InquiriesResponse, Me } from "../types";

interface InquiriesClientProps {
  me: Me;
  locale: Locale;
}

export function InquiriesClient({ me, locale }: InquiriesClientProps) {
  const t = getPortalContent(locale);
  const ti = t.admin.inquiries;

  const [q, setQ] = useState("");
  const debouncedQ = useDebounced(q);
  const [status, setStatus] = useState("all");
  const [category, setCategory] = useState("all");
  const [page, setPage] = useState(1);
  const [reloadToken, setReloadToken] = useState(0);

  const [data, setData] = useState<InquiriesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (signal: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const query = buildQuery({
          q: debouncedQ,
          status: status !== "all" ? status : "",
          category: category !== "all" ? category : "",
          page,
        });
        const res = await apiGet<InquiriesResponse>(`/api/admin/inquiries${query}`);
        if (!signal.aborted) setData(res);
      } catch (err) {
        if (!signal.aborted && err instanceof ApiError) setError(apiErrorMessage(err, t.auth.errors));
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    },
    [debouncedQ, status, category, page, t.auth.errors]
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

  // تصدير CSV بنفس تصفية العرض الحالية — رابط نسبي فيرسل الكوكيز تلقائيًا
  const exportCsv = () => {
    const query = buildQuery({
      q: debouncedQ,
      status: status !== "all" ? status : "",
      category: category !== "all" ? category : "",
    });
    window.open(`/api/admin/inquiries/export${query}`, "_blank");
    toast.success(ti.exportOk);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy">{ti.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{ti.subtitle}</p>
        </div>
        {mayExport ? (
          <Button variant="outline" onClick={exportCsv} className="min-h-11 rounded-full">
            <Download className="size-4" aria-hidden="true" />
            {ti.export}
          </Button>
        ) : null}
      </div>

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
            className="min-h-11 ps-9"
          />
        </div>
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
          <SelectTrigger aria-label={t.admin.requests.filterStatus} className="min-h-11 w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.admin.requests.filterAll} — {t.admin.requests.filterStatus}</SelectItem>
            {statusKeys.map((s) => (
              <SelectItem key={s} value={s}>{ti.statuses[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={(v) => { setCategory(v); setPage(1); }}>
          <SelectTrigger aria-label={ti.category} className="min-h-11 w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.admin.requests.filterAll} — {ti.category}</SelectItem>
            {categoryKeys.map((c) => (
              <SelectItem key={c} value={c}>{ti.categories[c]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-white">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
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
                    {Array.from({ length: 9 }).map((__, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : inquiries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="p-0">
                    <EmptyState icon={MessageSquareText} title={ti.empty} />
                  </TableCell>
                </TableRow>
              ) : (
                inquiries.map((row) => (
                  <TableRow key={row.id} className="transition-colors hover:bg-muted/40">
                    <TableCell className="font-mono text-sm font-bold text-navy ltr-isolate">{row.refCode}</TableCell>
                    <TableCell>
                      <Link
                        href={`/${locale}/admin/inquiries/${row.id}`}
                        className="block max-w-64 truncate text-sm font-medium text-navy transition-colors hover:text-brand"
                      >
                        {row.subject}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-brand-strong">
                        {ti.categories[row.category] ?? row.category}
                      </span>
                    </TableCell>
                    <TableCell><StatusBadge status={row.status} label={ti.statuses[row.status] ?? row.status} /></TableCell>
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
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{fmtRelative(row.lastActivityAt, locale)}</TableCell>
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
