/**
 * صفحة الطلبات — غلاف خادم يتحقق من الصلاحية ويمرر هوية «me».
 */
import { locales, type Locale } from "@/lib/i18n";
import { requireMe } from "@/components/admin/guard";
import { RequestsClient } from "@/components/admin/requests/requests-client";

export const dynamic = "force-dynamic";

export default async function AdminRequestsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = (locales.includes(raw as Locale) ? raw : "ar") as Locale;
  const me = await requireMe(locale, "requests.view.all", `/${locale}/admin/requests`);

  return <RequestsClient me={me} locale={locale} />;
}
