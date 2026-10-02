import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Bell, FilePlus2, FolderOpen, Layers, MessageCircle } from "lucide-react";
import { getAuthUser } from "@/lib/auth/session";
import { getPortalContent } from "@/content/portal";
import { db } from "@/lib/db";
import { locales, type Locale } from "@/lib/i18n";
import { StatusBadge } from "@/components/account/status-badge";
import { formatRelative } from "@/components/account/format";
import { Button } from "@/components/ui/button";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!locales.includes(locale as Locale)) return {};
  return { title: getPortalContent(locale as Locale).account.dashboard.title };
}

const OPEN_STATUSES = ["new", "in_review", "awaiting_info", "in_progress", "responded"];

/** لوحة حساب العميل — مؤشرات وآخر التحديثات من قاعدة البيانات مباشرة */
export default async function AccountDashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!locales.includes(raw as Locale)) notFound();
  const locale = raw as Locale;
  const t = getPortalContent(locale).account.dashboard;
  const labels = getPortalContent(locale).account.requests;

  const user = await getAuthUser();
  if (!user) notFound();

  const scope = user.roleKey === "client" ? { clientId: user.id } : { assigneeId: user.id };
  const [requests, unreadNotifications] = await Promise.all([
    db.projectRequest.findMany({
      where: scope,
      orderBy: { lastActivityAt: "desc" },
      select: {
        id: true,
        refCode: true,
        serviceType: true,
        status: true,
        lastActivityAt: true,
        lastClientReplyAt: true,
        lastStaffReplyAt: true,
        archivedAt: true,
      },
    }),
    db.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);

  const openRequests = requests.filter(
    (r) => !r.archivedAt && OPEN_STATUSES.includes(r.status)
  ).length;
  const awaitingReply = requests.filter(
    (r) =>
      !r.archivedAt &&
      r.lastStaffReplyAt !== null &&
      (r.lastClientReplyAt === null || r.lastStaffReplyAt > r.lastClientReplyAt)
  ).length;
  const recent = requests.slice(0, 5);
  const isEmpty = requests.length === 0;

  const stats = [
    { label: t.openRequests, value: openRequests, icon: FolderOpen, tone: "bg-brand-soft text-brand-strong", bar: "bg-gradient-to-r from-brand to-skydrop" },
    { label: t.awaitingReply, value: awaitingReply, icon: MessageCircle, tone: "bg-amber-100 text-amber-800", bar: "bg-gradient-to-r from-amber-400 to-amber-300" },
    { label: t.unreadNotifications, value: unreadNotifications, icon: Bell, tone: "bg-violet-100 text-violet-800", bar: "bg-gradient-to-r from-violet-400 to-purple-400" },
    { label: t.totalRequests, value: requests.length, icon: Layers, tone: "bg-muted text-muted-foreground", bar: "bg-gradient-to-r from-navy/60 to-slate-400" },
  ];

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">{t.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t.welcome}، {user.name}
          </p>
        </div>
        <Button
          asChild
          className="h-12 rounded-full bg-primary px-6 text-base font-bold text-primary-foreground shadow-md shadow-brand/20 transition-all hover:bg-brand-strong"
        >
          <Link href={`/${locale}/account/requests/new`}>
            <FilePlus2 className="h-5 w-5" aria-hidden="true" />
            {t.createRequest}
          </Link>
        </Button>
      </header>

      <section aria-label={t.title} className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.label}
              className="relative overflow-hidden rounded-2xl border border-border bg-white p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-navy/10 sm:p-6"
            >
              <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-1 ${s.bar}`} />
              <span className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${s.tone}`}>
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <p className="mt-3 text-2xl font-bold text-navy tabular-nums">{s.value}</p>
              <p className="mt-1 text-xs font-medium text-muted-foreground sm:text-sm">{s.label}</p>
            </div>
          );
        })}
      </section>

      {isEmpty ? (
        <section className="rounded-2xl border border-border bg-white p-8 text-center sm:p-12">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft text-brand-strong">
            <FolderOpen className="h-7 w-7" aria-hidden="true" />
          </span>
          <h2 className="mt-4 text-lg font-bold text-navy">{t.emptyTitle}</h2>
          <p className="mx-auto mt-2 max-w-md leading-8 text-muted-foreground">{t.emptyBody}</p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              asChild
              className="h-12 rounded-full bg-primary px-6 font-bold text-primary-foreground shadow-md shadow-brand/20 transition-all hover:bg-brand-strong"
            >
              <Link href={`/${locale}/account/requests/new`}>{t.createRequest}</Link>
            </Button>
            <Button asChild variant="outline" className="h-12 rounded-full px-6 font-semibold">
              <Link href={`/${locale}/account/requests?claim=open`}>{labels.claimTitle}</Link>
            </Button>
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-border bg-white p-4 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-bold text-navy">{t.recentUpdates}</h2>
            <Link
              href={`/${locale}/account/requests`}
              className="text-sm font-semibold text-brand underline decoration-brand/40 underline-offset-4 hover:text-brand-strong"
            >
              {t.viewAll}
            </Link>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead>
                <tr className="border-b border-border text-start text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="px-3 py-3 text-start font-semibold">{labels.refCode}</th>
                  <th scope="col" className="px-3 py-3 text-start font-semibold">{labels.service}</th>
                  <th scope="col" className="px-3 py-3 text-start font-semibold">{labels.status}</th>
                  <th scope="col" className="px-3 py-3 text-start font-semibold">{labels.lastActivity}</th>
                  <th scope="col" className="px-3 py-3 text-end font-semibold">{labels.viewDetails}</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r) => (
                  <tr key={r.id} className="border-b border-border/60 transition-colors last:border-0 hover:bg-muted/50">
                    <td className="px-3 py-3.5 font-mono font-semibold text-navy">{r.refCode}</td>
                    <td className="px-3 py-3.5 text-muted-foreground">{labels.services[r.serviceType] ?? r.serviceType}</td>
                    <td className="px-3 py-3.5">
                      <StatusBadge status={r.status} label={labels.statuses[r.status] ?? r.status} />
                    </td>
                    <td className="px-3 py-3.5 text-muted-foreground">{formatRelative(r.lastActivityAt, locale)}</td>
                    <td className="px-3 py-3.5 text-end">
                      <Link
                        href={`/${locale}/account/requests/${r.id}`}
                        className="font-semibold text-brand underline decoration-brand/40 underline-offset-4 hover:text-brand-strong"
                      >
                        {labels.viewDetails}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
