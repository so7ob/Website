"use client";

/**
 * قائمة الطلبات: بحث وتصفية (حالة/أولوية/خدمة/مسؤول/مؤرشف) + تحديد جماعي
 * للأرشفة + إجراءات سريعة (تعيين لي/تعيين لغيري/أرشفة/استعادة).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Search,
  MoreHorizontal,
  Eye,
  UserPlus,
  Archive,
  ArchiveRestore,
  MessageSquare,
  FileText,
  Inbox,
  Loader2,
  RotateCcw,
  BookMarked,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { getPortalContent } from "@/content/portal";
import type { PortalContent } from "@/content/portal/types";
import { can } from "@/lib/auth/permissions";
import type { Locale } from "@/lib/i18n";
import { StatusBadge, PriorityBadge } from "@/components/admin/badges";
import { AdminPagination } from "@/components/admin/pagination";
import { EmptyState } from "@/components/admin/empty-state";
import { useDebounced } from "@/components/admin/use-debounced";
import {
  apiGet,
  apiSend,
  ApiError,
  apiErrorMessage,
  buildQuery,
  fmtRelative,
} from "@/components/admin/helpers";
import type { Me, RequestRow, RequestsResponse, StaffOption } from "../types";
import { SavedRepliesDialog } from "./saved-replies-dialog";
import { cn } from "@/lib/utils";

interface RequestsClientProps {
  me: Me;
  locale: Locale;
}

/** شارة عمر الانتظار — منذ آخر رسالة عميل: محايدة تحت 24 ساعة، تحذير كهرماني بعدها */
function AgingBadge({ since, tr }: { since: string; tr: PortalContent["admin"]["requests"] }) {
  const ageMs = Date.now() - new Date(since).getTime();
  const hours = Math.max(0, Math.floor(ageMs / 3_600_000));
  const days = Math.max(0, Math.floor(ageMs / 86_400_000));
  if (days >= 1) {
    return (
      <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
        {tr.overdueReply} · {tr.agingDays.replace("{n}", String(days))}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
      {tr.awaitingTeam} · {tr.agingHours.replace("{n}", String(hours))}
    </span>
  );
}

export function RequestsClient({ me, locale }: RequestsClientProps) {
  const t = getPortalContent(locale);
  const tr = t.admin.requests;

  const [q, setQ] = useState("");
  const debouncedQ = useDebounced(q);
  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");
  const [service, setService] = useState("all");
  const [assignee, setAssignee] = useState("all");
  const [archived, setArchived] = useState(false);
  const [page, setPage] = useState(1);
  const [reloadToken, setReloadToken] = useState(0);

  const [data, setData] = useState<RequestsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);

  const mayAssign = can(me, "requests.assign");
  const mayArchive = can(me, "requests.archive");
  const mayExport = can(me, "requests.export");
  const maySavedReplies = can(me, "requests.reply");

  const [repliesOpen, setRepliesOpen] = useState(false);

  const load = useCallback(
    async (signal: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const query = buildQuery({
          q: debouncedQ,
          status: status !== "all" ? status : "",
          priority: priority !== "all" ? priority : "",
          service: service !== "all" ? service : "",
          assignee: assignee !== "all" ? assignee : "",
          archived,
          page,
        });
        const res = await apiGet<RequestsResponse>(`/api/admin/requests${query}`);
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
    [debouncedQ, status, priority, service, assignee, archived, page, t.auth.errors]
  );

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load, reloadToken]);

  const reload = () => setReloadToken((v) => v + 1);

  const staff: StaffOption[] = data?.staff ?? [];
  const requests: RequestRow[] = data?.requests ?? [];

  // ——— الإجراءات ———
  const patchRequest = async (id: string, body: Record<string, unknown>, successMsg?: string) => {
    setBusyId(id);
    try {
      await apiSend(`/api/admin/requests/${id}`, "PATCH", body);
      if (successMsg) toast.success(successMsg);
      reload();
    } catch (err) {
      toast.error(apiErrorMessage(err, t.auth.errors));
    } finally {
      setBusyId(null);
    }
  };

  const bulk = async (action: "archive" | "restore") => {
    if (selected.size === 0) return;
    try {
      await apiSend<{ ok: boolean; count: number }>("/api/admin/requests/bulk", "POST", {
        ids: Array.from(selected),
        action,
      });
      toast.success(action === "archive" ? tr.archived : tr.restore);
      reload();
    } catch (err) {
      toast.error(apiErrorMessage(err, t.auth.errors));
    }
  };

  const toggleAll = (checked: boolean) => {
    setSelected(checked ? new Set(requests.map((r) => r.id)) : new Set());
  };

  const toggleOne = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const allChecked = requests.length > 0 && requests.every((r) => selected.has(r.id));
  const someChecked = requests.some((r) => selected.has(r.id)) && !allChecked;

  const statusKeys = useMemo(() => Object.keys(tr.statuses), [tr.statuses]);
  const priorityKeys = useMemo(() => Object.keys(tr.priorities), [tr.priorities]);
  const serviceKeys = useMemo(() => Object.keys(tr.services), [tr.services]);

  // تصدير CSV بنفس تصفية العرض الحالية — رابط نسبي فيرسل الكوكيز تلقائيًا
  const exportCsv = () => {
    const query = buildQuery({
      q: debouncedQ,
      status: status !== "all" ? status : "",
      priority: priority !== "all" ? priority : "",
      service: service !== "all" ? service : "",
      assignee: assignee !== "all" ? assignee : "",
      archived,
    });
    window.open(`/api/admin/requests/export${query}`, "_blank");
    toast.success(tr.exportOk);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy">{tr.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{tr.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {maySavedReplies ? (
            <Button variant="outline" onClick={() => setRepliesOpen(true)} className="min-h-11 rounded-full">
              <BookMarked className="size-4" aria-hidden="true" />
              {t.admin.savedReplies.manage}
            </Button>
          ) : null}
          {mayExport ? (
            <Button variant="outline" onClick={exportCsv} className="min-h-11 rounded-full">
              <Download className="size-4" aria-hidden="true" />
              {tr.export}
            </Button>
          ) : null}
        </div>
      </div>
      <SavedRepliesDialog locale={locale} open={repliesOpen} onOpenChange={setRepliesOpen} />

      {/* أدوات التصفية */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1 sm:max-w-xs">
          <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder={tr.searchPlaceholder}
            aria-label={tr.searchPlaceholder}
            className="min-h-11 ps-9"
          />
        </div>
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
          <SelectTrigger aria-label={tr.filterStatus} className="min-h-11 w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tr.filterAll} — {tr.filterStatus}</SelectItem>
            {statusKeys.map((s) => (
              <SelectItem key={s} value={s}>{tr.statuses[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priority} onValueChange={(v) => { setPriority(v); setPage(1); }}>
          <SelectTrigger aria-label={tr.filterPriority} className="min-h-11 w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tr.filterAll} — {tr.filterPriority}</SelectItem>
            {priorityKeys.map((p) => (
              <SelectItem key={p} value={p}>{tr.priorities[p]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={service} onValueChange={(v) => { setService(v); setPage(1); }}>
          <SelectTrigger aria-label={tr.filterService} className="min-h-11 w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tr.filterAll} — {tr.filterService}</SelectItem>
            {serviceKeys.map((s) => (
              <SelectItem key={s} value={s}>{tr.services[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={assignee} onValueChange={(v) => { setAssignee(v); setPage(1); }}>
          <SelectTrigger aria-label={tr.filterAssignee} className="min-h-11 w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tr.filterAll} — {tr.filterAssignee}</SelectItem>
            <SelectItem value="none">{tr.unassigned}</SelectItem>
            {staff.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Switch id="archived-toggle" checked={archived} onCheckedChange={(v) => { setArchived(v); setPage(1); }} />
          <Label htmlFor="archived-toggle" className="cursor-pointer text-sm text-muted-foreground">
            {tr.archived}
          </Label>
        </div>
      </div>

      {/* شريط التحديد الجماعي */}
      {mayArchive && selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-accent/60 px-4 py-3">
          <p className="text-sm font-semibold text-brand-strong">
            {selected.size} {tr.selected}
          </p>
          <div className="ms-auto flex items-center gap-2">
            <Button
              variant={archived ? "outline" : "default"}
              onClick={() => bulk(archived ? "restore" : "archive")}
              className="min-h-10 rounded-full"
            >
              {archived ? <ArchiveRestore className="size-4" aria-hidden="true" /> : <Archive className="size-4" aria-hidden="true" />}
              {archived ? tr.restore : tr.bulkArchive}
            </Button>
            <Button variant="ghost" onClick={() => setSelected(new Set())} className="min-h-10 rounded-full">
              {t.admin.users.cancel}
            </Button>
          </div>
        </div>
      ) : null}

      {/* الجدول */}
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
                      aria-label={tr.bulkArchive}
                    />
                  </TableHead>
                ) : null}
                <TableHead className="min-w-24">{t.account.requests.refCode}</TableHead>
                <TableHead className="min-w-44">{tr.client}</TableHead>
                <TableHead className="min-w-24">{tr.filterService}</TableHead>
                <TableHead className="min-w-24">{tr.priority}</TableHead>
                <TableHead className="min-w-28">{tr.filterStatus}</TableHead>
                <TableHead className="min-w-36">{tr.filterAssignee}</TableHead>
                <TableHead className="w-16"><span className="sr-only">{tr.messages}</span></TableHead>
                <TableHead className="min-w-32">{tr.lastActivity}</TableHead>
                <TableHead className="w-14"><span className="sr-only">{tr.viewDetails}</span></TableHead>
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
              ) : requests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={mayArchive ? 10 : 9} className="p-0">
                    <EmptyState icon={Inbox} title={tr.empty} body={tr.emptyBody} />
                  </TableCell>
                </TableRow>
              ) : (
                requests.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={selected.has(row.id) ? "selected" : undefined}
                    className={cn("transition-colors hover:bg-muted/50", busyId === row.id && "opacity-60")}
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
                    <TableCell>
                      <Link
                        href={`/${locale}/admin/requests/${row.id}`}
                        className="inline-flex items-center gap-1.5 font-mono text-xs font-bold text-navy transition-colors hover:text-brand ltr-isolate"
                      >
                        {row.requestType === "quote" ? (
                          <FileText className="size-3.5 shrink-0 text-brand" aria-hidden="true" />
                        ) : (
                          <MessageSquare className="size-3.5 shrink-0 text-brand" aria-hidden="true" />
                        )}
                        {row.refCode}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <p className="truncate text-sm font-medium text-navy">{row.name}</p>
                      <p className="truncate text-xs text-muted-foreground ltr-isolate">{row.email}</p>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{tr.services[row.serviceType] ?? row.serviceType}</TableCell>
                    <TableCell><PriorityBadge priority={row.priority} label={tr.priorities[row.priority] ?? row.priority} /></TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <StatusBadge status={row.status} label={tr.statuses[row.status] ?? row.status} />
                        {row.awaitingSince ? <AgingBadge since={row.awaitingSince} tr={tr} /> : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.assigneeName ?? <span className="text-muted-foreground/60">{tr.unassigned}</span>}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1 text-sm tabular-nums text-muted-foreground">
                        <MessageSquare className="size-3.5" aria-hidden="true" />
                        {row.messageCount}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      <span
                        className={cn("me-1.5 inline-block size-2 rounded-full", row.needsStaffReply ? "bg-amber-500" : "bg-transparent")}
                        title={row.needsStaffReply ? t.admin.dashboard.unansweredRequests : undefined}
                      >
                        {row.needsStaffReply ? (
                          <span className="sr-only">{t.admin.dashboard.unansweredRequests}</span>
                        ) : null}
                      </span>
                      {fmtRelative(row.lastActivityAt, locale)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-10" aria-label={tr.viewDetails}>
                            <MoreHorizontal className="size-4" aria-hidden="true" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          <DropdownMenuItem asChild>
                            <Link href={`/${locale}/admin/requests/${row.id}`}>
                              <Eye className="size-4" aria-hidden="true" />
                              {tr.viewDetails}
                            </Link>
                          </DropdownMenuItem>
                          {mayAssign ? (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                disabled={row.assigneeId === me.id}
                                onClick={() => patchRequest(row.id, { assigneeId: me.id })}
                              >
                                <UserPlus className="size-4" aria-hidden="true" />
                                {tr.assignToMe}
                              </DropdownMenuItem>
                              <DropdownMenuSub>
                                <DropdownMenuSubTrigger>
                                  <UserPlus className="size-4" aria-hidden="true" />
                                  {tr.assignTo}
                                </DropdownMenuSubTrigger>
                                <DropdownMenuSubContent className="max-h-64 overflow-y-auto">
                                  <DropdownMenuItem onClick={() => patchRequest(row.id, { assigneeId: null })}>
                                    {tr.unassigned}
                                  </DropdownMenuItem>
                                  {staff.map((s) => (
                                    <DropdownMenuItem key={s.id} onClick={() => patchRequest(row.id, { assigneeId: s.id })}>
                                      {s.name}
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuSubContent>
                              </DropdownMenuSub>
                            </>
                          ) : null}
                          {mayArchive ? (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() =>
                                  patchRequest(row.id, { action: archived ? "restore" : "archive" }, archived ? tr.restore : tr.archived)
                                }
                              >
                                {archived ? (
                                  <ArchiveRestore className="size-4" aria-hidden="true" />
                                ) : (
                                  <Archive className="size-4" aria-hidden="true" />
                                )}
                                {archived ? tr.restore : tr.archive}
                              </DropdownMenuItem>
                            </>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
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
          <Button variant="outline" size="icon" onClick={reload} className="size-10 shrink-0" aria-label={tr.viewDetails}>
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
