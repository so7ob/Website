/**
 * صفحة القوائم — غلاف خادم يتحقق من الصلاحية ويمرر هوية «me».
 */
import { locales, type Locale } from "@/lib/i18n";
import { requireMe } from "@/components/admin/guard";
import { MenusClient } from "@/components/admin/menus/menus-client";

export const dynamic = "force-dynamic";

export default async function AdminMenusPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = (locales.includes(raw as Locale) ? raw : "ar") as Locale;
  const me = await requireMe(locale, "menus.manage", `/${locale}/admin/menus`);

  return <MenusClient me={me} locale={locale} />;
}
