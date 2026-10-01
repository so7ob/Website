/**
 * بيانات الموقع المشتركة للعرض — القوائم والإعدادات من قاعدة البيانات.
 * الرجوع إلى القيم الثابتة عند غياب البيانات (fail-safe) حتى لا يتضرر العرض.
 */
import { db } from "@/lib/db";
import type { Locale } from "@/lib/i18n";
import { localePath, type RouteName } from "@/lib/i18n";
import { ar } from "@/content/ar";
import { en } from "@/content/en";
import { siteConfig } from "@/config/site";

export interface NavLink {
  label: string;
  href: string;
  enabled: boolean;
  order: number;
}

const FALLBACK_HEADER: RouteName[] = ["about", "services", "works", "process", "faq", "contact"];

/** قائمة الترويسة أو التذييل من قاعدة البيانات مع ترتيب مرتب */
export async function getMenu(location: "header" | "footer", locale: Locale): Promise<NavLink[]> {
  const rows = await db.menuItem.findMany({
    where: { location, enabled: true },
    orderBy: { order: "asc" },
  });
  if (rows.length === 0) {
    // تراجع آمن إلى القائمة الثابتة الحالية
    const content = locale === "en" ? en : ar;
    return FALLBACK_HEADER.map((route, order) => ({
      label: content.nav[route],
      href: localePath(locale, route),
      enabled: true,
      order,
    }));
  }
  return rows.map((row) => ({
    label: locale === "en" ? row.labelEn : row.labelAr,
    href: row.url ?? (row.pageSlug !== null ? (row.pageSlug === "" ? localePath(locale) : `/${locale}/${row.pageSlug}`) : "#"),
    enabled: row.enabled,
    order: row.order,
  }));
}

export interface SiteSettings {
  contactEmail: string;
  contactPhone: string;
  contactAddress: string;
  socialGithub: string;
  nameAr: string;
  nameEn: string;
}

export async function getSettings(): Promise<SiteSettings> {
  const rows = await db.siteSetting.findMany({
    where: { key: { in: ["contact.email", "contact.phone", "contact.address", "social.github", "site.nameAr", "site.nameEn"] } },
  });
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    contactEmail: map.get("contact.email") || siteConfig.contact.email,
    contactPhone: map.get("contact.phone") || siteConfig.contact.phone,
    contactAddress: map.get("contact.address") || siteConfig.contact.address,
    socialGithub: map.get("social.github") || siteConfig.github,
    nameAr: map.get("site.nameAr") || siteConfig.nameAr,
    nameEn: map.get("site.nameEn") || siteConfig.nameEn,
  };
}
