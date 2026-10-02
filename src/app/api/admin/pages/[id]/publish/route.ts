/**
 * POST /api/admin/pages/[id]/publish — نشر المسودة (صلاحية مستقلة) + إصدار جديد + إعادة تحقق.
 */
import { type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { guardApi, json } from "@/lib/auth/session";
import { validateBlocks } from "@/lib/blocks/types";
import { audit, AUDIT_ACTIONS } from "@/lib/auth/audit";
import { revalidatePath } from "next/cache";
import { notifyMany } from "@/lib/auth/notifications";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardApi(req, "pages.publish");
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const page = await db.page.findUnique({ where: { id } });
  if (!page) return json({ ok: false, code: "not_found" }, 404);

  // تحقق الخادم قبل النشر — مصدر الحقيقة النهائي
  // يكفي امتلاء لغة واحدة؛ اللغة الفارغة تُنشر null فلا تظهر للزوار (404) —
  // «لا تُعرض ترجمة غير منشورة كأنها متاحة»
  let anyNonEmpty = false;
  const validated: { ar: string | null; en: string | null } = { ar: null, en: null };
  for (const [locale, blocks] of [
    ["ar", page.draftBlocksAr],
    ["en", page.draftBlocksEn],
  ] as const) {
    const check = validateBlocks(blocks);
    if (!check.ok) return json({ ok: false, code: "invalid_blocks", error: check.error }, 400);
    if (check.blocks.length > 0) {
      anyNonEmpty = true;
      validated[locale] = blocks;
    }
  }
  if (!anyNonEmpty) return json({ ok: false, code: "empty_page" }, 400);

  // آخر رقم إصدار لكل لغة
  const [maxAr, maxEn] = await Promise.all([
    db.pageVersion.aggregate({ where: { pageId: id, locale: "ar" }, _max: { version: true } }),
    db.pageVersion.aggregate({ where: { pageId: id, locale: "en" }, _max: { version: true } }),
  ]);

  const now = new Date();
  await db.$transaction([
    db.page.update({
      where: { id },
      data: {
        publishedBlocksAr: validated.ar,
        publishedBlocksEn: validated.en,
        publishedAt: now,
        publishedById: guard.user.id,
        status: "published",
      },
    }),
    db.pageVersion.create({
      data: { pageId: id, locale: "ar", version: (maxAr._max.version ?? 0) + 1, blocks: page.draftBlocksAr, authorId: guard.user.id },
    }),
    db.pageVersion.create({
      data: { pageId: id, locale: "en", version: (maxEn._max.version ?? 0) + 1, blocks: page.draftBlocksEn, authorId: guard.user.id },
    }),
  ]);

  // إعادة تحقق مسارات الصفحة باللغتين فورًا — النشر يظهر بلا إعادة بناء
  for (const locale of ["ar", "en"]) {
    revalidatePath(locale === "ar" ? (page.slug ? `/ar/${page.slug}` : "/ar") : page.slug ? `/en/${page.slug}` : "/en");
  }
  revalidatePath("/sitemap.xml");

  await audit({
    actorId: guard.user.id, actorEmail: guard.user.email, action: AUDIT_ACTIONS.pagePublished,
    entityType: "page", entityId: id, details: { slug: page.slug, versions: { ar: (maxAr._max.version ?? 0) + 1, en: (maxEn._max.version ?? 0) + 1 } },
  });

  // إشعار نشر المحتوى لمحرري المحتوى الآخرين
  const editors = await db.user.findMany({
    where: { status: "active", roleKey: { in: ["super_admin", "content_editor", "ops_manager"] } },
    select: { id: true },
  });
  await notifyMany(
    editors.filter((e) => e.id !== guard.user.id).map((e) => ({
      userId: e.id,
      type: "content_published" as const,
      payload: { slug: page.slug || "home", title: page.titleAr },
      link: "/ar/admin/pages",
    }))
  );

  return json({ ok: true, publishedAt: now });
}
