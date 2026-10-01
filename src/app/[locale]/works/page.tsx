import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WorksPage } from "@/components/pages/works-page";
import { ar } from "@/content/ar";
import { en } from "@/content/en";
import { locales, type Locale } from "@/lib/i18n";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!locales.includes(raw as Locale)) return {};
  const p = (raw === "en" ? en : ar).meta.pages.works;
  return {
    title: p.title,
    description: p.description,
    alternates: { canonical: `/${raw}/works`, languages: { ar: "/ar/works", en: "/en/works", "x-default": "/ar/works" } },
    openGraph: {
      title: p.title,
      description: p.description,
      url: `/${raw}/works`,
      images: [{ url: raw === "en" ? "/og-en.png" : "/og-ar.png", width: 1200, height: 630 }],
    },
  };
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!locales.includes(raw as Locale)) notFound();
  return <WorksPage locale={raw as Locale} content={raw === "en" ? en : ar} />;
}
