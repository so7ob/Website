/**
 * صفحة المحرر — غلاف خادم يتحقق من صلاحية التحرير (pages.edit) ويمرر
 * الهوية ومعرف الصفحة للمحرر العميل. القراءة بدون تحرير متاحة عبر مسار المعاينة.
 */
import { locales, type Locale } from "@/lib/i18n";
import { requireMe } from "@/components/admin/guard";
import { PageEditor } from "@/components/admin/editor/page-editor";

export const dynamic = "force-dynamic";

export default async function AdminPageEditorPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale: raw, id } = await params;
  const locale = (locales.includes(raw as Locale) ? raw : "ar") as Locale;
  const me = await requireMe(locale, "pages.edit", `/${locale}/admin/pages/${id}/edit`);

  return <PageEditor me={me} locale={locale} pageId={id} />;
}
