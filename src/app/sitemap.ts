import type { MetadataRoute } from "next";
import { locales, localePath, defaultLocale } from "@/lib/i18n";
import { db } from "@/lib/db";
import { parsePageSettings } from "@/lib/page-settings";
import { siteConfig } from "@/config/site";

/**
 * خريطة الموقع من الصفحات المنشورة في قاعدة البيانات.
 * - اللغة تُدرج فقط إذا كانت نسختها المنشورة موجودة فعلًا (لا روابط 404).
 * - hreflang بين النسخ المتاحة فقط، وx-default للغة الافتراضية إن توفرت.
 */
export const dynamic = "force-dynamic";

function hasPublishedBlocks(json: string | null): boolean {
  if (!json) return false;
  try {
    return (JSON.parse(json) as unknown[]).length > 0;
  } catch {
    return false;
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteConfig.url.replace(/\/+$/, "");
  const now = new Date();

  const pages = await db.page.findMany({
    where: { status: { not: "archived" }, visibility: "public" },
    select: {
      slug: true,
      isHome: true,
      order: true,
      visibility: true, // احتياط parsePageSettings يعتمد الحقل المباشر عند غياب اللقطة
      publishedAt: true,
      publishedSettings: true,
      publishedBlocksAr: true,
      publishedBlocksEn: true,
    },
    orderBy: { order: "asc" },
  });

  const entries: MetadataRoute.Sitemap = [];
  for (const page of pages) {
    // الظهور من اللقطة المنشورة (احتياطًا: الحقل المباشر للصفحات القديمة)
    const settings = parsePageSettings(page.publishedSettings, page);
    if (settings.visibility !== "public") continue;

    const available = locales.filter((l) => hasPublishedBlocks(l === "ar" ? page.publishedBlocksAr : page.publishedBlocksEn));
    if (available.length === 0) continue;

    const alternates =
      available.length > 1
        ? {
            alternates: {
              languages: Object.fromEntries(available.map((l) => [l, `${base}${localePath(l, page.slug as never)}`])),
            },
          }
        : {};

    for (const locale of available) {
      entries.push({
        url: `${base}${localePath(locale, page.slug as never)}`,
        lastModified: page.publishedAt ?? now,
        changeFrequency: "monthly" as const,
        priority: page.isHome ? (locale === defaultLocale ? 1 : 0.9) : 0.7,
        ...alternates,
      });
    }
  }

  return entries;
}
