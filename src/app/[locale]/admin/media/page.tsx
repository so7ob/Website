/**
 * صفحة الوسائط — غلاف خادم يتحقق من الصلاحية ويمرر هوية «me».
 */
import { locales, type Locale } from "@/lib/i18n";
import { requireMe } from "@/components/admin/guard";
import { MediaClient } from "@/components/admin/media/media-client";

export const dynamic = "force-dynamic";

export default async function AdminMediaPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = (locales.includes(raw as Locale) ? raw : "ar") as Locale;
  const me = await requireMe(locale, "media.manage", `/${locale}/admin/media`);

  return <MediaClient me={me} locale={locale} />;
}
