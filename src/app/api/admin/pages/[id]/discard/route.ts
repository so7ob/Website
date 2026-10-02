/**
 * POST /api/admin/pages/[id]/discard — استبعاد التعديلات غير المنشورة (§2).
 *
 * يعيد المسودة (المحتوى والإعدادات العامة) إلى آخر نسخة منشورة — يغلق ثغرة
 * «نُشرت صفحة بمحتوى اختباري» إذ يملك المحرر زرًا صريحًا لرمي التجارب بدل
 * نشرها خطأً أو إصلاحها يدويًا.
 *
 * قواعد السلامة:
 * - صفحة منشورة فعلًا فقط (publishedRevision محفوظ) وإلا 409 not_discardable.
 * - baseRevision إلزامي وتحديث ذري عبر updateMany — تعارض يرجع 409.
 * - الصفحات المؤرشفة لا تُستبعد.
 * - الإعدادات المنشورة تعود مصدرًا للمسودة (لكن لا تُمس الأعمدة الحية نفسها
 *   لأنها ليست جزءًا من المسودة) — التدقيق يوثق الفعل.
 */
import { type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { guardApi, json } from "@/lib/auth/session";
import { audit, AUDIT_ACTIONS } from "@/lib/auth/audit";
import { hasUnpublishedChanges } from "@/lib/page-settings";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardApi(req, "pages.edit");
  if (!guard.ok) return guard.response;
  const { id } = await params;

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const page = await db.page.findUnique({ where: { id } });
  if (!page) return json({ ok: false, code: "not_found" }, 404);
  if (page.status === "archived") return json({ ok: false, code: "archived" }, 409);
  // لم تُنشر أبدًا ضمن نظام المراجعات؟ (لغة واحدة فارغة عند النشر تخزن null — حالة منشورة سليمة)
  if (page.publishedRevision === null || page.publishedAt === null) {
    return json({ ok: false, code: "not_discardable" }, 409);
  }
  if (!hasUnpublishedChanges(page)) {
    // لا تعديلات غير منشورة — لا شيء يُستبعد (وليست حالة خطأ صامتة)
    return json({ ok: false, code: "nothing_to_discard" }, 409);
  }

  if (typeof body.baseRevision !== "number" || !Number.isInteger(body.baseRevision)) {
    return json({ ok: false, code: "revision_required" }, 409);
  }

  const now = new Date();
  // تحديث ذري بقفل المراجعة — لا استبعاد فوق مسودة تغيرت منذ العرض.
  // المراجعة تعود إلى publishedRevision (لا تزداد): المسودة أصبحت مطابقة
  // للمنشور حرفيًا، فمؤشر «تعديلات غير منشورة» يطفأ، وأي حفظ لاحق يبدأ
  // من هذه المراجعة متسلسلًا للأمام كالمعتاد.
  const updated = await db.page.updateMany({
    where: { id, draftRevision: body.baseRevision },
    data: {
      // لغة لم تُنشر محتواها تخزن null في المنشور — تعود مسودة فارغة [] لا null
      draftBlocksAr: page.publishedBlocksAr ?? "[]",
      draftBlocksEn: page.publishedBlocksEn ?? "[]",
      draftSettings: page.publishedSettings ?? page.draftSettings,
      draftRevision: page.publishedRevision,
      draftUpdatedAt: now,
      draftUpdatedById: guard.user.id,
      editorTouchedAt: now,
    },
  });
  if (updated.count === 0) {
    const fresh = await db.page.findUnique({ where: { id }, select: { draftRevision: true } });
    return json({ ok: false, code: "conflict", serverRevision: fresh?.draftRevision }, 409);
  }

  await audit({
    actorId: guard.user.id, actorEmail: guard.user.email, action: AUDIT_ACTIONS.pageDraftDiscarded,
    entityType: "page", entityId: id,
    details: { slug: page.slug, revertedFromRevision: body.baseRevision, revertedToRevision: page.publishedRevision },
  });

  const fresh = await db.page.findUnique({
    where: { id },
    select: {
      slug: true, status: true, draftRevision: true, publishedRevision: true,
      draftUpdatedAt: true, publishedAt: true, draftSettings: true, publishedSettings: true,
    },
  });

  return json({
    ok: true,
    page: {
      slug: fresh?.slug ?? page.slug,
      draftRevision: fresh?.draftRevision ?? page.publishedRevision,
      publishedRevision: page.publishedRevision,
      hasUnpublishedChanges: fresh ? hasUnpublishedChanges(fresh) : false,
      draftUpdatedAt: (fresh?.draftUpdatedAt ?? now).toISOString(),
    },
  });
}
