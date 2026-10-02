"use client";

/**
 * هيكل لوحة الإدارة: شريط جانبي كثيف (سطح المكتب) + درج (الجوال) + شريط علوي.
 * تُخفى ترويسة/تذييل الموقع العام عند وجود هذا الهيكل (body:has) لأن اللوحة
 * تطبيق قائم بذاته، والعودة للموقع متاحة من أسفل الشريط الجانبي.
 */
import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Inbox,
  MessageSquareText,
  Bell,
  FileText,
  Images,
  ListTree,
  Settings,
  ScrollText,
  Send,
  Home,
  LogOut,
  Menu,
  Search,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { getPortalContent } from "@/content/portal";
import { ar as siteAr } from "@/content/ar";
import { en as siteEn } from "@/content/en";
import { can } from "@/lib/auth/permissions";
import type { Permission } from "@/lib/auth/permissions";
import { localeMeta, swapLocalePath, type Locale } from "@/lib/i18n";
import { roleLabel } from "./badges";
import type { Me } from "./types";
import { CommandPalette } from "./command-palette";
import { cn } from "@/lib/utils";

interface AdminShellProps {
  me: Me;
  locale: Locale;
  siteName: string;
  children: React.ReactNode;
}

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  permission?: Permission;
}

/** اشتراك فارغ — قيمة «هل هذا ماك؟» تُقرأ عند التصيير عبر useSyncExternalStore
 *  (لقطة خادمية false ثم القيمة الفعلية بعد الإغراق، بلا عدم تطابق) */
const subscribePlatform = () => () => {};

