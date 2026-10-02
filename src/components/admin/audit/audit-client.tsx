"use client";

/**
 * سجل التدقيق: بحث + تصفية بنوع السجل + تفاصيل JSON قابلة للتوسيع + ترقيم.
 */
import { Fragment, useCallback, useEffect, useState } from "react";
import { Search, ScrollText, ChevronDown, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { getPortalContent } from "@/content/portal";
import type { Locale } from "@/lib/i18n";
import { ActionBadge } from "@/components/admin/badges";
import { AdminPagination } from "@/components/admin/pagination";
import { EmptyState } from "@/components/admin/empty-state";
import { useDebounced } from "@/components/admin/use-debounced";
import { apiGet, ApiError, apiErrorMessage, buildQuery, fmtDateTime } from "@/components/admin/helpers";
import type { AuditResponse, Me } from "../types";
import { cn } from "@/lib/utils";

/** أنواع السجلات المعروفة في النظام — رموز تقنية تُعرض كما هي */
const ENTITY_TYPES = ["user", "user_invite", "request", "inquiry", "page", "media", "menu", "settings", "attachment"];

interface AuditClientProps {
  me: Me;
  locale: Locale;
}

export function AuditClient({ me, locale }: AuditClientProps) {
  const t = getPortalContent(locale);
  const ta = t.admin.audit;

  const [q, setQ] = useState("");
  const debouncedQ = useDebounced(q);
  const [entity, setEntity] = useState("all");
  const [page, setPage] = useState(1);
  const [reloadToken, setReloadToken] = useState(0);

  const [data, setData] = useState<AuditResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(
    async (signal: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const query = buildQuery({
          q: debouncedQ,
          entity: entity !== "all" ? entity : "",
          page,
        });
        const res = await apiGet<AuditResponse>(`/api/admin/audit${query}`);
        if (!signal.aborted) setData(res);
      } catch (err) {
        if (!signal.aborted && err instanceof ApiError) setError(apiErrorMessage(err, t.auth.errors));
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    },
    [debouncedQ, entity, page, t.auth.errors]
  );

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load, reloadToken]);

  const reload = () => setReloadToken((v) => v + 1);
  const logs = data?.logs ?? [];

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-brand-strong">
          <ScrollText className="size-5" aria-hidden="true" />
        </span>
        <div>
          <h1 className="text-2xl font-bold text-navy">{ta.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{ta.subtitle}</p>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1 sm:max-w-xs">
          <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder={ta.action}
            aria-label={t.admin.users.search}
            className="min-h-11 ps-9 focus-visible:ring-2 focus-visible:ring-ring/40"
          />
        </div>
        <Select value={entity} onValueChange={(v) => { setEntity(v); setPage(1); }}>
          <SelectTrigger aria-label={ta.entity} className="min-h-11 w-44 focus-visible:ring-2 focus-visible:ring-ring/40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.admin.requests.filterAll} — {ta.entity}</SelectItem>
            {ENTITY_TYPES.map((e) => (
              <SelectItem key={e} value={e} className="font-mono text-xs">{e}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-white">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50 [&_th]:text-xs [&_th]:font-medium [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-muted-foreground">
                <TableHead className="min-w-40">{ta.date}</TableHead>
                <TableHead className="min-w-40">{ta.actor}</TableHead>
                <TableHead className="min-w-40">{ta.action}</TableHead>
                <TableHead className="min-w-36">{ta.entity}</TableHead>
                <TableHead className="w-14"><span className="sr-only">{ta.details}</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && !data ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <TableRow key={`sk-${i}`}>
                    {Array.from({ length: 5 }).map((__, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="p-0">
                    <EmptyState icon={ScrollText} title={ta.empty} />
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <Fragment key={log.id}>
                  <TableRow className="align-top transition-colors hover:bg-muted/50">
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{fmtDateTime(log.createdAt, locale)}</TableCell>
                    <TableCell>
                      <p className="text-sm font-medium text-navy">{log.actor}</p>
                      {log.actorEmail ? (
                        <p className="text-xs text-muted-foreground ltr-isolate">{log.actorEmail}</p>
                      ) : null}
                    </TableCell>
                    <TableCell><ActionBadge action={log.action} /></TableCell>
                    <TableCell>
                      <p className="font-mono text-xs text-muted-foreground">{log.entityType}</p>
                      {log.entityId ? (
                        <p className="max-w-40 truncate font-mono text-[11px] text-muted-foreground/70 ltr-isolate" title={log.entityId}>
                          {log.entityId}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {log.details && Object.keys(log.details).length > 0 ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-10 text-muted-foreground transition-colors hover:text-foreground"
                          onClick={() => setExpanded((prev) => (prev === log.id ? null : log.id))}
                          aria-label={ta.details}
                          aria-expanded={expanded === log.id}
                        >
                          <ChevronDown
                            className={cn("size-4 transition-transform duration-200", expanded === log.id && "rotate-180")}
                            aria-hidden="true"
                          />
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                  {expanded === log.id ? (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={5} className="rounded-b-xl bg-muted/30 p-3">
                        <pre
                          className="max-h-64 overflow-auto rounded-xl border border-border/60 bg-muted/40 p-3 font-mono text-xs leading-relaxed text-foreground ltr-isolate [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent"
                          dir="ltr"
                        >
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      </TableCell>
                    </TableRow>
                  ) : null}
                  </Fragment>
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
        <Loader2 className={cn("size-4 animate-spin text-muted-foreground")} aria-hidden="true" />
      ) : null}
    </div>
  );
}
