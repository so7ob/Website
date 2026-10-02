/**
 * صفحة الاستفسارات — غلاف خادم يتحقق من الصلاحية ويمرر هوية «me».
 * يقرأ ?status= لتهيئة تصفية الحالة (رابط عميق من اللوحة).
 */
import { locales, type Locale } from "@/lib/i18n";
import { requireMe } from "@/components/admin/guard";
import { InquiriesClient } from "@/components/admin/inquiries/inquiries-client";

export const dynamic = "force-dynamic";

/** الحالات الصالحة للاستفسارات — نفس مجموعة واجهة /api/admin/inquiries (+«open» المركّبة) */
const INQUIRY_STATUS_FILTERS = ["open", "new", "in_review", "awaiting_info", "responded", "closed"];

export default async function AdminInquiriesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { locale: raw } = await params;
  const locale = (locales.includes(raw as Locale) ? raw : "ar") as Locale;
  const { status } = await searchParams;
  const me = await requireMe(locale, "inquiries.view.all", `/${locale}/admin/inquiries`);

  // قيمة حالة صالحة فقط — وإلا تسقط التصفية إلى «الكل»
  // («open» مرشّح مركّب: الحالات غير المغلقة وغير المؤرشفة — يطابق مؤشر اللوحة)
  const initialStatus = status && INQUIRY_STATUS_FILTERS.includes(status) ? status : undefined;

  return <InquiriesClient me={me} locale={locale} initialStatus={initialStatus} />;
}
