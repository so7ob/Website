import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Logo } from "@/components/site/logo";
import { Toaster } from "@/components/ui/sonner";
import { getPortalContent } from "@/content/portal";
import { localeMeta, localePath, locales, type Locale } from "@/lib/i18n";
import { getSettings } from "@/lib/site-data";
import { TrackClient } from "./track-client";

/** بيانات وصفية لصفحة المتابعة العامة — بلا فهرسة (روابط متابعة سرية) */
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!locales.includes(locale as Locale)) return {};
  return {
    title: getPortalContent(locale as Locale).track.title,
    robots: { index: false, follow: false },
  };
}

/** صفحة المتابعة العامة — عمود مركزي بهوية العلامة بلا قوائم البوابة (نمط صفحات المصادقة) */
export default async function TrackPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale: raw } = await params;
  if (!locales.includes(raw as Locale)) notFound();
  const locale = raw as Locale;
  const dir = localeMeta[locale].dir;
  const portal = getPortalContent(locale);

  const [settings, query] = await Promise.all([getSettings(), searchParams]);
  const token = typeof query.t === "string" ? query.t : undefined;
  const cardParam = typeof query.card === "string" ? query.card : undefined;
  const siteName = locale === "ar" ? settings.nameAr : settings.nameEn;

  return (
    <div dir={dir} className="relative mx-auto flex w-full max-w-2xl flex-col items-center px-4 py-10 sm:py-14">
      {/* خلفية زخرفية — نفس لغة صفحات المصادقة */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-x-0 -top-24 h-64 bg-gradient-to-b from-accent/70 via-brand/10 to-transparent" />
        <div className="absolute -top-16 start-[-6rem] size-56 rounded-full bg-skydrop/20 blur-3xl" />
        <div className="absolute top-24 end-[-7rem] size-64 rounded-full bg-brand/15 blur-3xl" />
      </div>

      {/* العلامة تعود إلى الرئيسية */}
      <Link
        href={localePath(locale)}
        className="mb-8 inline-flex rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
        aria-label={siteName}
      >
        <Logo size="md" nameLang={locale === "ar" ? "ar" : "en"} />
      </Link>

      <div className="w-full">
        <TrackClient
          locale={locale}
          t={portal.track}
          siteNames={{ nameAr: settings.nameAr, nameEn: settings.nameEn }}
          token={token}
          cardParam={cardParam}
        />
      </div>

      <Toaster richColors position="top-center" dir={dir} />
    </div>
  );
}
