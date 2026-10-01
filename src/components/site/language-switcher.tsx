"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { Languages } from "lucide-react";
import { LOCALE_COOKIE, localeMeta, swapLocalePath, type Locale } from "@/lib/i18n";
import type { SiteContent } from "@/content/types";

/**
 * مبدّل اللغة: ينقل إلى الصفحة المقابلة في اللغة الأخرى،
 * ويحفظ الاختيار في كوكي يستخدمه تحويل الجذر في الزيارات القادمة.
 */
export function LanguageSwitcher({ locale, common }: { locale: Locale; common: SiteContent["common"] }) {
  const pathname = usePathname() ?? `/${locale}`;
  const other: Locale = localeMeta[locale].other;

  useEffect(() => {
    // مزامنة الكوكي مع الصفحة الحالية عند كل تنقل
    document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=Lax`;
  }, [locale]);

  return (
    <a
      href={swapLocalePath(pathname, other)}
      hrefLang={other}
      onClick={() => {
        document.cookie = `${LOCALE_COOKIE}=${other}; path=/; max-age=31536000; samesite=Lax`;
      }}
      className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-white/80 px-4 text-sm font-semibold text-navy transition-colors hover:border-brand hover:text-brand"
      aria-label={common.switchLanguage}
      lang={other}
      dir="ltr"
    >
      <Languages className="h-4 w-4" aria-hidden="true" />
      {localeMeta[locale].otherLabel}
    </a>
  );
}
