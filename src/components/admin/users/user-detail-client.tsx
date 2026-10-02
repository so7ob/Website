"use client";

/**
 * ملف المستخدم الموسّع (إدارة): بيانات الحساب + إحصاءات + آخر الطلبات (روابط مباشرة
 * لتفاصيلها) + آخر الأنشطة من التدقيق. القرارات الحساسة تبقى في الواجهات والخادم.
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  CircleX,
  Clock,
  FileClock,
  FileText,
  Globe,
  Inbox,
  Mail,
  MonitorSmartphone,
  Phone,
  RotateCcw,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getPortalContent } from "@/content/portal";
import type { Locale } from "@/lib/i18n";
import { ActionBadge, RoleBadge, StatusBadge, UserStatusBadge } from "@/components/admin/badges";
import { EmptyState } from "@/components/admin/empty-state";
import { apiGet, ApiError, apiErrorMessage, fmtDate, fmtDateTime, fmtRelative } from "@/components/admin/helpers";
import type { UserDetailResponse } from "../types";
import { cn } from "@/lib/utils";

interface UserDetailClientProps {
  locale: Locale;
  userId: string;
}

export function UserDetailClient({ locale, userId }: UserDetailClientProps) {
  const t = getPortalContent(locale);
  const tud = t.admin.users.detail;

  const [data, setData] = useState<UserDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const load = useCallback(
    async (signal: AbortSignal) => {
      setLoading(true);
      try {
        const res = await apiGet<UserDetailResponse>(`/api/admin/users/${userId}`);
        if (!signal.aborted) {
          setData(res);
          setNotFound(false);
          setError(null);
        }
      } catch (err) {
        if (signal.aborted) return;
        if (err instanceof ApiError && (err.code === "not_found" || err.status === 404)) setNotFound(true);
        else if (err instanceof ApiError) setError(apiErrorMessage(err, t.auth.errors));
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    },
    [userId, t.auth.errors]
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load, reloadToken]);

  const reload = () => setReloadToken((v) => v + 1);
  const BackIcon = locale === "ar" ? ArrowRight : ArrowLeft;

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm" className="min-h-11 rounded-full text-muted-foreground transition-colors hover:text-navy">
          <Link href={`/${locale}/admin/users`}>
            <BackIcon className="size-4" aria-hidden="true" />
            {tud.back}
          </Link>
        </Button>
        {error ? (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="icon" onClick={reload} className="size-10 shrink-0" aria-label={t.admin.users.search}>
              <RotateCcw className="size-4" aria-hidden="true" />
            </Button>
          </div>
        ) : (
          <EmptyState icon={UserRound} title={t.admin.dashboard.noData} className="py-20" />
        )}
      </div>
    );
  }

  const { user, stats, requests, sessions, auditLog } = data;
  const statusLabel = (s: string) =>
    s === "active" ? t.admin.users.statusActive : s === "pending_verification" ? t.admin.users.statusPending : t.admin.users.statusSuspended;

  return (
    <div className="space-y-5">
      {/* الترويسة */}
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="sm" className="min-h-11 rounded-full text-muted-foreground transition-colors hover:text-navy">
          <Link href={`/${locale}/admin/users`}>
            <BackIcon className="size-4" aria-hidden="true" />
            <span className="sr-only">{t.admin.users.title}</span>
            {tud.back}
          </Link>
        </Button>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold text-navy">{user.name}</h1>
          <p className="truncate text-sm text-muted-foreground ltr-isolate">{user.email}</p>
        </div>
        <div className="ms-auto flex flex-wrap items-center gap-2">
          <RoleBadge roleKey={user.roleKey} locale={locale} />
          <UserStatusBadge status={user.status} label={statusLabel(user.status)} />
        </div>
      </div>

      {/* بطاقات الإحصاءات */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={FileText}
          label={tud.totalRequests}
          value={String(stats.totalRequests)}
          chip="bg-emerald-100 text-emerald-800"
          bar="bg-gradient-to-r from-emerald-400 to-emerald-300"
        />
        <StatCard
          icon={FileClock}
          label={tud.openRequests}
          value={String(stats.openRequests)}
          chip="bg-amber-100 text-amber-800"
          bar="bg-gradient-to-r from-amber-400 to-amber-300"
        />
        <StatCard
          icon={MonitorSmartphone}
          label={tud.sessionsCount}
          value={String(sessions.activeCount)}
          chip="bg-skydrop/20 text-brand-strong"
          bar="bg-gradient-to-r from-navy to-skydrop"
        />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* طلبات المستخدم */}
        <section className="overflow-hidden rounded-2xl border border-border bg-white">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-navy">{tud.userRequests}</h2>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50 [&_th]:text-xs [&_th]:font-medium [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-muted-foreground">
                  <TableHead className="min-w-28">{t.account.requests.refCode}</TableHead>
                  <TableHead className="min-w-28">{t.admin.users.status}</TableHead>
                  <TableHead className="min-w-32">{t.account.requests.service}</TableHead>
                  <TableHead className="min-w-32">{t.account.requests.created}</TableHead>
                  <TableHead className="min-w-36">{t.admin.requests.filterAssignee}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="p-0">
                      <EmptyState icon={Inbox} title={tud.noRequests} />
                    </TableCell>
                  </TableRow>
                ) : (
                  requests.map((r) => (
                    <TableRow key={r.id} className="transition-colors hover:bg-muted/50">
                      <TableCell>
                        <Link
                          href={`/${locale}/admin/requests/${r.id}`}
                          className="font-mono text-sm font-bold text-navy transition-colors hover:text-brand ltr-isolate"
                        >
                          {r.refCode}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={r.status} label={t.admin.requests.statuses[r.status] ?? r.status} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {t.account.requests.services[r.serviceType] ?? r.serviceType}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{fmtDate(r.createdAt, locale)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {r.assigneeName ?? <span className="text-muted-foreground/60">{t.admin.requests.unassigned}</span>}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </section>

        <aside className="space-y-4">
          {/* بيانات الحساب */}
          <section className="rounded-2xl border border-border bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-navy">{tud.accountInfo}</h2>
            <dl className="space-y-3">
              <InfoRow icon={Mail} label={t.auth.email} value={user.email} dir="ltr" />
              {user.phone ? <InfoRow icon={Phone} label={t.account.profile.phone} value={user.phone} dir="ltr" /> : null}
              {user.company ? <InfoRow icon={Building2} label={t.account.profile.company} value={user.company} /> : null}
              <InfoRow icon={Globe} label={t.account.profile.language} value={user.locale} dir="ltr" />
              <div className="flex items-center justify-between gap-3">
                <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  {user.emailVerified ? (
                    <CheckCircle2 className="size-3.5 text-emerald-600" aria-hidden="true" />
                  ) : (
                    <CircleX className="size-3.5 text-muted-foreground" aria-hidden="true" />
                  )}
                  {t.admin.users.emailVerified}
                </dt>
                <dd className="border-s-2 border-border/60 ps-3 text-sm font-medium text-navy">
                  {user.emailVerified ? t.account.profile.verified : t.account.profile.notVerified}
                </dd>
              </div>
              <InfoRow icon={CalendarDays} label={t.admin.users.createdAt} value={fmtDate(user.createdAt, locale)} />
              <InfoRow
                icon={Clock}
                label={t.admin.users.lastLogin}
                value={user.lastLoginAt ? fmtDateTime(user.lastLoginAt, locale) : t.admin.users.never}
              />
              {user.lastSeen ? (
                <InfoRow icon={Clock} label={tud.lastSeen} value={fmtRelative(user.lastSeen, locale)} />
              ) : null}
              {user.status === "suspended" && user.suspendedAt ? (
                <InfoRow icon={Clock} label={tud.suspendedAt} value={fmtDate(user.suspendedAt, locale)} />
              ) : null}
            </dl>
          </section>

          {/* آخر الأنشطة */}
          <section className="rounded-2xl border border-border bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-navy">{tud.activityLog}</h2>
            {auditLog.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">{t.admin.audit.empty}</p>
            ) : (
              <ol className="space-y-1">
                {auditLog.map((entry, i) => (
                  <li
                    key={`${entry.createdAt}-${i}`}
                    className="flex items-center justify-between gap-2 rounded-xl px-2.5 py-1.5 transition-colors hover:bg-muted/50"
                  >
                    <ActionBadge action={entry.action} />
                    <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground ltr-isolate">
                      {entry.entityType}
                      {entry.entityId ? ` · ${entry.entityId}` : ""}
                    </span>
                    <time className="shrink-0 text-xs text-muted-foreground">{fmtRelative(entry.createdAt, locale)}</time>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

/** بطاقة إحصاء رقمية */
function StatCard({
  icon: Icon,
  label,
  value,
  chip,
  bar,
}: {
  icon: typeof FileText;
  label: string;
  value: string;
  chip: string;
  bar: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-white p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-navy/10">
      <span aria-hidden="true" className={cn("absolute inset-x-0 top-0 h-1 rounded-t-2xl", bar)} />
      <div className="flex items-center gap-4">
        <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", chip)}>
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold tabular-nums text-navy">{value}</p>
        </div>
      </div>
    </div>
  );
}

/** صف معلومة: أيقونة + تسمية + قيمة */
function InfoRow({ icon: Icon, label, value, dir }: { icon: typeof Mail; label: string; value: string; dir?: "ltr" }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" aria-hidden="true" />
        {label}
      </dt>
      <dd
        className={cn(
          "min-w-0 truncate border-s-2 border-border/60 ps-3 text-sm font-medium text-navy",
          dir === "ltr" && "ltr-isolate"
        )}
        dir={dir}
      >
        {value}
      </dd>
    </div>
  );
}
