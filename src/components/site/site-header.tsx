"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { Logo } from "./logo";
import { LanguageSwitcher } from "./language-switcher";
import { localePath, type Locale, type RouteName } from "@/lib/i18n";
import type { SiteContent } from "@/content/types";

const NAV_ROUTES: RouteName[] = ["about", "services", "works", "process", "faq", "contact"];

/** الترويسة: قائمة لاصقة مع حالة التمرير ودرج جوال متاح بلوحة المفاتيح */
export function SiteHeader({ locale, content }: { locale: Locale; content: SiteContent }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const pathname = usePathname() ?? `/${locale}`;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // منع تمرير الصفحة خلف الدرج المفتوح
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const isActive = (route: RouteName) => {
    const path = localePath(locale, route);
    return route === "" ? pathname === path : pathname.startsWith(path);
  };

  return (
    <header
      className={`sticky top-0 z-50 w-full border-b bg-white/90 backdrop-blur transition-shadow ${
        scrolled ? "border-border shadow-sm" : "border-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href={localePath(locale)} aria-label={content.common.brandAria} className="shrink-0 rounded-md">
          <Logo size="md" nameLang={locale === "ar" ? "ar" : "en"} />
        </Link>

        <nav aria-label={content.nav.home + " — " + content.meta.shortName} className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {NAV_ROUTES.map((route) => (
              <li key={route}>
                <Link
                  href={localePath(locale, route)}
                  aria-current={isActive(route) ? "page" : undefined}
                  className={`inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium transition-colors ${
                    isActive(route) ? "text-brand" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {content.nav[route]}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <LanguageSwitcher locale={locale} common={content.common} />
          <Link
            href={`${localePath(locale, "contact")}?type=quote`}
            className="inline-flex min-h-11 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-brand-strong"
          >
            {content.actions.quote}
          </Link>
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <LanguageSwitcher locale={locale} common={content.common} />
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? content.common.closeMenu : content.common.openMenu}
            className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-border text-foreground"
          >
            {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
          </button>
        </div>
      </div>

      {/* درج الجوال */}
      {open && (
        <div id="mobile-nav" className="border-t border-border bg-white lg:hidden">
          <nav aria-label={content.common.openMenu} className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
            <ul className="flex flex-col">
              {NAV_ROUTES.map((route) => (
                <li key={route}>
                  <Link
                    href={localePath(locale, route)}
                    aria-current={isActive(route) ? "page" : undefined}
                    onClick={() => setOpen(false)}
                    className={`flex min-h-12 items-center rounded-md px-3 text-base font-medium ${
                      isActive(route) ? "bg-accent text-brand-strong" : "text-foreground"
                    }`}
                  >
                    {content.nav[route]}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4">
              <Link
                href={`${localePath(locale, "contact")}?type=discussion`}
                onClick={() => setOpen(false)}
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-brand px-5 text-sm font-semibold text-brand"
              >
                {content.actions.discuss}
              </Link>
              <Link
                href={`${localePath(locale, "contact")}?type=quote`}
                onClick={() => setOpen(false)}
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground"
              >
                {content.actions.quote}
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
