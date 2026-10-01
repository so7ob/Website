/** اللغات المدعومة ومساراتها — العربية أولًا */
export const locales = ["ar", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "ar";

/** الخصائص الاتجاهية لكل لغة */
export const localeMeta: Record<Locale, { dir: "rtl" | "ltr"; label: string; other: Locale; otherLabel: string }> = {
  ar: { dir: "rtl", label: "العربية", other: "en", otherLabel: "English" },
  en: { dir: "ltr", label: "English", other: "ar", otherLabel: "العربية" },
};

/** أسماء المسارات لكل لغة — الأسماء ثابتة بين اللغتين لتبسيط التبادل والأداء */
export const routes = ["", "about", "services", "works", "process", "faq", "contact"] as const;
export type RouteName = (typeof routes)[number];

/** قاموس المسار الأساسي لكل صفحة (بلا بادئة اللغة) */
export const routeNames: Record<string, RouteName> = {
  "": "",
  about: "about",
  services: "services",
  works: "works",
  process: "process",
  faq: "faq",
  contact: "contact",
};

/** يبني رابطًا كاملًا بلغة معينة */
export function localePath(locale: Locale, route: RouteName = ""): string {
  return route ? `/${locale}/${route}` : `/${locale}`;
}

/**
 * يحوّل مسارًا من لغة إلى أخرى: /ar/services → /en/services
 * يستخدمه مبدّل اللغة للحفاظ على الصفحة المقابلة.
 */
export function swapLocalePath(pathname: string, to: Locale): string {
  const clean = pathname.replace(/^\/+(ar|en)/, "").replace(/\/+$/, "");
  const rest = clean.replace(/^\//, "");
  return rest ? `/${to}/${rest}` : `/${to}`;
}

/** يستخرج اللغة من مسار، أو يرجع null إن لم تكن موجودة */
export function localeFromPath(pathname: string): Locale | null {
  const m = pathname.match(/^\/(ar|en)(\/|$)/);
  return m ? (m[1] as Locale) : null;
}

/** مفتاح كوكي حفظ اختيار اللغة */
export const LOCALE_COOKIE = "so7ob-locale";
