import type { Metadata } from "next";
import { notFound } from "next/navigation";
import "@fontsource/ibm-plex-sans-arabic/400.css";
import "@fontsource/ibm-plex-sans-arabic/500.css";
import "@fontsource/ibm-plex-sans-arabic/600.css";
import "@fontsource/ibm-plex-sans-arabic/700.css";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-sans/700.css";
import "../globals.css";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { ar } from "@/content/ar";
import { en } from "@/content/en";
import { locales, localeMeta, type Locale } from "@/lib/i18n";
import { siteConfig } from "@/config/site";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

/** لا لغات أخرى خارج القائمة المعتمدة — المسار غير المعروف يذهب إلى 404 */
export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!locales.includes(locale as Locale)) return {};
  const content = locale === "en" ? en : ar;
  return {
    metadataBase: new URL(siteConfig.url),
    title: {
      default: content.meta.pages.home.title,
      template: `%s | ${content.meta.shortName}`,
    },
    description: content.meta.pages.home.description,
    applicationName: content.meta.siteName,
    openGraph: {
      type: "website",
      siteName: content.meta.siteName,
      locale: locale === "en" ? "en_US" : "ar_SA",
      alternateLocale: [locale === "en" ? "ar_SA" : "en_US"],
    },
    robots: { index: true, follow: true },
  };
}

export default async function LocaleRootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!locales.includes(raw as Locale)) notFound();
  const locale = raw as Locale;
  const content = locale === "en" ? en : ar;
  const dir = localeMeta[locale].dir;

  return (
    <html lang={locale} dir={dir}>
      <body className="flex min-h-screen flex-col">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-navy focus:px-4 focus:py-2 focus:text-white"
        >
          {content.common.skipToContent}
        </a>
        <SiteHeader locale={locale} content={content} />
        <main id="main-content" className="flex-1 overflow-x-clip">
          {children}
        </main>
        <SiteFooter locale={locale} content={content} />
      </body>
    </html>
  );
}
