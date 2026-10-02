import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPortalContent } from "@/content/portal";
import { locales, type Locale } from "@/lib/i18n";
import { NotificationsView } from "@/components/account/notifications-view";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!locales.includes(locale as Locale)) return {};
  return { title: getPortalContent(locale as Locale).account.notifications.title };
}

export default async function NotificationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!locales.includes(raw as Locale)) notFound();
  const locale = raw as Locale;
  const portal = getPortalContent(locale);

  return (
    <NotificationsView
      locale={locale}
      t={portal.account.notifications}
      authErrors={portal.auth.errors}
      statuses={portal.account.requests.statuses}
    />
  );
}
