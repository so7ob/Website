/**
 * صفحة إدارة المستخدمين — غلاف خادم يتحقق من الصلاحية ويمرر هوية «me».
 * يقرأ ?q= و ?status= لتهيئة البحث/التصفية (روابط اللوحة العميقة).
 */
import { locales, type Locale } from "@/lib/i18n";
import { requireMe } from "@/components/admin/guard";
import { UsersClient } from "@/components/admin/users/users-client";

export const dynamic = "force-dynamic";

/** حالات المستخدم الصالحة — نفس قيم واجهة /api/admin/users */
const USER_STATUS_FILTERS = ["active", "pending_verification", "suspended"];

export default async function AdminUsersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { locale: raw } = await params;
  const locale = (locales.includes(raw as Locale) ? raw : "ar") as Locale;
  const { q, status } = await searchParams;
  const me = await requireMe(locale, "users.view", `/${locale}/admin/users`);

  // قيمة حالة صالحة فقط — وإلا تسقط التصفية إلى «الكل»
  const initialStatus = status && USER_STATUS_FILTERS.includes(status) ? status : undefined;

  return (
    <UsersClient
      me={me}
      locale={locale}
      initialQ={(q ?? "").slice(0, 100)}
      initialStatus={initialStatus}
    />
  );
}
