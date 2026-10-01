"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { Locale } from "@/lib/i18n";

/** هل الرابط خارجي http(s) — يفتح في تبويب جديد */
export function isExternalHref(href: string): boolean {
  return /^(https?:)?\/\//i.test(href);
}

/** روابط مطلقة (بريد/هاتف) تُعرض كـ a عادية دون تبويب جديد */
export function isAbsoluteHref(href: string): boolean {
  return isExternalHref(href) || href.startsWith("mailto:") || href.startsWith("tel:");
}

/** يطبّق بادئة اللغة على المسارات الداخلية القادمة من محتوى المحرر */
export function localizeHref(href: string, locale: Locale): string {
  if (!href.startsWith("/") || /^\/(ar|en)(\/|$)/.test(href)) return href;
  return href === "/" ? `/${locale}` : `/${locale}${href}`;
}

/**
 * رابط موحّد لكل مكونات CMS: داخلي → Link مع بادئة اللغة،
 * خارجي → a بتبويب جديد، فارغ → span بلا تنقل.
 */
export function BlockLink({
  href,
  locale,
  className,
  children,
  ariaLabel,
}: {
  href: string;
  locale: Locale;
  className?: string;
  children: ReactNode;
  ariaLabel?: string;
}) {
  if (!href) {
    return (
      <span className={className} aria-label={ariaLabel}>
        {children}
      </span>
    );
  }
  if (isExternalHref(href)) {
    return (
      <a href={href} className={className} target="_blank" rel="noopener noreferrer" aria-label={ariaLabel}>
        {children}
      </a>
    );
  }
  if (isAbsoluteHref(href)) {
    return (
      <a href={href} className={className} aria-label={ariaLabel}>
        {children}
      </a>
    );
  }
  return (
    <Link href={localizeHref(href, locale)} className={className} aria-label={ariaLabel}>
      {children}
    </Link>
  );
}
