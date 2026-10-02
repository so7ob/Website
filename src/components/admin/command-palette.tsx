"use client";

/**
 * لوحة الأوامر الشاملة للإدارة (Ctrl+K أو ⌘K — ومفتاح «/» خارج حقول الإدخال):
 * عند فراغ البحث تعرض تنقلًا سريعًا لأقسام اللوحة (مصفّى بصلاحيات المستخدم)،
 * وعند كتابة حرفين أو أكثر تبحث في المستخدمين والطلبات والاستفسارات والصفحات
 * عبر /api/admin/search مع تأجيل 250ms وإلغاء الطلبات السابقة (AbortController).
 * التصفية هنا خادمية (shouldFilter={false}) — النتائج المعروضة هي قرار الخادم،
 * والتنقّل بالأسهم وتحديد العنصر النشط وEnter يتولاها cmdk كما في لوحة الكتل.
 * تأجيل البحث وإدارته يجريان داخل معالج الإدخال نفسه (مؤقّت) — بلا تأثيرات
 * تحالة، فتحديث الحالة لا يحدث خارج معالجات الأحداث وردود الطلبات.
 */
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
  SearchX,
  Loader2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getPortalContent } from "@/content/portal";
import { can } from "@/lib/auth/permissions";
import type { Permission } from "@/lib/auth/permissions";
import type { Locale } from "@/lib/i18n";
import type { Me } from "./types";

// ——— أشكال نتائج /api/admin/search ———
interface SearchUser {
  id: string;
  name: string;
  email: string;
  status: string;
  roleKey: string;
}
interface SearchRequest {
  id: string;
  refCode: string;
  name: string;
  status: string;
}
interface SearchInquiry {
  id: string;
  refCode: string;
  email: string;
  subject: string;
  status: string;
}
interface SearchPage {
  id: string;
  slug: string;
  titleAr: string;
  titleEn: string;
  status: string;
}
interface SearchResults {
  ok: boolean;
  users: SearchUser[];
  requests: SearchRequest[];
  inquiries: SearchInquiry[];
  pages: SearchPage[];
}

const EMPTY_RESULTS: SearchResults = { ok: true, users: [], requests: [], inquiries: [], pages: [] };

/** صف نتائج موحد — لغة رقائق المشروع (chip + نص + حبة حالة) */
const ITEM_CLASS =
  "min-h-11 cursor-pointer gap-3 rounded-xl px-2.5 py-2 transition-colors hover:bg-muted/50 data-[selected=true]:bg-accent/60 data-[selected=true]:hover:bg-accent/60";

/** عنوان مجموعة بصيغة ترويسات الجداول: صغير معتبر بأحرف كبيرة */
const GROUP_CLASS =
  "[&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide";

const KBD_CLASS =
  "rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground";

interface CommandPaletteProps {
  me: Me;
  locale: Locale;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface PaletteNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  permission?: Permission;
}

