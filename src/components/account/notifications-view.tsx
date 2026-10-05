"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Bell,
  BellOff,
  CalendarClock,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  FilePlus2,
  FileText,
  Info,
  Loader2,
  MessageSquare,
  MessageCircleQuestion,
  RefreshCw,
  Trash2,
  User,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/i18n";
import type { PortalContent } from "@/content/portal/types";
import { groupNotificationsByDate, type DateGroup } from "@/lib/notifications/grouping";
import { apiFetch } from "./api";
import { formatRelative } from "./format";
import type { AccountNotification, NotificationsResponse } from "./types";

const TYPE_META: Record<string, { icon: React.ComponentType<{ className?: string }>; chip: string }> = {
  new_request: { icon: FilePlus2, chip: "bg-skydrop/20 text-brand-strong" },
  new_inquiry: { icon: MessageCircleQuestion, chip: "bg-teal-100 text-teal-800" },
  request_assigned: { icon: UserCheck, chip: "bg-navy/10 text-navy" },
  reply_received: { icon: MessageSquare, chip: "bg-emerald-100 text-emerald-800" },
  info_requested: { icon: Info, chip: "bg-amber-100 text-amber-800" },
  status_changed: { icon: Bell, chip: "bg-violet-100 text-violet-800" },
  content_published: { icon: FileText, chip: "bg-emerald-100 text-emerald-800" },
  content_schedule: { icon: CalendarClock, chip: "bg-violet-100 text-violet-800" },
  account: { icon: User, chip: "bg-navy/10 text-navy" },
};

type Filter = "all" | "unread";

const SCROLLBAR =
  "[scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent";

/**
 * مركز إشعارات العميل 2.0 — تبويبات (الكل / غير المقروءة)، تعليم دون تنقل،
 * حذف فردي، تجميع زمني (اليوم/أمس/أقدم)، وحالات فراغ إرشادية.
 * النقر على الصف يقرأ وينتقل إلى رابطه إن وجد؛ أزرار الإجراءات الجانبية لا تنقل.
 */
