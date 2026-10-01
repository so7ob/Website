import type { MetadataRoute } from "next";
import { routes, locales, localePath, defaultLocale } from "@/lib/i18n";
import { siteConfig } from "@/config/site";

/** خريطة الموقع — كل صفحة باللغتين مع روابط الترابط اللغوي */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteConfig.url.replace(/\/+$/, "");
  const now = new Date();

  return routes.flatMap((route) => {
    return locales.map((locale) => ({
      url: `${base}${localePath(locale, route as (typeof routes)[number])}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: route === "" ? (locale === defaultLocale ? 1 : 0.9) : 0.7,
      alternates: {
        languages: Object.fromEntries(
          locales.map((l) => [l, `${base}${localePath(l, route as (typeof routes)[number])}`])
        ),
      },
    }));
  });
}
