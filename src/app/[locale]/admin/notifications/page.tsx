/**
 * صفحة إشعارات الفريق — غلاف خادم يتحقق من الدخول ويمرر هوية «me».
 * الإشعارات بيانات خاصة بكل مستخدم (نفس واجهة بوابة العميل) — لا صلاحية إضافية.
 */
import { locales, type Locale } from "@/lib/i18n";
import { requireMe } from "@/components/admin/guard";
import { NotificationsClient } from "@/components/admin/notifications/notifications-client";

export const dynamic = "force-dynamic";

export default async function AdminNotificationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = (locales.includes(raw as Locale) ? raw : "ar") as Locale;
  const me = await requireMe(locale, "admin.dashboard", `/${locale}/admin/notifications`);

  return <NotificationsClient me={me} locale={locale} />;
}
