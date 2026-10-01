/**
 * تنسيقات مشتركة لبوابة العميل — التواريخ والأحجام بلغة المستخدم.
 */
import { format, formatDistanceToNow } from "date-fns";
import { ar, enUS } from "date-fns/locale";
import type { Locale } from "@/lib/i18n";

const DASH = "—";

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

const dateLocale = (locale: Locale) => (locale === "en" ? enUS : ar);

/** تاريخ كامل مع الوقت — 12 يناير 2026، 10:30 ص */
export function formatDate(value: string | Date | null | undefined, locale: Locale): string {
  const d = toDate(value);
  return d ? format(d, "PPP p", { locale: dateLocale(locale) }) : DASH;
}

/** تاريخ دون وقت */
export function formatDateOnly(value: string | Date | null | undefined, locale: Locale): string {
  const d = toDate(value);
  return d ? format(d, "PPP", { locale: dateLocale(locale) }) : DASH;
}

/** زمن نسبي — «قبل ٣ دقائق» */
export function formatRelative(value: string | Date | null | undefined, locale: Locale): string {
  const d = toDate(value);
  return d ? formatDistanceToNow(d, { addSuffix: true, locale: dateLocale(locale) }) : DASH;
}

/** حجم ملف بوحدات مقروءة */
export function formatBytes(bytes: number | null | undefined, locale: Locale): string {
  if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes < 0) return DASH;
  const unit = bytes >= 1048576 ? "megabyte" : "kilobyte";
  return new Intl.NumberFormat(locale === "en" ? "en" : "ar", {
    style: "unit",
    unit,
    maximumFractionDigits: 1,
  }).format(bytes >= 1048576 ? bytes / 1048576 : bytes / 1024);
}

/** وصف مبسط للمتصفح/النظام من User-Agent — بلا مكتبات خارجية */
export function describeUserAgent(ua: string | null | undefined, fallback: string): string {
  if (!ua) return fallback;
  const browser =
    /Edg\//.test(ua) ? "Edge" :
    /OPR\//.test(ua) ? "Opera" :
    /Firefox\//.test(ua) ? "Firefox" :
    /Chrome\//.test(ua) ? "Chrome" :
    /Safari\//.test(ua) ? "Safari" :
    null;
  const os =
    /Windows/.test(ua) ? "Windows" :
    /Android/.test(ua) ? "Android" :
    /iPhone|iPad|iPod/.test(ua) ? "iOS" :
    /Mac OS X/.test(ua) ? "macOS" :
    /Linux/.test(ua) ? "Linux" :
    null;
  if (!browser && !os) return fallback;
  const parts = [browser, os].filter(Boolean);
  return parts.join(" · ");
}
