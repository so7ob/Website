/**
 * لوحة الإدارة الرئيسية (خادم): استعلام مباشر من قاعدة البيانات — أسرع من
 * استدعاء واجهتنا الخاصة ويتجنب حلقة المصادقة. كل الأرقام حقيقية.
 */
import Link from "next/link";
import {
  Users,
  Clock,
  Inbox,
  Hourglass,
  MessageSquareText,
  FileText,
  ArrowUpRight,
  type LucideIcon,
} from "lucide-react";
import { db } from "@/lib/db";
import { REQUEST_STATUSES } from "@/lib/requests-service";
import { getPortalContent } from "@/content/portal";
import { locales, type Locale } from "@/lib/i18n";
import { fmtRelative, fmtDate, fmtDayLabel } from "@/components/admin/helpers";
import { StatusBadge, ActionBadge } from "@/components/admin/badges";
import { EmptyState } from "@/components/admin/empty-state";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface StatDef {
  icon: LucideIcon;
  value: number;
  label: string;
  hint?: string;
}

export default async function AdminDashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = (locales.includes(raw as Locale) ? raw : "ar") as Locale;
  const t = getPortalContent(locale).admin.dashboard;
  const requestLabels = getPortalContent(locale).admin.requests;

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const openStatuses = ["new", "in_review", "awaiting_info", "in_progress", "responded"];

  const [
    totalUsers,
    activeUsers,
    pendingUsers,
    openRequests,
    newRequests,
    awaitingInfo,
    openInquiries,
    publishedPages,
    draftPages,
    statusGroups,
    recentRequests,
    recentAudit,
    weekRows,
  ] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { status: "active" } }),
    db.user.count({ where: { status: "pending_verification" } }),
    db.projectRequest.count({ where: { status: { in: openStatuses }, archivedAt: null } }),
    db.projectRequest.count({ where: { status: "new", archivedAt: null } }),
    db.projectRequest.count({ where: { status: "awaiting_info", archivedAt: null } }),
    db.inquiry.count({ where: { status: { in: ["new", "in_review", "awaiting_info", "responded"] }, archivedAt: null } }),
    db.page.count({ where: { status: "published" } }),
    db.page.count({ where: { status: { in: ["draft", "in_review"] } } }),
    db.projectRequest.groupBy({ by: ["status"], where: { archivedAt: null }, _count: true }),
    db.projectRequest.findMany({
      where: { archivedAt: null },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, refCode: true, name: true, status: true, serviceType: true, createdAt: true, assignee: { select: { name: true } } },
    }),
    db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 10, include: { actor: { select: { name: true } } } }),
    db.projectRequest.findMany({ where: { createdAt: { gte: weekAgo } }, select: { createdAt: true } }),
  ]);

  // سلسلة آخر 7 أيام للرسم العمودي
  const last7days: { date: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - i);
    const next = new Date(day);
    next.setDate(day.getDate() + 1);
    last7days.push({
      date: day.toISOString().slice(0, 10),
      count: weekRows.filter((r) => r.createdAt >= day && r.createdAt < next).length,
    });
  }
  const weekTotal = last7days.reduce((sum, d) => sum + d.count, 0);
  const maxDay = Math.max(1, ...last7days.map((d) => d.count));

  const byStatus = REQUEST_STATUSES.map((status) => ({
    status,
    count: statusGroups.find((g) => g.status === status)?._count ?? 0,
  }));
  const maxStatus = Math.max(1, ...byStatus.map((s) => s.count));

  const stats: StatDef[] = [
    { icon: Users, value: totalUsers, label: t.totalUsers, hint: `${activeUsers} · ${t.activeUsers}` },
    { icon: Clock, value: pendingUsers, label: t.pendingUsers },
    { icon: Inbox, value: openRequests, label: t.openRequests, hint: `${weekTotal} · ${t.last7days}` },
    { icon: Hourglass, value: awaitingInfo, label: t.awaitingInfo },
    { icon: MessageSquareText, value: openInquiries, label: t.openInquiries },
    { icon: FileText, value: publishedPages, label: t.publishedPages, hint: `${draftPages} · ${t.draftPages}` },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">{t.title}</h1>
      </div>

      {/* بطاقات المؤشرات */}
      <section aria-label={t.title} className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-border bg-white p-4 transition-shadow hover:shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="flex size-9 items-center justify-center rounded-xl bg-accent text-brand-strong">
                <stat.icon className="size-4.5" aria-hidden="true" />
              </span>
              <p className="text-2xl font-bold tabular-nums text-navy">{stat.value}</p>
            </div>
            <p className="mt-2 text-xs font-medium text-muted-foreground">{stat.label}</p>
            {stat.hint ? <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground/70">{stat.hint}</p> : null}
          </div>
        ))}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* الطلبات حسب الحالة — أشرطة أفقية */}
        <section className="rounded-2xl border border-border bg-white p-5">
          <h2 className="text-sm font-semibold text-navy">{t.requestsByStatus}</h2>
          {byStatus.every((s) => s.count === 0) ? (
            <EmptyState icon={Inbox} title={t.noData} className="py-8" />
          ) : (
            <ul className="mt-4 space-y-3">
              {byStatus.map((row) => (
                <li key={row.status} className="flex items-center gap-3">
                  <p className="w-28 shrink-0 truncate text-xs text-muted-foreground">
                    {requestLabels.statuses[row.status] ?? row.status}
                  </p>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${Math.max(row.count > 0 ? 4 : 0, Math.round((row.count / maxStatus) * 100))}%` }}
                    />
                  </div>
                  <p className="w-8 shrink-0 text-end text-xs font-semibold tabular-nums text-navy">{row.count}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* آخر 7 أيام — أعمدة مصغرة */}
        <section className="rounded-2xl border border-border bg-white p-5">
          <h2 className="text-sm font-semibold text-navy">{t.last7days}</h2>
          {weekTotal === 0 ? (
            <EmptyState icon={Inbox} title={t.noData} className="py-8" />
          ) : (
            <div className="mt-4 flex h-28 items-end gap-2 sm:gap-3">
              {last7days.map((day) => (
                <div key={day.date} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                  <p className="text-[10px] font-semibold tabular-nums text-muted-foreground" title={fmtDate(day.date, locale)}>
                    {day.count > 0 ? day.count : ""}
                  </p>
                  <div
                    className={cn(
                      "w-full max-w-10 rounded-t-lg bg-brand/70 transition-colors hover:bg-brand",
                      day.count === 0 && "bg-muted"
                    )}
                    style={{ height: `${Math.max(4, Math.round((day.count / maxDay) * 64))}px` }}
                  />
                  <p className="text-[10px] text-muted-foreground">{fmtDayLabel(day.date, locale)}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* أحدث الطلبات */}
        <section className="rounded-2xl border border-border bg-white">
          <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-4">
            <h2 className="text-sm font-semibold text-navy">{t.recentRequests}</h2>
            <Link
              href={`/${locale}/admin/requests`}
              className="inline-flex min-h-9 items-center gap-1 rounded-full px-3 text-xs font-semibold text-brand transition-colors hover:bg-accent hover:text-brand-strong"
            >
              {t.viewAll}
              <ArrowUpRight className="size-3.5" aria-hidden="true" />
            </Link>
          </div>
          {recentRequests.length === 0 ? (
            <EmptyState icon={Inbox} title={t.noData} />
          ) : (
            <ul className="divide-y divide-border">
              {recentRequests.map((r) => (
                <li key={r.id} className="transition-colors hover:bg-muted/40">
                  <Link href={`/${locale}/admin/requests/${r.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-5 py-3">
                    <p className="font-mono text-sm font-bold text-navy ltr-isolate">{r.refCode}</p>
                    <p className="min-w-0 flex-1 truncate text-sm text-foreground">{r.name}</p>
                    <StatusBadge status={r.status} label={requestLabels.statuses[r.status] ?? r.status} />
                    <p className="w-full text-xs text-muted-foreground sm:w-auto">
                      {requestLabels.services[r.serviceType] ?? r.serviceType}
                      {" · "}
                      {r.assignee?.name ?? requestLabels.none}
                      {" · "}
                      {fmtDate(r.createdAt.toISOString(), locale)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* أحدث الأحداث (سجل التدقيق) */}
        <section className="rounded-2xl border border-border bg-white">
          <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-4">
            <h2 className="text-sm font-semibold text-navy">{t.recentActivity}</h2>
            <Link
              href={`/${locale}/admin/audit`}
              className="inline-flex min-h-9 items-center gap-1 rounded-full px-3 text-xs font-semibold text-brand transition-colors hover:bg-accent hover:text-brand-strong"
            >
              {t.viewAll}
              <ArrowUpRight className="size-3.5" aria-hidden="true" />
            </Link>
          </div>
          {recentAudit.length === 0 ? (
            <EmptyState icon={Inbox} title={t.noData} />
          ) : (
            <ul className="divide-y divide-border">
              {recentAudit.map((log) => (
                <li key={log.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3">
                  <ActionBadge action={log.action} />
                  <p className="min-w-0 flex-1 truncate text-sm text-foreground">
                    {log.actor?.name ?? log.actorEmail ?? "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">{fmtRelative(log.createdAt.toISOString(), locale)}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
