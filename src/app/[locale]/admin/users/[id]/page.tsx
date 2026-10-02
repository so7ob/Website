/**
 * صفحة ملف المستخدم (إدارة) — غلاف خادم يتحقق من صلاحية عرض المستخدمين.
 */
import { locales, type Locale } from "@/lib/i18n";
import { requireMe } from "@/components/admin/guard";
import { UserDetailClient } from "@/components/admin/users/user-detail-client";

export const dynamic = "force-dynamic";

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale: raw, id } = await params;
  const locale = (locales.includes(raw as Locale) ? raw : "ar") as Locale;
  await requireMe(locale, "users.view", `/${locale}/admin/users/${id}`);

  return <UserDetailClient locale={locale} userId={id.slice(0, 64)} />;
}
