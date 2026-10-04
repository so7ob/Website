/**
 * POST /api/admin/pages/[id]/review — قرار المراجعة: موافقة (نشر) أو رفض (عودة لمسودة).
 *
 * الطور 2 (G5) — إغلاق دورة in_review:
 * - الموافقة (pages.publish): تفويض publishPageCore (نفس نواة النشر: تحقق، معاملة ذرية،
 *   إصدارات، تحويلات، تدقيق page.published، إشعارات نشر) — مع ملاحظة المراجعة كنص إصدار،
 *   ثم تدقيق page.review_approved وإشعار صاحب المسودة بالقرار.
 * - الرفض (pages.publish): المسودة تعود "draft" دون لمس المحتوى — ما رُفض هو "كما هو الآن"
 *   لا "يمحوه"، ويتيسر للمحرر تعديله وإعادة الإرسال. تدقيق page.review_rejected + إشعار.
 *
 * قواعد السلامة:
 * - القرار من حالة in_review فقط (409 not_in_review غير ذلك).
 * - الربط بمراجعة محفوظة: baseRevision إلزامي ومطابق — لا قرار على محتوى تغيّر بعد الإرسال.
 * - ملاحظة المراجعة اختيارية، تُقصّ إلى 500 محرف، وتظهر في التدقيق والإشعار ونص الإصدار.
 */
import { type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { guardApi, json } from "@/lib/auth/session";
import { publishPageCore } from "@/lib/pages/publish-core";
import { audit, AUDIT_ACTIONS } from "@/lib/auth/audit";
import { notify } from "@/lib/auth/notifications";
import { canReviewDecision, normalizeReviewNote, type ReviewDecision } from "@/lib/pages/review";
import { hasUnpublishedChanges } from "@/lib/page-settings";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardApi(req, "pages.publish");
  if (!guard.ok) return guard.response;
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ ok: false, code: "invalid" }, 400);
  }

  const decision = body.decision as ReviewDecision | undefined;
  if (decision !== "approve" && decision !== "reject") {
    return json({ ok: false, code: "invalid_decision" }, 400);
  }

  let note: string | null;
  try {
    note = normalizeReviewNote(body.note);
  } catch {
    return json({ ok: false, code: "invalid" }, 400);
  }

  const page = await db.page.findUnique({ where: { id } });
  if (!page) return json({ ok: false, code: "not_found" }, 404);
  if (!canReviewDecision(page.status)) {
    return json({ ok: false, code: "not_in_review" }, 409);
  }
  if (typeof body.baseRevision !== "number" || !Number.isInteger(body.baseRevision)) {
    return json({ ok: false, code: "revision_required" }, 409);
  }
  if (body.baseRevision !== page.draftRevision) {
    return json({ ok: false, code: "conflict", serverRevision: page.draftRevision }, 409);
  }

  const pageTitle = page.titleAr || page.titleEn || page.slug || "home";
  // مستلم إشعار القرار: آخر من حرّر المسودة (المرسل غالبًا) — إن غاب فلا مستلم موجّه
  const recipientId = page.draftUpdatedById;

  if (decision === "approve") {
    // اللغات: الافتراضي اللغتان (اتساقًا مع النشر اليدوي)
    const rawLocales = Array.isArray(body.locales) ? body.locales : ["ar", "en"];
    const locales = rawLocales.filter((l): l is "ar" | "en" => l === "ar" || l === "en");
    if (locales.length === 0) return json({ ok: false, code: "invalid" }, 400);

    const result = await publishPageCore({ pageId: id, locales, actor: guard.user, via: "manual", versionNote: note });
    if (!result.ok) {
      return json(
        {
          ok: false,
          code: result.code,
          ...(result.error ? { error: result.error } : {}),
          ...(result.serverRevision !== undefined ? { serverRevision: result.serverRevision } : {}),
        },
        result.status
      );
    }
    await audit({
      actorId: guard.user.id, actorEmail: guard.user.email, action: AUDIT_ACTIONS.pageReviewApproved,
      entityType: "page", entityId: id,
      details: { slug: page.slug, revision: page.draftRevision, locales, ...(note ? { note } : {}) },
    });
    if (recipientId && recipientId !== guard.user.id) {
      await notify({
        userId: recipientId,
        type: "status_changed",
        payload: { pageTitle, slug: page.slug || "home", decision: "approved", ...(note ? { note } : {}) },
        link: `/${guard.user.locale === "en" ? "en" : "ar"}/admin/pages/${id}/edit`,
      });
    }
    const fresh = await db.page.findUnique({
      where: { id },
      select: {
        slug: true, status: true, draftRevision: true, publishedRevision: true,
        draftUpdatedAt: true, publishedAt: true, draftSettings: true, publishedSettings: true,
      },
    });
    return json({
      ok: true,
      decision: "approved",
      publishedAt: result.publishedAt,
      page: {
        slug: fresh?.slug ?? result.slug,
        status: fresh?.status ?? "published",
        draftRevision: fresh?.draftRevision ?? result.revision,
        publishedRevision: fresh?.publishedRevision ?? result.revision,
        hasUnpublishedChanges: fresh ? hasUnpublishedChanges(fresh) : false,
      },
    });
  }

  // ——— الرفض: المسودة تعود draft دون لمس المحتوى — المحرر يعدل ويعيد الإرسال ———
  const updated = await db.page.updateMany({
    where: { id, draftRevision: page.draftRevision, status: "in_review" },
    data: { status: "draft" },
  });
  if (updated.count === 0) {
    // تغيرت الحالة أو المسودة لحظة القرار — دفاع ذري مطابق لفلسفة القفل
    return json({ ok: false, code: "conflict", serverRevision: page.draftRevision }, 409);
  }
  await audit({
    actorId: guard.user.id, actorEmail: guard.user.email, action: AUDIT_ACTIONS.pageReviewRejected,
    entityType: "page", entityId: id,
    details: { slug: page.slug, revision: page.draftRevision, ...(note ? { note } : {}) },
  });
  if (recipientId && recipientId !== guard.user.id) {
    await notify({
      userId: recipientId,
      type: "status_changed",
      payload: { pageTitle, slug: page.slug || "home", decision: "rejected", ...(note ? { note } : {}) },
      link: `/${guard.user.locale === "en" ? "en" : "ar"}/admin/pages/${id}/edit`,
    });
  }
  return json({
    ok: true,
    decision: "rejected",
    page: { slug: page.slug, status: "draft", draftRevision: page.draftRevision, hasUnpublishedChanges: hasUnpublishedChanges(page) },
  });
}
