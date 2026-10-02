import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ar } from "@/content/ar";
import { en } from "@/content/en";
import { getPortalContent } from "@/content/portal";
import { locales, type Locale } from "@/lib/i18n";
import { NewRequestView } from "@/components/account/new-request-view";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!locales.includes(locale as Locale)) return {};
  return { title: getPortalContent(locale as Locale).account.nav.newRequest };
}

export default async function NewRequestPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!locales.includes(raw as Locale)) notFound();
  const locale = raw as Locale;
  const content = locale === "en" ? en : ar;
  const portal = getPortalContent(locale);

  return (
    <NewRequestView
      locale={locale}
      content={content}
      t={portal.account.requests}
      heading={portal.account.nav.newRequest}
    />
  );
}
