import type { MetadataRoute } from "next";
import { locales, localePath, defaultLocale } from "@/lib/i18n";
import { db } from "@/lib/db";
import { siteConfig } from "@/config/site";

/** خريطة الموقع من الصفحات المنشورة في قاعدة البيانات — تتحدث تلقائيًا مع النشر */
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteConfig.url.replace(/\/+$/, "");
  const now = new Date();

  const pages = await db.page.findMany({
    where: { status: "published", visibility: "public" },
    select: { slug: true, publishedAt: true, isHome: true },
    orderBy: { order: "asc" },
  });

  return pages.flatMap((page) => {
    return locales.map((locale) => ({
      url: `${base}${localePath(locale, page.slug as never)}`,
      lastModified: page.publishedAt ?? now,
      changeFrequency: "monthly" as const,
      priority: page.isHome ? (locale === defaultLocale ? 1 : 0.9) : 0.7,
      alternates: {
        languages: Object.fromEntries(locales.map((l) => [l, `${base}${localePath(l, page.slug as never)}`])),
      },
    }));
  });
}