export function AdminShell({ me, locale, siteName, children }: AdminShellProps) {
  const pathname = usePathname() ?? `/${locale}/admin`;
  const [mobileOpen, setMobileOpen] = useState(false);
  // لوحة البحث الشاملة (Ctrl+K) — الحالة هنا ليصل إليها الزر ومستمع المفاتيح داخلها
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const t = getPortalContent(locale).admin.nav;
  const tn = getPortalContent(locale).admin.notifications;
  const ts = getPortalContent(locale).admin.search;
  const openMenuLabel = (locale === "en" ? siteEn : siteAr).common.openMenu;
  // اكتشاف ماك لعرض «⌘ K» بدل «Ctrl K» في رقاقة الاختصار
  const isMac = useSyncExternalStore(
    subscribePlatform,
    () => /mac|iphone|ipad|ipod/i.test(navigator.platform),
    () => false
  );

  // نقطة إشعارات الفريق: جلب فوري ثم كل 30 ثانية، وتحديث عند تغيير الصفحة
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

  const items: NavItem[] = [
    { href: `/${locale}/admin`, label: t.dashboard, icon: LayoutDashboard },
    { href: `/${locale}/admin/users`, label: t.users, icon: Users, permission: "users.view" },
    { href: `/${locale}/admin/requests`, label: t.requests, icon: Inbox, permission: "requests.view.all" },
    { href: `/${locale}/admin/inquiries`, label: t.inquiries, icon: MessageSquareText, permission: "inquiries.view.all" },
    { href: `/${locale}/admin/notifications`, label: t.notifications, icon: Bell },
    { href: `/${locale}/admin/pages`, label: t.pages, icon: FileText, permission: "pages.view" },
    { href: `/${locale}/admin/media`, label: t.media, icon: Images, permission: "media.manage" },
    { href: `/${locale}/admin/menus`, label: t.menus, icon: ListTree, permission: "menus.manage" },
    { href: `/${locale}/admin/settings`, label: t.settings, icon: Settings, permission: "settings.manage" },
    { href: `/${locale}/admin/audit`, label: t.audit, icon: ScrollText, permission: "audit.view" },
    { href: `/${locale}/admin/outbox`, label: t.outbox, icon: Send, permission: "email.outbox" },
  ];
  const visibleItems = items.filter((item) => !item.permission || can(me, item.permission));

  const isActive = (href: string) =>
    href === `/${locale}/admin` ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  const titleFor = (path: string): string => {
    const rest = path.replace(new RegExp(`^/${locale}/admin/?`), "").split("/").filter(Boolean);
    const segment = rest[0] ?? "";
    const map: Record<string, string> = {
      users: t.users,
      requests: t.requests,
      inquiries: t.inquiries,
      notifications: t.notifications,
      pages: t.pages,
      media: t.media,
      menus: t.menus,
      settings: t.settings,
      audit: t.audit,
      outbox: t.outbox,
    };
    return map[segment] ?? t.dashboard;
  };

  const otherLocaleHref = swapLocalePath(pathname, localeMeta[locale].other);
  const sheetSide = locale === "ar" ? "right" : "left";
  const brandInitial = siteName.trim().slice(0, 1).toUpperCase() || "·";

  const navList = (onNavigate?: () => void) => (
    <ul className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
      {visibleItems.map((item) => {
        const active = isActive(item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors duration-200",
                active ? "bg-white/10 text-skydrop" : "text-white/75 hover:bg-white/5 hover:text-white"
              )}
            >
              {active ? (
                <span aria-hidden="true" className="absolute inset-y-2 start-0 w-1 rounded-full bg-skydrop" />
              ) : null}
              <item.icon className="size-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{item.label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );

  const sidebarFooter = (onNavigate?: () => void) => (
    <div className="border-t border-white/10 px-3 py-4">
      <Link
        href={`/${locale}`}
        onClick={onNavigate}
        className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-white/75 transition-colors duration-200 hover:bg-white/5 hover:text-white"
      >
        <Home className="size-4 shrink-0" aria-hidden="true" />
        <span className="truncate">{t.backSite}</span>
      </Link>
      <Link
        href={`/${locale}/auth/logout`}
        onClick={onNavigate}
        className="mt-1 flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-white/75 transition-colors duration-200 hover:bg-white/5 hover:text-white"
      >
        <LogOut className="size-4 shrink-0" aria-hidden="true" />
        <span className="truncate">{t.logout}</span>
      </Link>
      <div className="mt-3 flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-skydrop/20 text-sm font-bold text-skydrop" aria-hidden="true">
          {me.name.trim().slice(0, 1).toUpperCase() || "·"}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{me.name}</p>
          <p className="truncate text-xs text-white/60">{roleLabel(me.roleKey, locale)}</p>
        </div>
      </div>
    </div>
  );

  return (
    <div id="admin-shell" className="flex min-h-dvh bg-muted/40">
      {/* إخفاء ترويسة وتذييل الموقع العام وشريط الإعلان داخل اللوحة — اللوحة تطبيق مستقل */}
      <style>{`body:has(#admin-shell) > header, body:has(#admin-shell) > footer, body:has(#admin-shell) > #site-announcement { display: none !important; }`}</style>

      {/* الشريط الجانبي — سطح المكتب (مخفي عند الطباعة) */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col bg-gradient-to-b from-navy to-navy-soft text-white print:hidden lg:flex">
        <div className="flex h-16 items-center gap-3 border-b border-white/10 px-5">
          <span
            className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-skydrop/25 to-white/5 text-base font-bold text-skydrop"
            aria-hidden="true"
          >
            {brandInitial}
          </span>
          <p className="truncate text-sm font-bold tracking-tight">{siteName}</p>
        </div>
        {navList()}
        {sidebarFooter()}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* الشريط العلوي (مخفي عند الطباعة) */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-white/90 px-4 backdrop-blur print:hidden sm:px-6">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="size-10 lg:hidden" aria-label={openMenuLabel}>
                <Menu className="h-5 w-5" aria-hidden="true" />
              </Button>
            </SheetTrigger>
            <SheetContent side={sheetSide} className="w-72 gap-0 bg-gradient-to-b from-navy to-navy-soft p-0 text-white">
              <SheetHeader className="border-b border-white/10 p-0">
                <SheetTitle className="flex h-16 items-center gap-3 px-5 text-white">
                  <span
                    className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-skydrop/25 to-white/5 text-base font-bold text-skydrop"
                    aria-hidden="true"
                  >
                    {brandInitial}
                  </span>
                  <span className="truncate text-sm font-bold">{siteName}</span>
                </SheetTitle>
              </SheetHeader>
              {navList(() => setMobileOpen(false))}
              {sidebarFooter(() => setMobileOpen(false))}
            </SheetContent>
          </Sheet>

          <h2 className="truncate text-sm font-semibold text-navy sm:text-base">{titleFor(pathname)}</h2>

          <div className="ms-auto flex items-center gap-2">
            {/* زر لوحة البحث الشامل — سطح المكتب: حبة تحمل الاختصار، الجوال: أيقونة */}
            <Button
              variant="outline"
              onClick={() => setPaletteOpen(true)}
              aria-keyshortcuts={isMac ? "Meta+k" : "Control+k"}
              className="hidden h-10 min-h-10 items-center gap-2 rounded-full px-3 focus-visible:ring-2 focus-visible:ring-ring/40 sm:flex"
            >
              <Search className="size-4 text-muted-foreground" aria-hidden="true" />
              <span className="text-xs font-semibold text-muted-foreground">{ts.trigger}</span>
              <span className="ltr-isolate" aria-hidden="true">
                <kbd className="rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                  {isMac ? "⌘ K" : "Ctrl K"}
                </kbd>
              </span>
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setPaletteOpen(true)}
              aria-label={ts.trigger}
              aria-keyshortcuts={isMac ? "Meta+k" : "Control+k"}
              className="size-10 sm:hidden"
            >
              <Search className="size-5" aria-hidden="true" />
            </Button>
            <Button asChild variant="ghost" size="icon" className="relative size-10 rounded-full">
              <Link
                href={`/${locale}/admin/notifications`}
                aria-label={unread > 0 ? `${tn.title} (${unread})` : tn.title}
              >
                <Bell className="size-5" aria-hidden="true" />
                {unread > 0 ? (
                  <span className="absolute -top-0.5 -end-0.5 grid size-4 place-items-center rounded-full bg-skydrop text-[10px] font-bold text-navy">
                    {unread > 9 ? "9+" : unread}
                  </span>
                ) : null}
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="min-h-9 rounded-full px-3 text-xs font-semibold">
              <Link href={otherLocaleHref} hrefLang={localeMeta[locale].other}>
                {localeMeta[locale].otherLabel}
              </Link>
            </Button>
            <div className="hidden items-center gap-2.5 rounded-full border border-border bg-white/90 py-1.5 pe-3 ps-1.5 shadow-sm backdrop-blur sm:flex">
              <span
                className="flex size-7 items-center justify-center rounded-full bg-gradient-to-br from-brand to-navy text-xs font-bold text-white"
                aria-hidden="true"
              >
                {me.name.trim().slice(0, 1).toUpperCase() || "·"}
              </span>
              <p className="max-w-40 truncate text-sm font-medium text-navy">{me.name}</p>
            </div>
          </div>
        </header>

        {/* لوحة الأوامر الشاملة — تُفتح من الزر أعلاه أو Ctrl+K / ⌘K / «/» */}
        <CommandPalette me={me} locale={locale} open={paletteOpen} onOpenChange={setPaletteOpen} />

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>

      <Toaster position="top-center" closeButton />
    </div>
  );
}
