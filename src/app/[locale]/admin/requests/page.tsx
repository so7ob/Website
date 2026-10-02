/**
 * صفحة الطلبات — غلاف خادم يتحقق من الصلاحية ويمرر هوية «me».
 * يقرأ معاملات الرابط (حالة/ردود متأخرة) لتهيئة التصفية — روابط اللوحة العميقة.
 */
import { locales, type Locale } from "@/lib/i18n";
import { requireMe } from "@/components/admin/guard";
import { REQUEST_STATUSES } from "@/lib/requests-service";
import { RequestsClient } from "@/components/admin/requests/requests-client";

export const dynamic = "force-dynamic";

export default async function AdminRequestsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string; overdue?: string }>;
}) {
  const { locale: raw } = await params;
  const locale = (locales.includes(raw as Locale) ? raw : "ar") as Locale;
  const { status, overdue } = await searchParams;
  const me = await requireMe(locale, "requests.view.all", `/${locale}/admin/requests`);

  // قيمة حالة صالحة فقط — وإلا تسقط التصفية إلى «الكل»
  const initialStatus = status && REQUEST_STATUSES.includes(status as never) ? status : undefined;

  return (
    <RequestsClient
      me={me}
      locale={locale}
      initialStatus={initialStatus}
      initialOverdue={overdue === "1"}
    />
  );
}
