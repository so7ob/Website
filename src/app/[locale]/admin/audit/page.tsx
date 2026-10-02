/**
 * صفحة سجل التدقيق — غلاف خادم يتحقق من الصلاحية ويمرر هوية «me».
 */
import { locales, type Locale } from "@/lib/i18n";
import { requireMe } from "@/components/admin/guard";
import { AuditClient } from "@/components/admin/audit/audit-client";

export const dynamic = "force-dynamic";

export default async function AdminAuditPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = (locales.includes(raw as Locale) ? raw : "ar") as Locale;
  const me = await requireMe(locale, "audit.view", `/${locale}/admin/audit`);

  return <AuditClient me={me} locale={locale} />;
}
