/**
 * صفحة إدارة المستخدمين — غلاف خادم يتحقق من الصلاحية ويمرر هوية «me».
 */
import { locales, type Locale } from "@/lib/i18n";
import { requireMe } from "@/components/admin/guard";
import { UsersClient } from "@/components/admin/users/users-client";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { locale: raw } = await params;
  const locale = (locales.includes(raw as Locale) ? raw : "ar") as Locale;
  const { q } = await searchParams;
  const me = await requireMe(locale, "users.view", `/${locale}/admin/users`);

  return <UsersClient me={me} locale={locale} initialQ={(q ?? "").slice(0, 100)} />;
}
