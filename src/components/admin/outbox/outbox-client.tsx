"use client";

/**
 * صندوق صادر البريد: سجل الرسائل المرسلة/المسجلة/الفاشلة مع نص الخطأ.
 * وضع التطوير يسجل بلا إرسال فعلي — يوضحه نص الحالة والفراغ.
 */
import { useCallback, useEffect, useState } from "react";
import { Send, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { getPortalContent } from "@/content/portal";
import type { Locale } from "@/lib/i18n";
import { OutboxStatusBadge } from "@/components/admin/badges";
import { AdminPagination } from "@/components/admin/pagination";
import { EmptyState } from "@/components/admin/empty-state";
import { apiGet, ApiError, apiErrorMessage, buildQuery, fmtDateTime } from "@/components/admin/helpers";
import type { Me, OutboxResponse } from "../types";

interface OutboxClientProps {
  me: Me;
  locale: Locale;
}

export function OutboxClient({ me, locale }: OutboxClientProps) {
  const t = getPortalContent(locale);
  const to = t.admin.outbox;

  const [page, setPage] = useState(1);
  const [reloadToken, setReloadToken] = useState(0);
  const [data, setData] = useState<OutboxResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (signal: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiGet<OutboxResponse>(`/api/admin/outbox${buildQuery({ page })}`);
        if (!signal.aborted) setData(res);
      } catch (err) {
        if (!signal.aborted && err instanceof ApiError) setError(apiErrorMessage(err, t.auth.errors));
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    },
    [page, t.auth.errors]
  );

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load, reloadToken]);

  const reload = () => setReloadToken((v) => v + 1);
  const emails = data?.emails ?? [];
  const statusLabel = (s: string) => (s === "sent" ? to.sent : s === "failed" ? to.failed : to.devLogged);

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-brand-strong">
          <Send className="size-5" aria-hidden="true" />
        </span>
        <div>
          <h1 className="text-2xl font-bold text-navy">{to.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{to.subtitle}</p>
        </div>
      </header>

      <div className="overflow-hidden rounded-2xl border border-border bg-white">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50 [&_th]:text-xs [&_th]:font-medium [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-muted-foreground">
                <TableHead className="min-w-40">{to.date}</TableHead>
                <TableHead className="min-w-52">{to.to}</TableHead>
                <TableHead className="min-w-64">{to.subject}</TableHead>
                <TableHead className="min-w-28">{to.status}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && !data ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <TableRow key={`sk-${i}`}>
                    {Array.from({ length: 4 }).map((__, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : emails.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="p-0">
                    <EmptyState icon={Send} title={to.empty} body={to.emptyBody} />
                  </TableCell>
                </TableRow>
              ) : (
                emails.map((email) => (
                  <TableRow key={email.id} className="align-top transition-colors hover:bg-muted/50">
                    <TableCell className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">{fmtDateTime(email.createdAt, locale)}</TableCell>
                    <TableCell className="max-w-56 truncate font-mono text-xs text-navy ltr-isolate">{email.to}</TableCell>
                    <TableCell>
                      <p className="max-w-96 truncate text-sm text-foreground">{email.subject}</p>
                      {email.error ? <p className="max-w-96 truncate text-xs text-destructive">{email.error}</p> : null}
                    </TableCell>
                    <TableCell><OutboxStatusBadge status={email.status} label={statusLabel(email.status)} /></TableCell>
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
          <Button variant="outline" size="icon" onClick={reload} className="size-10 shrink-0" aria-label={to.title}>
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
