"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  FolderOpen,
  Globe,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircleQuestion,
  Plus,
  ShieldCheck,
  User,
} from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/i18n";
import type { PortalContent } from "@/content/portal/types";

export interface AccountShellUser {
  name: string;
  email: string;
  roleKey: string;
  emailVerified: boolean;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: boolean;
}

function UnreadDot({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span
      className="ms-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-skydrop px-1.5 text-[11px] font-bold text-navy"
      aria-label={String(count)}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

function UserCard({ user }: { user: AccountShellUser }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-white p-4">
      <span
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand to-navy text-sm font-bold text-white"
        aria-hidden="true"
      >
        {user.name.trim().slice(0, 1).toUpperCase() || "·"}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-navy">{user.name}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground" dir="ltr">
          {user.email}
        </p>
        <span className="mt-1.5 inline-flex items-center rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {user.roleKey}
        </span>
      </div>
    </div>
  );
}

function NavList({
  items,
  pathname,
  unread,
  nav,
  locale,
  onNavigate,
}: {
  items: NavItem[];
  pathname: string;
  unread: number;
  nav: PortalContent["account"]["nav"];
  locale: Locale;
  onNavigate?: () => void;
}) {
  const isActive = (href: string) => (href === `/${locale}/account` ? pathname === href : pathname.startsWith(href));

  return (
    <nav aria-label={nav.dashboard} className="flex flex-col gap-1">
      {items.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
              active ? "bg-accent text-brand-strong" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {active ? (
              <span aria-hidden="true" className="absolute inset-y-2 start-0 w-1 rounded-full bg-brand" />
            ) : null}
            <Icon className="h-4.5 w-4.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{item.label}</span>
            {item.badge && <UnreadDot count={unread} />}
          </Link>
        );
      })}
      <div className="my-3 border-t border-border" />
      <Link
        href={`/${locale}`}
        onClick={onNavigate}
        className="flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        <Globe className="h-4.5 w-4.5 shrink-0" aria-hidden="true" />
        <span className="truncate">{nav.backSite}</span>
      </Link>
      <Link
        href={`/${locale}/auth/logout`}
        onClick={onNavigate}
        className="flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-rose-700 transition-colors hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        <LogOut className="h-4.5 w-4.5 shrink-0" aria-hidden="true" />
        <span className="truncate">{nav.logout}</span>
      </Link>
    </nav>
  );
}

/**
 * هيكل بوابة العميل: قائمة جانبية (جهة البداية) على الشاشات الكبيرة،
 * شريط علوي بدرج على الجوال، نقطة إشعارات غير مقروءة، ومسح المسودة المحلية.
 */
export function AccountShell({
  locale,
  nav,
  auth,
  user,
  children,
}: {
  locale: Locale;
  nav: PortalContent["account"]["nav"];
  auth: { pendingTitle: string; pendingBody: string };
  user: AccountShellUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? `/${locale}/account`;
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  // مسح المسودة المحلية — المستخدم المسجل يعمل بمسودات الخادم المرتبطة بحسابه
  useEffect(() => {
    try {
      localStorage.removeItem("so7ob-request-draft");
    } catch {
      /* التخزين غير متاح */
    }
  }, []);

  // نقطة الإشعارات: جلب فوري ثم كل 30 ثانية، وتحديث عند تغيير الصفحة
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await fetch("/api/account/notifications?unread=1");
        if (!res.ok) return;
        const data = (await res.json()) as { unread?: number };
        if (active && typeof data.unread === "number") setUnread(data.unread);
      } catch {
        /* بلا اتصال — بصمت */
      }
    };
    void load();
    const timer = setInterval(load, 30_000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [pathname]);

  const base = `/${locale}/account`;
  const items: NavItem[] = [
    { href: base, label: nav.dashboard, icon: LayoutDashboard },
    { href: `${base}/requests`, label: nav.requests, icon: FolderOpen },
    { href: `${base}/requests/new`, label: nav.newRequest, icon: Plus },
    { href: `${base}/inquiries`, label: nav.inquiries, icon: MessageCircleQuestion },
    { href: `${base}/notifications`, label: nav.notifications, icon: Bell, badge: true },
    { href: `${base}/profile`, label: nav.profile, icon: User },
    { href: `${base}/security`, label: nav.security, icon: ShieldCheck },
  ];

  const sheetSide = locale === "ar" ? "right" : "left";

  return (
    <div id="account-shell" className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* الطباعة: بوابة الحساب تطبيق — تُطبع صفحة المحتوى وحدها بلا ترويسة/تذييل الموقع وشريط الإعلان
          (إخفاء طباعي فقط؛ على الشاشة تبقى البوابة مدمجة في هيكل الموقع العام) */}
      <style>{`@media print { body:has(#account-shell) > header, body:has(#account-shell) > footer, body:has(#account-shell) > #site-announcement { display: none !important; } #account-shell { padding: 0 !important; } }`}</style>
      <div className="grid gap-8 lg:grid-cols-[15rem_minmax(0,1fr)]">
        {/* القائمة الجانبية — جهة البداية (مخفية عند الطباعة) */}
        <aside className="hidden print:hidden lg:block">
          <div className="sticky top-24 flex flex-col gap-4">
            <UserCard user={user} />
            <NavList items={items} pathname={pathname} unread={unread} nav={nav} locale={locale} />
          </div>
        </aside>

        <div className="min-w-0">
          {/* شريط الجوال (مخفي عند الطباعة) */}
          <div className="mb-4 flex items-center justify-between gap-3 print:hidden lg:hidden">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-10 rounded-full focus-visible:ring-2 focus-visible:ring-ring/40"
                  aria-label={nav.dashboard}
                >
                  <Menu className="h-5 w-5" aria-hidden="true" />
                </Button>
              </SheetTrigger>
              <SheetContent side={sheetSide} className="w-72 overflow-y-auto p-5">
                <SheetTitle className="sr-only">{nav.dashboard}</SheetTitle>
                <div className="flex flex-col gap-4">
                  <UserCard user={user} />
                  <NavList
                    items={items}
                    pathname={pathname}
                    unread={unread}
                    nav={nav}
                    locale={locale}
                    onNavigate={() => setOpen(false)}
                  />
                </div>
              </SheetContent>
            </Sheet>
            <Link
              href={`${base}/notifications`}
              className="relative inline-flex size-10 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-brand hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              aria-label={nav.notifications}
            >
              <Bell className="h-5 w-5" aria-hidden="true" />
              {unread > 0 && (
                <span className="absolute -top-0.5 -end-0.5 grid size-4 place-items-center rounded-full bg-skydrop text-[10px] font-bold text-navy">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Link>
          </div>

          {/* تنبيه البريد غير مؤكد */}
          {!user.emailVerified && (
            <div
              role="alert"
              className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-900"
            >
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              <div>
                <p className="font-semibold">{auth.pendingTitle}</p>
                <p className="mt-0.5">{auth.pendingBody}</p>
              </div>
            </div>
          )}

          {children}
        </div>
      </div>
    </div>
  );
}
