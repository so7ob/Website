/**
 * معاينة المسودة — صفحة خادم (صلاحية pages.view) تجلب الصفحة من قاعدة البيانات
 * وتحلل كتل المسودة للغة المطلوبة (?locale= الافتراضي لغة المسار) وتعرضها حية
 * داخل غلاف معاينة عميل بمبدل أجهزة. لا تحرير هنا — عرض فقط.
 */
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { locales, type Locale } from "@/lib/i18n";
import { validateBlocks, type Block } from "@/lib/blocks/types";
import { requireMe } from "@/components/admin/guard";
import type { PreviewDevice } from "@/components/admin/editor/editor-canvas";
import { PreviewShell } from "./preview-shell";

export const dynamic = "force-dynamic";

const DEVICES: PreviewDevice[] = ["desktop", "tablet", "mobile"];

export default async function AdminPagePreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ locale?: string; device?: string }>;
}) {
  const { locale: raw, id } = await params;
  const { locale: contentLocaleParam, device: deviceParam } = await searchParams;
  const locale = (locales.includes(raw as Locale) ? raw : "ar") as Locale;
  const contentLocale: Locale =
    contentLocaleParam === "en" || contentLocaleParam === "ar" ? contentLocaleParam : locale;
  const device: PreviewDevice = DEVICES.includes(deviceParam as PreviewDevice)
    ? (deviceParam as PreviewDevice)
    : "desktop";

  await requireMe(locale, "pages.view", `/${locale}/admin/pages/${id}/preview`);

  const page = await db.page.findUnique({ where: { id } });
  if (!page) notFound();

  const blocksJson = contentLocale === "ar" ? page.draftBlocksAr : page.draftBlocksEn;
  const check = validateBlocks(blocksJson);
  const blocks: Block[] = check.ok ? check.blocks : [];

  return (
    <PreviewShell
      pageId={id}
      blocks={blocks}
      locale={contentLocale}
      uiLocale={locale}
      initialDevice={device}
    />
  );
}
