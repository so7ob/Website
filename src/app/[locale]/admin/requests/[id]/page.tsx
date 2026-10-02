/**
 * صفحة تفاصيل الطلب — غلاف خادم يتحقق من الصلاحية ويمرر هوية «me».
 */
import { locales, type Locale } from "@/lib/i18n";
import { requireMe } from "@/components/admin/guard";
import { RequestDetailClient } from "@/components/admin/requests/request-detail-client";

export const dynamic = "force-dynamic";

export default async function AdminRequestDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale: raw, id } = await params;
  const locale = (locales.includes(raw as Locale) ? raw : "ar") as Locale;
  const me = await requireMe(locale, "requests.view.all", `/${locale}/admin/requests/${id}`);

  return <RequestDetailClient me={me} locale={locale} requestId={id} />;
}
