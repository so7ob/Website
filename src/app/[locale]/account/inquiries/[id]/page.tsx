import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPortalContent } from "@/content/portal";
import { ar } from "@/content/ar";
import { en } from "@/content/en";
import { locales, type Locale } from "@/lib/i18n";
import { InquiryDetailView } from "@/components/account/inquiry-detail-view";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!locales.includes(locale as Locale)) return {};
  return { title: getPortalContent(locale as Locale).account.inquiries.title };
}

export default async function InquiryDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale: raw, id } = await params;
  if (!locales.includes(raw as Locale)) notFound();
  const locale = raw as Locale;
  const portal = getPortalContent(locale);

  return (
    <InquiryDetailView
      locale={locale}
      id={id}
      t={portal.account.inquiries}
      authErrors={portal.auth.errors}
      siteName={(locale === "en" ? en : ar).meta.siteName}
    />
  );
}
