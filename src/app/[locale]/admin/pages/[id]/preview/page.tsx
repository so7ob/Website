/**
 * معاينة مثبتة بالمصدر — صفحة خادم (صلاحية pages.view):
 * - بلا ?revision= → المسودة الحالية للغة المطلوبة (سلوك قائم)
 * - بـ ?revision=N → لقطة الإصدار المنشور N **للغة المحتوى المطلوبة** (خارطة الطريق 5.5 — G11)
 * جلب الصفحة من قاعدة البيانات وتحليل الكتل عبر بوابة التحقق نفسها (خطأ صريح لا صفحة فارغة)
 * وتعرضها حية داخل غلاف معاينة عميل بمبدل أجهزة. لا تحرير هنا — عرض فقط.
 */
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { locales, type Locale } from "@/lib/i18n";
import { loadContentForRender } from "@/lib/blocks/validate";
import { resolvePreviewSource } from "@/lib/pages/preview";
import { requireMe } from "@/components/admin/guard";
import type { PreviewDevice } from "@/components/admin/editor/editor-canvas";
import { PreviewShell, type PreviewBadge, type PreviewSourceError } from "./preview-shell";

export const dynamic = "force-dynamic";

const DEVICES: PreviewDevice[] = ["desktop", "tablet", "mobile"];

export default async function AdminPagePreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ locale?: string; device?: string; revision?: string }>;
}) {
  const { locale: raw, id } = await params;
  const { locale: contentLocaleParam, device: deviceParam, revision: revisionParam } = await searchParams;
  const locale = (locales.includes(raw as Locale) ? raw : "ar") as Locale;
  const contentLocale: Locale =
    contentLocaleParam === "en" || contentLocaleParam === "ar" ? contentLocaleParam : locale;
  const device: PreviewDevice = DEVICES.includes(deviceParam as PreviewDevice)
    ? (deviceParam as PreviewDevice)
    : "desktop";

  await requireMe(locale, "pages.view", `/${locale}/admin/pages/${id}/preview`);

  const page = await db.page.findUnique({ where: { id } });
  if (!page) notFound();

  // ربط المعاينة بمصدرها: مسودة حالية أو لقطة إصدار (لكل لغة) — الخطأ صريح لا صامت
  const source = await resolvePreviewSource(page, {
    pageId: id,
    locale: contentLocale,
    revisionParam,
    fetchVersion: async (pageId, blockLocale, version) => {
      const row = await db.pageVersion.findUnique({
        where: { pageId_locale_version: { pageId, locale: blockLocale, version } },
        include: { author: { select: { name: true } } },
      });
      if (!row) return null;
      return {
        version: row.version,
        blocks: row.blocks,
        note: row.note,
        authorName: row.author?.name ?? "—",
        createdAt: row.createdAt,
      };
    },
  });

  const common = {
    pageId: id,
    locale: contentLocale,
    uiLocale: locale,
    initialDevice: device,
  };

  if (source.kind === "invalid_revision" || source.kind === "version_not_found") {
    return (
      <PreviewShell nodes={[]} loadError={null} sourceError={source.kind} badge={{ kind: "draft" }} {...common} />
    );
  }

  // بوابة التحقق نفسها: ترحيل v0 → v1 + تطبيع — والخطأ صريح لا صفحة فارغة
  const content = loadContentForRender(source.blocksJson);

  if (source.kind === "draft") {
    return (
      <PreviewShell
        nodes={content.ok ? content.tree : []}
        loadError={content.ok ? null : content.error}
        sourceError={null}
        badge={{ kind: "draft" }}
        {...common}
      />
    );
  }

  const badge: PreviewBadge = {
    kind: "version",
    version: source.meta.version,
    meta: {
      note: source.meta.note,
      authorName: source.meta.authorName,
      createdAt: source.meta.createdAt.toISOString(),
    },
  };
  return (
    <PreviewShell
      nodes={content.ok ? content.tree : []}
      loadError={content.ok ? null : content.error}
      sourceError={null}
      badge={badge}
      {...common}
    />
  );
}
