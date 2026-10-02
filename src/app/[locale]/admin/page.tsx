/**
 * لوحة الإدارة الرئيسية (خادم): استعلام مباشر من قاعدة البيانات — أسرع من
 * استدعاء واجهتنا الخاصة ويتجنب حلقة المصادقة. كل الأرقام حقيقية.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAuthUser, can } from "@/lib/auth/session";
import { dashboardAccess } from "@/lib/auth/resource-access";
import {
  Users,
  Clock,
  Inbox,
  Hourglass,
  MessageSquareText,
  FileText,
  Timer,
  ArrowUpRight,
  LayoutDashboard,
  ChartBar,
  CalendarDays,
  ScrollText,
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
  permitted: boolean;
  value: number;
  label: string;
  hint?: string;
  /** رابط عميق اختياري — البطاقة تصبح رابطًا إلى قائمة مفلترة */
  href?: string;
  /** تلوين بصري فقط: شريحة الأيقونة + شريط التمييز العلوي */
  chip: string;
  bar: string;
}

/** فئات بطاقات المؤشرات — البطاقة نفسها بلا تغيير بصري، والرابط يضيف حلقة تركيز فقط */
const STAT_CARD_CLASS =
  "relative overflow-hidden rounded-2xl border border-border bg-white p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-navy/10";

/** مدى الرسم البياني — القيم المسموحة لـ ?range= */
const RANGE_DAYS = [7, 30, 90] as const;
type RangeDays = (typeof RANGE_DAYS)[number];

/** عمود في الرسم العمودي — label بلا قيمة يعني خانة فارغة تحفظ المحاذاة */
interface ChartBar {
  key: string;
  count: number;
  label: string | null;
  /** نص التلميح الكامل (تاريخ اليوم أو مدى الأسبوع) */
  title: string;
}

/** تدرجات أشرطة الحالة — نفس عائلات ألوان شارات الحالة */
const STATUS_BAR: Record<string, string> = {
  new: "bg-gradient-to-r from-skydrop to-brand",
  in_review: "bg-gradient-to-r from-slate-400 to-slate-500",
  awaiting_info: "bg-gradient-to-r from-amber-300 to-amber-500",
  in_progress: "bg-gradient-to-r from-brand to-brand-strong",
  responded: "bg-gradient-to-r from-emerald-400 to-emerald-500",
  closed: "bg-gradient-to-r from-slate-300 to-slate-400",
  cancelled: "bg-gradient-to-r from-rose-300 to-rose-500",
};

