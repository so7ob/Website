"use client";

/**
 * إشعارات الفريق: نفس بيانات بوابة العميل (واجهة /api/account/notifications
 * تعمل لأي مستخدم موثق وتعيد إشعاراته الخاصة) مع خرائط روابط الطاقم —
 * روابط طلبات بوابة العميل تُعاد كتابتها إلى مسارات الإدارة، وبادئة اللغة
 * المخزنة في الرابط تُستبدل بلغة العرض الحالية.
 */
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  FilePlus2,
  FileText,
  Info,
  Loader2,
  MessageSquare,
  RotateCcw,
  User,
  UserCheck,
  MessageCircleQuestion,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getPortalContent } from "@/content/portal";
import type { Locale } from "@/lib/i18n";
import { ApiError, apiErrorMessage, apiGet, apiSend, fmtDateTime } from "@/components/admin/helpers";
import { cn } from "@/lib/utils";
import type { AdminNotification, Me, NotificationsResponse } from "../types";

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  new_request: FilePlus2,
  new_inquiry: MessageCircleQuestion,
  request_assigned: UserCheck,
  reply_received: MessageSquare,
  info_requested: Info,
  status_changed: Bell,
  content_published: FileText,
  account: User,
};

/**
 * روابط الإشعارات مخزنة بمسارات مطلقة ببادئة لغة ثابتة (مثل /ar/account/requests/..) —
 * للطاقم تُعاد كتابة مسار الطلب إلى مسار الإدارة، وبادئة اللغة إلى لغة العرض.
 */
function staffLink(link: string | null, locale: Locale, isStaff: boolean): string | null {
  if (!link) return null;
  let next = link;
  if (isStaff) {
    next = next.replace("/account/requests/", "/admin/requests/");
  }
  return next.replace(/^\/(?:ar|en)(?=\/)/, `/${locale}`);
}

/** إشعارات الفريق: تُقرأ بالنقر وتنتقل لرابطها، مع تعليم الكل وتحميل المزيد */
export function NotificationsClient({ me, locale }: { me: Me; locale: Locale }) {
  const router = useRouter();
  const t = getPortalContent(locale);
  const tn = t.admin.notifications;

  const [items, setItems] = useState<AdminNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  const isStaff = me.roleKey !== "client";

  const load = useCallback(
    async (targetPage: number, append: boolean) => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiGet<NotificationsResponse>(`/api/account/notifications?page=${targetPage}`);
        setItems((prev) => (append ? [...prev, ...(res.notifications ?? [])] : res.notifications ?? []));
        setUnread(res.unread ?? 0);
        setTotal(res.total ?? 0);
      } catch (err) {
        if (err instanceof ApiError) setError(apiErrorMessage(err, t.auth.errors));
      } finally {
        setLoading(false);
      }
    },
    [t.auth.errors]
  );

  useEffect(() => {
    void (async () => {
      await load(1, false);
    })();
  }, [load]);

  const reload = () => {
    setPage(1);
    void load(1, false);
  };

  const hasMore = items.length < total;

  async function markRead(notification: AdminNotification) {
    const target = staffLink(notification.link, locale, isStaff);
    if (!notification.readAt) {
      try {
        await apiSend("/api/account/notifications", "POST", { id: notification.id });
      } catch {
        toast.error(t.auth.errors.generic);
        return; // لا انتقال قبل نجاح التعليم
      }
      const now = new Date().toISOString();
      setItems((prev) => prev.map((n) => (n.id === notification.id ? { ...n, readAt: now } : n)));
      setUnread((u) => Math.max(0, u - 1));
    }
    if (target) router.push(target);
  }

  async function markAllRead() {
    if (markingAll) return;
    setMarkingAll(true);
    try {
      await apiSend("/api/account/notifications", "POST", { all: true });
      const now = new Date().toISOString();
      setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? now })));
      setUnread(0);
    } catch {
      toast.error(t.auth.errors.generic);
    } finally {
      setMarkingAll(false);
    }
  }

  const chevron =
    locale === "ar" ? (
      <ChevronLeft className="h-4 w-4" aria-hidden="true" />
    ) : (
      <ChevronRight className="h-4 w-4" aria-hidden="true" />
    );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy">{tn.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{tn.subtitle}</p>
        </div>
        {unread > 0 && (
          <Button
            variant="outline"
            onClick={() => void markAllRead()}
            disabled={markingAll}
            className="min-h-11 rounded-full px-5 font-semibold"
          >
            {markingAll ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <CheckCheck className="size-4" aria-hidden="true" />
            )}
            {tn.markAllRead}
          </Button>
        )}
      </div>

      {error ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="icon" onClick={reload} className="size-10 shrink-0" aria-label={tn.title}>
            <RotateCcw className="size-4" aria-hidden="true" />
          </Button>
        </div>
      ) : null}

      <section className="rounded-2xl border border-border bg-white p-4 sm:p-6" aria-busy={loading}>
        {loading && items.length === 0 ? (
          <div className="space-y-3" aria-label={tn.title}>
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
        ) : !error && items.length === 0 ? (
          <div className="py-10 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Bell className="h-7 w-7" aria-hidden="true" />
            </span>
            <p className="mt-4 text-sm font-medium text-muted-foreground">{tn.empty}</p>
          </div>
        ) : (
          <ul className="max-h-[34rem] divide-y divide-border/60 overflow-y-auto">
            {items.map((notification) => {
              const unreadRow = !notification.readAt;
              const Icon = TYPE_ICONS[notification.type] ?? Bell;
              const typeLabel = tn.types[notification.type] ?? notification.type;
              const target = staffLink(notification.link, locale, isStaff);
              return (
                <li key={notification.id}>
                  <button
                    type="button"
                    onClick={() => void markRead(notification)}
                    aria-label={typeLabel}
                    className={cn(
                      "flex w-full items-start gap-4 p-4 text-start transition-colors hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand",
                      unreadRow && "bg-accent/30"
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                        unreadRow ? "bg-brand-soft text-brand-strong" : "bg-muted text-muted-foreground"
                      )}
                    >
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-navy">{typeLabel}</span>
                        {unreadRow && <span className="inline-flex h-2 w-2 rounded-full bg-red-600" aria-hidden="true" />}
                        {notification.payload.ref && (
                          <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-xs font-bold text-muted-foreground" dir="ltr">
                            {notification.payload.ref}
                          </span>
                        )}
                        {notification.payload.status && t.admin.requests.statuses[notification.payload.status] && (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                            {t.admin.requests.statuses[notification.payload.status]}
                          </span>
                        )}
                        {notification.payload.name && (
                          <span className="text-xs text-muted-foreground">{notification.payload.name}</span>
                        )}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {fmtDateTime(notification.createdAt, locale)}
                        {!notification.readAt && (
                          <span className="ms-2 font-semibold text-brand-strong">
                            {tn.markRead}
                            {target ? " ↗" : ""}
                          </span>
                        )}
                      </span>
                    </span>
                    {target && <span className="mt-2 shrink-0 text-muted-foreground">{chevron}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {hasMore && !loading && (
          <div className="mt-4 text-center">
            <Button
              variant="outline"
              className="min-h-11 rounded-full px-6 font-semibold tabular-nums"
              onClick={() => {
                const next = page + 1;
                setPage(next);
                void load(next, true);
              }}
            >
              {items.length} / {total}
            </Button>
          </div>
        )}
      </section>

      {loading && items.length > 0 ? (
        <div className="flex justify-center">
          <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden="true" />
        </div>
      ) : null}
    </div>
  );
}
