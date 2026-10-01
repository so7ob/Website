import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FaqPage } from "@/components/pages/faq-page";
import { ar } from "@/content/ar";
import { en } from "@/content/en";
import { locales, type Locale } from "@/lib/i18n";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!locales.includes(raw as Locale)) return {};
  const p = (raw === "en" ? en : ar).meta.pages.faq;
  return {
    title: p.title,
    description: p.description,
    alternates: { canonical: `/${raw}/faq`, languages: { ar: "/ar/faq", en: "/en/faq", "x-default": "/ar/faq" } },
    openGraph: {
      title: p.title,
      description: p.description,
      url: `/${raw}/faq`,
      images: [{ url: raw === "en" ? "/og-en.png" : "/og-ar.png", width: 1200, height: 630 }],
    },
  };
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!locales.includes(raw as Locale)) notFound();
  return <FaqPage locale={raw as Locale} content={raw === "en" ? en : ar} />;
}