export default async function AdminDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale: raw } = await params;
  const sp = await searchParams;
  const locale = (locales.includes(raw as Locale) ? raw : "ar") as Locale;
  const user = await getAuthUser();
  if (!user || user.status === "suspended" || !can(user, "admin.dashboard")) notFound();
  const access = dashboardAccess(user);
  const t = getPortalContent(locale).admin.dashboard;
  const requestLabels = getPortalContent(locale).admin.requests;

  // المدى الزمني للرسم: 7 (الافتراضي) | 30 | 90 — أي قيمة أخرى تسقط إلى 7
  const rangeParam = Array.isArray(sp.range) ? sp.range[0] : sp.range;
  const rangeDays: RangeDays = rangeParam === "30" ? 30 : rangeParam === "90" ? 90 : 7;
  const rangeLabel = rangeDays === 7 ? t.range7 : rangeDays === 30 ? t.range30 : t.range90;
  const rangeOptions: { days: RangeDays; label: string }[] = [
    { days: 7, label: t.range7 },
    { days: 30, label: t.range30 },
    { days: 90, label: t.range90 },
  ];

  const rangeStart = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000);
  const overdueCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
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
    rangeRows,
    overdueRows,
  ] = await Promise.all([
    (access.users ? db.user.count() : Promise.resolve(0)),
    (access.users ? db.user.count({ where: { status: "active" } }) : Promise.resolve(0)),
    (access.users ? db.user.count({ where: { status: "pending_verification" } }) : Promise.resolve(0)),
    (access.requests ? db.projectRequest.count({ where: { status: { in: openStatuses }, archivedAt: null } }) : Promise.resolve(0)),
    (access.requests ? db.projectRequest.count({ where: { status: "new", archivedAt: null } }) : Promise.resolve(0)),
    (access.requests ? db.projectRequest.count({ where: { status: "awaiting_info", archivedAt: null } }) : Promise.resolve(0)),
    (access.inquiries ? db.inquiry.count({ where: { status: { in: ["new", "in_review", "awaiting_info", "responded"] }, archivedAt: null } }) : Promise.resolve(0)),
    (access.pages ? db.page.count({ where: { status: "published" } }) : Promise.resolve(0)),
    (access.pages ? db.page.count({ where: { status: { in: ["draft", "in_review"] } } }) : Promise.resolve(0)),
    (access.requests ? db.projectRequest.groupBy({ by: ["status"], where: { archivedAt: null }, _count: true }) : Promise.resolve([])),
    (access.requests ? db.projectRequest.findMany({
      where: { archivedAt: null },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, refCode: true, name: true, status: true, serviceType: true, createdAt: true, assignee: { select: { name: true } } },
    }) : Promise.resolve([])),
    (access.audit ? db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 10, include: { actor: { select: { name: true } } } }) : Promise.resolve([])),
    (access.requests ? db.projectRequest.findMany({ where: { createdAt: { gte: rangeStart } }, select: { createdAt: true } }) : Promise.resolve([])),
    // مرشّح الردود المتأخرة: مفتوحة وغير مؤرشفة وآخر كلام فيها للعميل قبل 24 ساعة+
    // (المقارنة بين عمودين غير مدعومة في مرشِّح Prisma — نجلب المرشّحات ثم نطابق في الذاكرة)
    (access.requests ? db.projectRequest.findMany({
      where: {
        status: { in: openStatuses },
        archivedAt: null,
        OR: [
          { lastClientReplyAt: { not: null, lt: overdueCutoff } },
          { lastClientReplyAt: null, lastStaffReplyAt: null, createdAt: { lt: overdueCutoff } },
        ],
      },
      select: { lastClientReplyAt: true, lastStaffReplyAt: true },
    }) : Promise.resolve([])),
  ]);

  // ردود متأخرة: طلبات مفتوحة بانتظار رد الفريق أكثر من 24 ساعة
  // (رد عميل بلا رد فريق بعده، أو طلب بلا أي رد فريق إطلاقًا)
  const overdueReplies = overdueRows.filter((r) =>
    r.lastClientReplyAt === null
      ? r.lastStaffReplyAt === null
      : r.lastStaffReplyAt === null || r.lastClientReplyAt > r.lastStaffReplyAt
  ).length;

  // سلسلة المدى المختار للرسم العمودي: أيام (7/30) أو أسابيع (90)
  const chartBars: ChartBar[] = [];
  if (rangeDays === 90) {
    // 13 مجموعة أسبوعية تبدأ قبل 89 يومًا — آخرها يغطي الأيام الجارية
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let week = 0; week < 13; week++) {
      const start = new Date(today);
      start.setDate(today.getDate() - 89 + week * 7);
      const end = new Date(start);
      end.setDate(start.getDate() + 7);
      const lastDay = new Date(end);
      lastDay.setDate(end.getDate() - 1);
      const startIso = start.toISOString();
      chartBars.push({
        key: `w${week}-${startIso.slice(0, 10)}`,
        count: rangeRows.filter((r) => r.createdAt >= start && r.createdAt < end).length,
        label: fmtDate(startIso, locale, "d/M"),
        title: `${fmtDate(startIso, locale)} – ${fmtDate(lastDay.toISOString(), locale)}`,
      });
    }
  } else {
    for (let i = rangeDays - 1; i >= 0; i--) {
      const day = new Date();
      day.setHours(0, 0, 0, 0);
      day.setDate(day.getDate() - i);
      const next = new Date(day);
      next.setDate(day.getDate() + 1);
      const dayIso = day.toISOString();
      // في مدى 30 يومًا: رقم اليوم كل 5 أعمدة وفي العمود الأخير فقط
      const index = rangeDays - 1 - i;
      const dailyLabel =
        rangeDays === 7
          ? fmtDayLabel(dayIso.slice(0, 10), locale)
          : index % 5 === 0 || index === rangeDays - 1
            ? fmtDate(dayIso, locale, "d")
            : null;
      chartBars.push({
        key: dayIso.slice(0, 10),
        count: rangeRows.filter((r) => r.createdAt >= day && r.createdAt < next).length,
        label: dailyLabel,
        title: fmtDate(dayIso, locale),
      });
    }
  }
  const rangeTotal = chartBars.reduce((sum, bar) => sum + bar.count, 0);
  const maxBar = Math.max(1, ...chartBars.map((bar) => bar.count));

  const byStatus = REQUEST_STATUSES.map((status) => ({
    status,
    count: statusGroups.find((g) => g.status === status)?._count ?? 0,
  }));
  const maxStatus = Math.max(1, ...byStatus.map((s) => s.count));

  const stats: StatDef[] = [
    {
      icon: Users,
      permitted: access.users,
      value: totalUsers,
      label: t.totalUsers,
      hint: `${activeUsers} · ${t.activeUsers}`,
      href: `/${locale}/admin/users`,
      chip: "bg-accent text-brand-strong",
      bar: "bg-gradient-to-r from-brand to-skydrop",
    },
    {
      icon: Clock,
      permitted: access.users,
      value: pendingUsers,
      label: t.pendingUsers,
      href: `/${locale}/admin/users?status=pending_verification`,
      chip: "bg-purple-100 text-purple-800",
      bar: "bg-gradient-to-r from-purple-400 to-purple-500",
    },
    {
      icon: Inbox,
      permitted: access.requests,
      value: openRequests,
      label: t.openRequests,
      hint: `${rangeTotal} · ${rangeDays === 7 ? t.last7days : rangeLabel}`,
      href: `/${locale}/admin/requests`,
      chip: "bg-skydrop/20 text-brand-strong",
      bar: "bg-gradient-to-r from-navy to-skydrop",
    },
    {
      icon: Hourglass,
      permitted: access.requests,
      value: awaitingInfo,
      label: t.awaitingInfo,
      href: `/${locale}/admin/requests?status=awaiting_info`,
      chip: "bg-amber-100 text-amber-800",
      bar: "bg-gradient-to-r from-amber-400 to-amber-300",
    },
    {
      icon: Timer,
      permitted: access.requests,
      value: overdueReplies,
      label: t.overdueReplies,
      hint: t.overdueHint,
      href: `/${locale}/admin/requests?overdue=1`,
      chip: "bg-rose-100 text-rose-800",
      bar: "bg-gradient-to-r from-rose-300 to-rose-500",
    },
    {
      icon: MessageSquareText,
      permitted: access.inquiries,
      value: openInquiries,
      label: t.openInquiries,
      // «open» مرشّح مركّب في واجهة الاستفسارات: الحالات غير المغلقة وغير المؤرشفة —
      // يطابق هذا المؤشر تمامًا (أُضيف في تكامل الجولة 19)
      href: `/${locale}/admin/inquiries?status=open`,
      chip: "bg-emerald-100 text-emerald-800",
      bar: "bg-gradient-to-r from-emerald-400 to-emerald-300",
    },
    {
      icon: FileText,
      permitted: access.pages,
      value: publishedPages,
      label: t.publishedPages,
      hint: `${draftPages} · ${t.draftPages}`,
      chip: "bg-brand-soft text-brand-strong",
      bar: "bg-gradient-to-r from-brand-strong to-brand",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-brand-strong">
            <LayoutDashboard className="size-5" aria-hidden="true" />
          </span>
          <h1 className="text-2xl font-bold text-navy">{t.title}</h1>
        </div>
        {/* مبدّل المدى الزمني — تنقل خادمي يعيد رسم اللوحة والمخطط
            (حبوب بحدود بلغة مرشّحات القوائم — تُخفى عند الطباعة) */}
        {access.requests && <div role="group" aria-label={t.rangeLabel} className="flex flex-wrap items-center gap-2 print:hidden">
          {rangeOptions.map((option) => {
            const active = option.days === rangeDays;
            return (
              <Link
                key={option.days}
                href={`/${locale}/admin?range=${option.days}`}
                scroll={false}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-9 items-center rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                  active
                    ? "border-brand bg-accent text-brand-strong"
                    : "border-border bg-white text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                {option.label}
              </Link>
            );
          })}
        </div>}
      </div>

      {/* بطاقات المؤشرات — 7 بطاقات: صف 4+3 على الشاشات الواسعة؛
          ذات الرابط تفتح القائمة المفلترة المقابلة (روابط اللوحة العميقة) */}
      <section aria-label={t.title} className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {stats.filter(stat => stat.permitted).map((stat) => {
          const card = (
            <>
              <span aria-hidden="true" className={cn("absolute inset-x-0 top-0 h-1", stat.bar)} />
              <div className="flex items-center justify-between gap-2">
                <span className={cn("flex size-9 items-center justify-center rounded-xl", stat.chip)}>
                  <stat.icon className="size-4.5" aria-hidden="true" />
                </span>
                <p className="text-2xl font-bold tabular-nums text-navy">{stat.value}</p>
              </div>
              <p className="mt-2 text-xs font-medium text-muted-foreground">{stat.label}</p>
              {stat.hint ? <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground/70">{stat.hint}</p> : null}
            </>
          );
          return stat.href ? (
            <Link
              key={stat.label}
              href={stat.href}
              aria-label={`${stat.label}: ${stat.value}`}
              className={cn(STAT_CARD_CLASS, "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40")}
            >
              {card}
            </Link>
          ) : (
            <div key={stat.label} className={STAT_CARD_CLASS}>
              {card}
            </div>
          );
        })}
      </section>

      {access.requests && <div className="grid gap-4 print:block print:space-y-4 lg:grid-cols-2">
        {/* الطلبات حسب الحالة — أشرطة أفقية */}
        <section className="rounded-2xl border border-border bg-white p-5">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-brand-strong">
              <ChartBar className="size-4" aria-hidden="true" />
            </span>
            <h2 className="text-sm font-semibold text-navy">{t.requestsByStatus}</h2>
          </div>
          {byStatus.every((s) => s.count === 0) ? (
            <EmptyState icon={Inbox} title={t.noData} className="py-8" />
          ) : (
            <ul className="mt-4 space-y-1">
              {byStatus.map((row) => (
                <li key={row.status}>
                  <Link
                    href={`/${locale}/admin/requests?status=${row.status}`}
                    aria-label={`${requestLabels.statuses[row.status] ?? row.status}: ${row.count}`}
                    className="flex items-center gap-3 rounded-lg px-2.5 py-1.5 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                  >
                    <p className="w-28 shrink-0 truncate text-xs text-muted-foreground">
                      {requestLabels.statuses[row.status] ?? row.status}
                    </p>
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        title={`${requestLabels.statuses[row.status] ?? row.status}: ${row.count}`}
                        className={cn(
                          "animate-shimmer h-full rounded-full transition-all duration-300",
                          STATUS_BAR[row.status] ?? "bg-gradient-to-r from-brand to-brand-strong"
                        )}
                        style={{ width: `${Math.max(row.count > 0 ? 4 : 0, Math.round((row.count / maxStatus) * 100))}%` }}
                      />
                    </div>
                    <span className="inline-flex min-w-8 shrink-0 items-center justify-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold tabular-nums text-navy">
                      {row.count}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* المدى المختار — أعمدة مصغرة (أيام لـ 7/30، أسابيع لـ 90) — تُخفى عند الطباعة */}
        <section className="rounded-2xl border border-border bg-white p-5 print:hidden">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-brand-strong">
              <CalendarDays className="size-4" aria-hidden="true" />
            </span>
            <h2 className="text-sm font-semibold text-navy">{rangeLabel}</h2>
          </div>
          {rangeTotal === 0 ? (
            <EmptyState icon={Inbox} title={t.noData} className="py-8" />
          ) : (
            <div className={cn("mt-4 flex h-28 items-end", rangeDays === 30 ? "gap-1" : "gap-2 sm:gap-3")}>
              {chartBars.map((bar) => (
                <div key={bar.key} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                  <p className="text-[10px] font-semibold tabular-nums text-muted-foreground" title={bar.title}>
                    {bar.count > 0 ? bar.count : ""}
                  </p>
                  <div
                    title={bar.title}
                    className={cn(
                      "rounded-full transition-all duration-300 hover:brightness-125",
                      rangeDays === 30 ? "w-full" : "w-full max-w-10",
                      bar.count === 0 ? "bg-muted hover:brightness-100" : "bg-gradient-to-t from-brand to-skydrop"
                    )}
                    style={{ height: `${Math.max(4, Math.round((bar.count / maxBar) * 64))}px` }}
                  />
                  {bar.label !== null ? (
                    <p className="text-[10px] tabular-nums text-muted-foreground">{bar.label}</p>
                  ) : (
                    <p aria-hidden="true" className="text-[10px] text-muted-foreground">
                      &nbsp;
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>}

      <div className="grid gap-4 print:block print:space-y-4 lg:grid-cols-2">
        {/* أحدث الطلبات */}
        {access.requests && <section className="rounded-2xl border border-border bg-white">
          <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-4">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-brand-strong">
                <Inbox className="size-4" aria-hidden="true" />
              </span>
              <h2 className="text-sm font-semibold text-navy">{t.recentRequests}</h2>
            </div>
            <Link
              href={`/${locale}/admin/requests`}
              className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-full px-3 text-xs font-semibold text-brand transition-colors hover:bg-accent hover:text-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
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
                <li key={r.id} className="transition-colors hover:bg-muted/50">
                  <Link href={`/${locale}/admin/requests/${r.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-5 py-3">
                    <p className="font-mono text-sm font-bold text-navy ltr-isolate">{r.refCode}</p>
                    <p className="min-w-0 flex-1 truncate text-sm text-foreground">{r.name}</p>
                    <StatusBadge status={r.status} label={requestLabels.statuses[r.status] ?? r.status} />
                    <p className="w-full text-xs tabular-nums text-muted-foreground sm:w-auto">
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
        </section>}

        {/* أحدث الأحداث (سجل التدقيق) */}
        {access.audit && <section className="rounded-2xl border border-border bg-white">
          <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-4">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-brand-strong">
                <ScrollText className="size-4" aria-hidden="true" />
              </span>
              <h2 className="text-sm font-semibold text-navy">{t.recentActivity}</h2>
            </div>
            <Link
              href={`/${locale}/admin/audit`}
              className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-full px-3 text-xs font-semibold text-brand transition-colors hover:bg-accent hover:text-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
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
                <li key={log.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 transition-colors hover:bg-muted/50">
                  <ActionBadge action={log.action} />
                  <p className="min-w-0 flex-1 truncate text-sm text-foreground">
                    {log.actor?.name ?? log.actorEmail ?? "—"}
                  </p>
                  <p className="text-xs tabular-nums text-muted-foreground">{fmtRelative(log.createdAt.toISOString(), locale)}</p>
                </li>
              ))}
            </ul>
          )}
        </section>}
      </div>
    </div>
  );
}
