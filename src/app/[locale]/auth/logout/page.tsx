import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPortalContent } from "@/content/portal";
import { locales, type Locale } from "@/lib/i18n";
import { LogoutAction } from "../_components/logout-action";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** صفحة وسيطة: تنهي الجلسة فورًا وتعود للموقع العام */
export default async function LogoutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!locales.includes(raw as Locale)) notFound();
  const locale = raw as Locale;
  const portal = getPortalContent(locale);

  return <LogoutAction locale={locale} label={portal.auth.logout} />;
}
