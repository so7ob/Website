/**
 * صفحة الإعدادات — غلاف خادم يتحقق من الصلاحية ويمرر هوية «me».
 */
import { locales, type Locale } from "@/lib/i18n";
import { requireMe } from "@/components/admin/guard";
import { SettingsClient } from "@/components/admin/settings/settings-client";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = (locales.includes(raw as Locale) ? raw : "ar") as Locale;
  const me = await requireMe(locale, "settings.manage", `/${locale}/admin/settings`);

  return <SettingsClient me={me} locale={locale} />;
}
