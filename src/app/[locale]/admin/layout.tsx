/**
 * تخطيط لوحة الإدارة (خادم): حارس الجلسة والصلاحية ثم هيكل الشريط الجانبي.
 * - لا جلسة → صفحة الدخول مع رابط العودة.
 * - لا صلاحية admin.dashboard (عملاء) → بوابة العميل.
 */
import { redirect } from "next/navigation";
import { locales, type Locale } from "@/lib/i18n";
import { getAuthUser, can } from "@/lib/auth/session";
import { getSettings } from "@/lib/site-data";
import { AdminShell } from "@/components/admin/admin-shell";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = (locales.includes(raw as Locale) ? raw : "ar") as Locale;

  const user = await getAuthUser();
  if (!user) {
    redirect(`/${locale}/auth/login?next=${encodeURIComponent(`/${locale}/admin`)}`);
  }
  if (!can(user, "admin.dashboard")) {
    redirect(`/${locale}/account`);
  }

  const settings = await getSettings();
  const siteName = locale === "en" ? settings.nameEn : settings.nameAr;

  return (
    <AdminShell
      locale={locale}
      siteName={siteName}
      me={{
        id: user.id,
        name: user.name,
        email: user.email,
        roleKey: user.roleKey,
        locale: user.locale,
        permissions: user.permissions,
      }}
    >
      {children}
    </AdminShell>
  );
}