export function CommandPalette({ me, locale, open, onOpenChange }: CommandPaletteProps) {
  const t = getPortalContent(locale);
  const ts = t.admin.search;
  const tnav = t.admin.nav;
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>(EMPTY_RESULTS);
  const [busy, setBusy] = useState(false);
  const timerRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const trimmed = query.trim();
  const searching = trimmed.length >= 2;

  // لوحة المفاتيح العامة: Ctrl+K / ⌘K تفتح وتغلق، و«/» تفتح خارج حقول الإدخال
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
        return;
      }
      if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const el = document.activeElement;
        const tag = el?.tagName ?? "";
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (el as HTMLElement | null)?.isContentEditable) {
          return;
        }
        e.preventDefault();
        onOpenChange(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const stopSearch = () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    abortRef.current?.abort();
    abortRef.current = null;
  };

  const resetSearch = () => {
    stopSearch();
    setBusy(false);
    setResults(EMPTY_RESULTS);
  };

  // طلب البحث — الاستجابة وحدها مصدر الحقيقة (الصلاحيات والمطابقة في الخادم)
  const runSearch = async (q: string) => {
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    try {
      const res = await fetch(`/api/admin/search?q=${encodeURIComponent(q)}`, { signal: controller.signal });
      if (controller.signal.aborted) return;
      if (!res.ok) {
        setResults(EMPTY_RESULTS);
        return;
      }
      const data = (await res.json()) as SearchResults;
      if (controller.signal.aborted) return;
      setResults(data && data.ok ? data : EMPTY_RESULTS);
    } catch {
      /* إلغاء أو انقطاع — بلا تغيير */
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  };

  // معالج الإدخال: يدير التأجيل (250ms) والإلغاء وإعادة الضبط — كل تحديث الحالة
  // يحدث هنا أو في ردود الطلب، لا في تأثيرات
  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    const q = value.trim();
    if (!open || q.length < 2) {
      resetSearch();
      return;
    }
    // يغطي مهلة التأجيل ومدة الطلب معًا — يمنع وميض «لا نتائج» قبل اكتمال البحث
    setBusy(true);
    abortRef.current?.abort(); // أوقف طلبًا جارٍ من استعلام أسبق
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      void runSearch(q);
    }, 250);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setQuery("");
      resetSearch();
    }
    onOpenChange(next);
  };

  const go = (href: string) => {
    handleOpenChange(false);
    router.push(href);
  };

  // نفس بنود شريط الإدارة — تصفى بصلاحيات المستخدم الحالي
  const navItems: PaletteNavItem[] = [
    { href: `/${locale}/admin`, label: tnav.dashboard, icon: LayoutDashboard },
    { href: `/${locale}/admin/users`, label: tnav.users, icon: Users, permission: "users.view" },
    { href: `/${locale}/admin/requests`, label: tnav.requests, icon: Inbox, permission: "requests.view.all" },
    { href: `/${locale}/admin/inquiries`, label: tnav.inquiries, icon: MessageSquareText, permission: "inquiries.view.all" },
    { href: `/${locale}/admin/notifications`, label: tnav.notifications, icon: Bell },
    { href: `/${locale}/admin/pages`, label: tnav.pages, icon: FileText, permission: "pages.view" },
    { href: `/${locale}/admin/media`, label: tnav.media, icon: Images, permission: "media.manage" },
    { href: `/${locale}/admin/menus`, label: tnav.menus, icon: ListTree, permission: "menus.manage" },
    { href: `/${locale}/admin/settings`, label: tnav.settings, icon: Settings, permission: "settings.manage" },
    { href: `/${locale}/admin/audit`, label: tnav.audit, icon: ScrollText, permission: "audit.view" },
    { href: `/${locale}/admin/outbox`, label: tnav.outbox, icon: Send, permission: "email.outbox" },
  ];
  const visibleNav = navItems.filter((item) => !item.permission || can(me, item.permission));

  const userStatusLabel = (s: string) =>
    s === "active"
      ? t.admin.users.statusActive
      : s === "pending_verification"
        ? t.admin.users.statusPending
        : t.admin.users.statusSuspended;
  const requestStatusLabel = (s: string) => t.admin.requests.statuses[s] ?? s;
  const inquiryStatusLabel = (s: string) => t.admin.inquiries.statuses[s] ?? s;
  const pageTitle = (p: SearchPage) => (locale === "en" ? p.titleEn || p.titleAr : p.titleAr || p.titleEn);

  const hasResults =
    results.users.length > 0 ||
    results.requests.length > 0 ||
    results.inquiries.length > 0 ||
    results.pages.length > 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        aria-label={ts.trigger}
        showCloseButton={false}
        className="gap-0 overflow-hidden rounded-2xl p-0 shadow-lg shadow-navy/10 sm:max-w-lg"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{ts.trigger}</DialogTitle>
          <DialogDescription>{ts.placeholder}</DialogDescription>
        </DialogHeader>
        {/* shouldFilter={false}: التصفية خادمية (الصلاحيات والمطابقة هناك)؛
            التنقّل بالأسهم وتحديد العنصر النشط وEnter يتولاها cmdk.
            label يمنح حقل البحث اسمًا وصوليًا، وdir يضبط اتجاه القائمة. */}
        <Command
          shouldFilter={false}
          label={ts.placeholder}
          dir={locale === "ar" ? "rtl" : "ltr"}
          className="[&_[data-slot=command-input-wrapper]]:min-h-11"
        >
          <CommandInput
            value={query}
            onValueChange={handleQueryChange}
            placeholder={ts.placeholder}
            className="min-h-11 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          />
          <CommandList
            label={searching ? ts.results : ts.quickNav}
            className="max-h-96 p-2"
          >
            {busy ? (
              <div role="status" className="flex items-center gap-2 px-2.5 py-2 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                {ts.searching}
              </div>
            ) : null}

            {searching ? (
              <>
                {can(me, "users.view") && results.users.length > 0 ? (
                  <CommandGroup heading={tnav.users} className={GROUP_CLASS}>
                    {results.users.map((u) => (
                      <CommandItem
                        key={u.id}
                        value={`${u.name} ${u.email}`}
                        onSelect={() => go(`/${locale}/admin/users/${u.id}`)}
                        className={ITEM_CLASS}
                      >
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-brand-strong">
                          <Users className="size-4" aria-hidden="true" strokeWidth={1.8} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-navy">{u.name}</span>
                          <span className="block truncate text-xs text-muted-foreground ltr-isolate">{u.email}</span>
                        </span>
                        <span className="ms-auto shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                          {userStatusLabel(u.status)}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ) : null}

                {can(me, "requests.view.all") && results.requests.length > 0 ? (
                  <CommandGroup heading={tnav.requests} className={GROUP_CLASS}>
                    {results.requests.map((r) => (
                      <CommandItem
                        key={r.id}
                        value={`${r.refCode} ${r.name}`}
                        onSelect={() => go(`/${locale}/admin/requests/${r.id}`)}
                        className={ITEM_CLASS}
                      >
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-brand-strong">
                          <Inbox className="size-4" aria-hidden="true" strokeWidth={1.8} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-navy">{r.name}</span>
                          <span className="block truncate font-mono text-xs text-muted-foreground ltr-isolate">
                            {r.refCode}
                          </span>
                        </span>
                        <span className="ms-auto shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                          {requestStatusLabel(r.status)}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ) : null}

                {can(me, "inquiries.view.all") && results.inquiries.length > 0 ? (
                  <CommandGroup heading={tnav.inquiries} className={GROUP_CLASS}>
                    {results.inquiries.map((i) => (
                      <CommandItem
                        key={i.id}
                        value={`${i.refCode} ${i.subject} ${i.email}`}
                        onSelect={() => go(`/${locale}/admin/inquiries/${i.id}`)}
                        className={ITEM_CLASS}
                      >
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-brand-strong">
                          <MessageSquareText className="size-4" aria-hidden="true" strokeWidth={1.8} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-navy">{i.subject}</span>
                          <span className="block truncate font-mono text-xs text-muted-foreground ltr-isolate">
                            {i.refCode} · {i.email}
                          </span>
                        </span>
                        <span className="ms-auto shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                          {inquiryStatusLabel(i.status)}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ) : null}

                {can(me, "pages.view") && results.pages.length > 0 ? (
                  <CommandGroup heading={tnav.pages} className={GROUP_CLASS}>
                    {results.pages.map((p) => (
                      <CommandItem
                        key={p.id}
                        value={`${p.slug} ${p.titleAr} ${p.titleEn}`}
                        onSelect={() => go(`/${locale}/admin/pages/${p.id}/edit`)}
                        className={ITEM_CLASS}
                      >
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-brand-strong">
                          <FileText className="size-4" aria-hidden="true" strokeWidth={1.8} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-navy">{pageTitle(p)}</span>
                          <span className="block truncate font-mono text-xs text-muted-foreground ltr-isolate">
                            {p.slug === "" ? "/" : p.slug}
                          </span>
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ) : null}

                {!busy && !hasResults ? (
                  <CommandEmpty>
                    <span className="mx-auto flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                      <SearchX className="size-5" aria-hidden="true" />
                    </span>
                    <p className="mt-2 text-sm font-medium text-navy">{ts.noResults}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{ts.noResultsHint}</p>
                  </CommandEmpty>
                ) : null}
              </>
            ) : (
              <CommandGroup heading={ts.quickNav} className={GROUP_CLASS}>
                {visibleNav.map((item) => (
                  <CommandItem
                    key={item.href}
                    value={item.href}
                    onSelect={() => go(item.href)}
                    className={ITEM_CLASS}
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-brand-strong">
                      <item.icon className="size-4" aria-hidden="true" strokeWidth={1.8} />
                    </span>
                    <span className="min-w-0 truncate text-sm font-medium text-navy">{item.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>

          {/* تلميح سفلي: افتح النتيجة + مفاتيح الدخول والخروج */}
          <div className="flex items-center gap-2 border-t border-border px-3 py-2.5">
            <p className="min-w-0 truncate text-xs text-muted-foreground">{ts.openHint}</p>
            <span className="ms-auto flex shrink-0 items-center gap-1.5 ltr-isolate">
              <kbd className={KBD_CLASS}>Enter</kbd>
              <kbd className={KBD_CLASS}>Esc</kbd>
            </span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
