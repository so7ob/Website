import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Hero } from "@/components/home/hero";
import { HomeServices } from "@/components/home/home-services";
import { HomeWhy } from "@/components/home/home-why";
import { HomeWorks } from "@/components/home/home-works";
import { HomeProcess } from "@/components/home/home-process";
import { HomeFaq } from "@/components/home/home-faq";
import { FinalCta } from "@/components/home/final-cta";
import { ar } from "@/content/ar";
import { en } from "@/content/en";
import { locales, type Locale } from "@/lib/i18n";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!locales.includes(raw as Locale)) return {};
  const content = raw === "en" ? en : ar;
  const p = content.meta.pages.home;
  return {
    title: p.title,
    description: p.description,
    alternates: {
      canonical: `/${raw}`,
      languages: { ar: "/ar", en: "/en", "x-default": "/ar" },
    },
    openGraph: {
      title: p.title,
      description: p.description,
      url: `/${raw}`,
      locale: raw === "en" ? "en_US" : "ar_SA",
      alternateLocale: [raw === "en" ? "ar_SA" : "en_US"],
      images: [{ url: raw === "en" ? "/og-en.png" : "/og-ar.png", width: 1200, height: 630, alt: content.meta.siteName }],
    },
  };
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!locales.includes(raw as Locale)) notFound();
  const locale = raw as Locale;
  const content = locale === "en" ? en : ar;

  return (
    <>
      <Hero locale={locale} content={content} />
      <HomeServices locale={locale} content={content} />
      <HomeWhy content={content} />
      <HomeWorks locale={locale} content={content} />
      <HomeProcess content={content} />
      <HomeFaq locale={locale} content={content} />
      <FinalCta locale={locale} content={content} />
    </>
  );
}
