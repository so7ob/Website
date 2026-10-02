import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPortalContent } from "@/content/portal";
import { locales, type Locale } from "@/lib/i18n";
import { ForgotForm } from "../_components/forgot-form";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!locales.includes(locale as Locale)) return {};
  return { title: getPortalContent(locale as Locale).auth.forgotTitle };
}

export default async function ForgotPasswordPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!locales.includes(raw as Locale)) notFound();
  const locale = raw as Locale;
  const portal = getPortalContent(locale);

  return <ForgotForm locale={locale} t={portal.auth} />;
}
