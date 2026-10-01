/**
 * صفحة صندوق الصادر — غلاف خادم يتحقق من الصلاحية ويمرر هوية «me».
 */
import { locales, type Locale } from "@/lib/i18n";
import { requireMe } from "@/components/admin/guard";
import { OutboxClient } from "@/components/admin/outbox/outbox-client";

export const dynamic = "force-dynamic";

export default async function AdminOutboxPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = (locales.includes(raw as Locale) ? raw : "ar") as Locale;
  const me = await requireMe(locale, "email.outbox", `/${locale}/admin/outbox`);

  return <OutboxClient me={me} locale={locale} />;
}
