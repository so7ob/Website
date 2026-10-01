import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPortalContent } from "@/content/portal";
import { locales, type Locale } from "@/lib/i18n";
import { LoginForm } from "../_components/login-form";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!locales.includes(locale as Locale)) return {};
  return { title: getPortalContent(locale as Locale).auth.loginTitle };
}

/** صفحة تسجيل الدخول — تقرأ ?next= لتوجيه العودة بعد الدخول */
export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale: raw } = await params;
  if (!locales.includes(raw as Locale)) notFound();
  const locale = raw as Locale;
  const portal = getPortalContent(locale);

  const nextParam = await searchParams;
  const next = Array.isArray(nextParam.next) ? nextParam.next[0] : nextParam.next;

  return <LoginForm locale={locale} t={portal.auth} next={next} />;
}
