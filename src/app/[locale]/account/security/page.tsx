import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPortalContent } from "@/content/portal";
import { locales, type Locale } from "@/lib/i18n";
import { SecurityView } from "@/components/account/security-view";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!locales.includes(locale as Locale)) return {};
  return { title: getPortalContent(locale as Locale).account.security.title };
}

export default async function SecurityPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!locales.includes(raw as Locale)) notFound();
  const locale = raw as Locale;
  const portal = getPortalContent(locale);

  return (
    <SecurityView
      locale={locale}
      t={portal.account.security}
      authErrors={portal.auth.errors}
      authLabels={{
        currentPassword: portal.auth.currentPassword,
        newPassword: portal.auth.newPassword,
        confirmPassword: portal.auth.confirmPassword,
      }}
    />
  );
}
