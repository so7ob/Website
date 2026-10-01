/**
 * صفحة إدارة المحتوى — غلاف خادم يتحقق من صلاحية عرض الصفحات ويمرر «me».
 */
import { locales, type Locale } from "@/lib/i18n";
import { requireMe } from "@/components/admin/guard";
import { PagesClient } from "./pages-client";

export const dynamic = "force-dynamic";

export default async function AdminPagesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = (locales.includes(raw as Locale) ? raw : "ar") as Locale;
  const me = await requireMe(locale, "pages.view", `/${locale}/admin/pages`);

  return <PagesClient me={me} locale={locale} />;
}