export function NotificationsView({
  locale,
  t,
  authErrors,
  statuses,
  inquiriesHref,
}: {
  locale: Locale;
  t: PortalContent["account"]["notifications"];
  authErrors: PortalContent["auth"]["errors"];
  statuses: Record<string, string>;
  inquiriesHref: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState<AccountNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [allTotal, setAllTotal] = useState(0);
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  const load = useCallback(async (targetFilter: Filter, targetPage: number, append: boolean) => {
    setLoading(true);
    setFailed(false);
    const query = targetFilter === "unread" ? "?page=1&unread=1" : `?page=${targetPage}`;
    const result = await apiFetch<NotificationsResponse>(`/api/account/notifications${query}`);
    setLoading(false);
    if (result.data.ok) {
      setItems((prev) => (append ? [...prev, ...(result.data.notifications ?? [])] : result.data.notifications ?? []));
      setUnread(result.data.unread ?? 0);
      if (targetFilter === "all") setAllTotal(result.data.total ?? 0);
      else setAllTotal((prev) => (prev === 0 ? result.data.total ?? 0 : prev));
    } else {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await load(filter, 1, false);
    })();
  }, [load, filter]);

  const hasMore = items.length < (filter === "all" ? allTotal : unread);

  function switchFilter(next: Filter) {
    if (next === filter) return;
    setFilter(next);
    setPage(1);
  }

  function refresh() {
    setPage(1);
    void load(filter, 1, false);
  }

  /** تعليم مقروءًا دون أي تنقل — زر الإجراء الجانبي.
   *  ضمن فلتر «غير المقروءة» يختفي الصف فورًا (الخادم لم يعد يُرجعه) فيظهر فراغ القسم الإرشادي. */
  async function markReadOnly(notification: AccountNotification) {
    const result = await apiFetch("/api/account/notifications", {
      method: "POST",
      body: JSON.stringify({ id: notification.id }),
    });
    if (!result.data.ok && result.status !== 0) {
      toast.error(authErrors.generic);
      return;
    }
    const now = new Date().toISOString();
    if (filter === "unread") {
      setItems((prev) => prev.filter((n) => n.id !== notification.id));
    } else {
      setItems((prev) => prev.map((n) => (n.id === notification.id ? { ...n, readAt: now } : n)));
    }
    setUnread((u) => Math.max(0, u - 1));
  }

  /** النقر على الصف: قراءة + انتقال للرابط إن وجد */
  async function openNotification(notification: AccountNotification) {
    if (!notification.readAt) await markReadOnly(notification);
    if (notification.link) router.push(notification.link);
  }

  async function markAllRead() {
    if (markingAll || unread === 0) return;
    setMarkingAll(true);
    const result = await apiFetch("/api/account/notifications", {
      method: "POST",
      body: JSON.stringify({ all: true }),
    });
    setMarkingAll(false);
    if (result.data.ok) {
      const now = new Date().toISOString();
      setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? now })));
      setUnread(0);
    } else if (result.status !== 0) {
      toast.error(authErrors.generic);
    }
  }

  async function removeNotification(notification: AccountNotification) {
    const result = await apiFetch<{ ok: boolean }>(`/api/account/notifications?id=${encodeURIComponent(notification.id)}`, {
      method: "DELETE",
    });
    if (result.data.ok) {
      setItems((prev) => prev.filter((n) => n.id !== notification.id));
      setAllTotal((c) => Math.max(0, c - 1));
      if (!notification.readAt) setUnread((u) => Math.max(0, u - 1));
      toast.success(t.deletedToast);
    } else if (result.status !== 0) {
      toast.error(t.deleteError);
    }
  }

  const groups = groupNotificationsByDate(items);
  const summary = t.summaryUnreadOf.replace("{unread}", String(unread)).replace("{total}", String(filter === "all" ? allTotal : unread));
  const isEmptyFilterUnread = filter === "unread" && !loading && !failed && items.length === 0;

  const chevron =
    locale === "ar" ? (
      <ChevronLeft className="h-4 w-4" aria-hidden="true" />
    ) : (
      <ChevronRight className="h-4 w-4" aria-hidden="true" />
    );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy">{t.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground tabular-nums">{summary}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="size-11 rounded-full"
            onClick={refresh}
            disabled={loading}
            aria-label={t.refresh}
            title={t.refresh}
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} aria-hidden="true" />
          </Button>
          {unread > 0 && (
            <Button variant="outline" className="h-11 rounded-full px-5 font-semibold" onClick={markAllRead} disabled={markingAll}>
              {markingAll ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CheckCheck className="h-4 w-4" aria-hidden="true" />}
              {t.markAllRead}
            </Button>
          )}
        </div>
      </header>

      {/* التبويبات — نمط حبوب متسق مع بقية البوابة */}
      <div role="tablist" aria-label={t.title} className="flex items-center gap-2">
        {(
          [
            { key: "all" as Filter, label: t.filterAll, count: allTotal },
            { key: "unread" as Filter, label: t.filterUnread, count: unread },
          ]
        ).map((tab) => {
          const active = filter === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => switchFilter(tab.key)}
              className={cn(
                "inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                active ? "bg-brand text-white shadow-sm" : "bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground"
              )}
            >
              {tab.label}
              <span
                className={cn(
                  "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-bold tabular-nums",
                  active ? "bg-white/20 text-white" : "bg-background text-muted-foreground"
                )}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      <section className="rounded-2xl border border-border bg-white p-4 sm:p-6">
        {loading && items.length === 0 ? (
          <div className="space-y-3" aria-busy="true" aria-label={t.title}>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="animate-shimmer h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="animate-shimmer h-4 w-40" />
                  <Skeleton className="animate-shimmer h-3 w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : failed ? (
          <div role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
            {authErrors.generic}
          </div>
        ) : items.length === 0 && filter === "all" ? (
          /* الفراغ الكلي — إرشاد مع دعوة لفتح استفسار */
          <div className="py-12 text-center">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-accent text-brand">
              <Bell className="h-8 w-8" aria-hidden="true" />
            </span>
            <p className="mt-5 text-base font-bold text-navy">{t.empty}</p>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-7 text-muted-foreground">{t.emptyBody}</p>
            <Link
              href={inquiriesHref}
              className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-brand px-6 text-sm font-semibold text-white transition-colors hover:bg-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              <MessageCircleQuestion className="h-4 w-4" aria-hidden="true" />
              {t.emptyCta}
            </Link>
          </div>
        ) : isEmptyFilterUnread ? (
          /* فلتر غير المقروء فارغ — كل شيء مقروء */
          <div className="py-12 text-center">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <BellOff className="h-8 w-8" aria-hidden="true" />
            </span>
            <p className="mt-5 text-base font-bold text-navy">{t.allReadTitle}</p>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-7 text-muted-foreground">{t.allReadBody}</p>
          </div>
        ) : (
          <ul className={cn("max-h-[34rem] space-y-5 overflow-y-auto pe-1", SCROLLBAR)}>
            {groups.map((group) => (
              <GroupSection
                key={group.key}
                group={group}
                locale={locale}
                t={t}
                statuses={statuses}
                chevron={chevron}
                onOpen={openNotification}
                onMarkRead={markReadOnly}
                onDelete={removeNotification}
              />
            ))}
          </ul>
        )}

        {hasMore && !loading && (
          <div className="mt-4 text-center">
            <Button
              variant="outline"
              className="h-11 rounded-full px-6 font-semibold tabular-nums"
              onClick={() => {
                const next = page + 1;
                setPage(next);
                void load(filter, next, true);
              }}
            >
              {items.length} / {filter === "all" ? allTotal : unread}
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}

/** قسم زمني: ترويسة (اليوم/أمس/أقدم) بعدّاده ثم صفوفه */
function GroupSection({
  group,
  locale,
  t,
  statuses,
  chevron,
  onOpen,
  onMarkRead,
  onDelete,
}: {
  group: DateGroup<AccountNotification>;
  locale: Locale;
  t: PortalContent["account"]["notifications"];
  statuses: Record<string, string>;
  chevron: React.ReactNode;
  onOpen: (n: AccountNotification) => void | Promise<void>;
  onMarkRead: (n: AccountNotification) => void | Promise<void>;
  onDelete: (n: AccountNotification) => void | Promise<void>;
}) {
  const label = group.key === "today" ? t.today : group.key === "yesterday" ? t.yesterday : t.older;
  return (
    <li className="space-y-1">
      <div className="flex items-center gap-2 px-1 pb-1" aria-hidden="true">
        <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</span>
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-[11px] font-bold tabular-nums text-muted-foreground">
          {group.items.length}
        </span>
        <span className="h-px flex-1 bg-border/60" />
      </div>
      <ul className="divide-y divide-border/60">
        {group.items.map((notification) => (
          <NotificationRow
            key={notification.id}
            notification={notification}
            locale={locale}
            t={t}
            statuses={statuses}
            chevron={chevron}
            onOpen={onOpen}
            onMarkRead={onMarkRead}
            onDelete={onDelete}
          />
        ))}
      </ul>
      <span className="sr-only">{label}</span>
    </li>
  );
}

function NotificationRow({
  notification,
  locale,
  t,
  statuses,
  chevron,
  onOpen,
  onMarkRead,
  onDelete,
}: {
  notification: AccountNotification;
  locale: Locale;
  t: PortalContent["account"]["notifications"];
  statuses: Record<string, string>;
  chevron: React.ReactNode;
  onOpen: (n: AccountNotification) => void | Promise<void>;
  onMarkRead: (n: AccountNotification) => void | Promise<void>;
  onDelete: (n: AccountNotification) => void | Promise<void>;
}) {
  const unreadRow = !notification.readAt;
  const meta = TYPE_META[notification.type] ?? { icon: Bell, chip: "bg-muted text-muted-foreground" };
  const Icon = meta.icon;
  const typeLabel = t.types[notification.type] ?? notification.type;
  return (
    <li className={cn("group/row flex items-stretch gap-1 transition-opacity", unreadRow ? "opacity-100" : "opacity-80 hover:opacity-100")}>
      {/* الصف نفسه: قراءة + انتقال */}
      <button
        type="button"
        onClick={() => void onOpen(notification)}
        aria-label={typeLabel}
        className={cn(
          "flex min-w-0 flex-1 items-start gap-4 rounded-xl border-s-2 border-s-transparent p-4 text-start transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand",
          unreadRow && "border-s-brand bg-accent/40"
        )}
      >
        <span className={cn("mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl", meta.chip)}>
          <Icon className="h-4.5 w-4.5" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-navy">{typeLabel}</span>
            {unreadRow && <span className="inline-flex size-2 rounded-full bg-brand" aria-hidden="true" />}
            {notification.payload.ref && (
              <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-xs font-bold text-muted-foreground" dir="ltr">
                {notification.payload.ref}
              </span>
            )}
            {notification.payload.status && statuses[notification.payload.status] && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {statuses[notification.payload.status]}
              </span>
            )}
            {notification.payload.name && (
              <span className="text-xs text-muted-foreground">{notification.payload.name}</span>
            )}
          </span>
          <span className="mt-1 block text-xs text-muted-foreground">
            {formatRelative(notification.createdAt, locale)}
            {unreadRow && notification.link && <span className="ms-2 font-semibold text-brand-strong">↗</span>}
          </span>
        </span>
        {notification.link && <span className="mt-2 shrink-0 text-muted-foreground">{chevron}</span>}
      </button>

      {/* أزرار الإجراءات: لا تنقل — تعليم فقط / حذف */}
      <div className="flex flex-col items-center justify-center gap-1 pe-1 opacity-0 transition-opacity focus-within:opacity-100 hover:opacity-100 group-hover/row:opacity-100 max-sm:opacity-100">
        {unreadRow && (
          <button
            type="button"
            onClick={() => void onMarkRead(notification)}
            aria-label={t.markRead}
            title={t.markRead}
            className="flex size-8 items-center justify-center rounded-full text-emerald-600 transition-colors hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <Check className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
        <button
          type="button"
          onClick={() => void onDelete(notification)}
          aria-label={t.deleteNotification}
          title={t.deleteNotification}
          className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </li>
  );
}
