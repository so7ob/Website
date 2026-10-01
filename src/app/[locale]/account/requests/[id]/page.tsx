import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ar } from "@/content/ar";
import { en } from "@/content/en";
import { getPortalContent } from "@/content/portal";
import { locales, type Locale } from "@/lib/i18n";
import { RequestDetailView } from "@/components/account/request-detail-view";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!locales.includes(locale as Locale)) return {};
  const portal = getPortalContent(locale as Locale);
  return { title: portal.account.requests.title };
}

export default async function RequestDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale: raw, id } = await params;
  if (!locales.includes(raw as Locale)) notFound();
  const locale = raw as Locale;
  const content = locale === "en" ? en : ar;
  const portal = getPortalContent(locale);

  return (
    <RequestDetailView
      locale={locale}
      id={id}
      t={portal.account.requests}
      d={portal.account.detail}
      content={content}
      authErrors={portal.auth.errors}
      priorities={portal.admin.requests.priorities}
    />
  );
}
