/**
 * صفحة تفاصيل الاستفسار — غلاف خادم يتحقق من الصلاحية ويمرر هوية «me».
 */
import { locales, type Locale } from "@/lib/i18n";
import { requireMe } from "@/components/admin/guard";
import { InquiryDetailClient } from "@/components/admin/inquiries/inquiry-detail-client";

export const dynamic = "force-dynamic";

export default async function AdminInquiryDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale: raw, id } = await params;
  const locale = (locales.includes(raw as Locale) ? raw : "ar") as Locale;
  const me = await requireMe(locale, "inquiries.view.all", `/${locale}/admin/inquiries/${id}`);

  return <InquiryDetailClient me={me} locale={locale} inquiryId={id} />;
}
