/**
 * POST /api/admin/pages/[id]/publish — نشر المسودة (صلاحية مستقلة).
 *
 * المنطق الكامل في publishPageCore (نواة مشتركة مع الجدولة) — هنا البوابة فقط:
 * الصلاحية، فك الطلب (اللغات)، ثم تفويض النواة وإعادة الشكل المتوقع للواجهة.
 *
 * قواعد السلامة (تعيش في النواة):
 * - النشر مرتبط بمراجعة مسودة محددة: baseRevision إلزامي؛ إذا تغيرت المسودة
 *   بعد بدء العملية يُرفض النشر (409) — لا يُنشر شيء مختلف عمّا وافق عليه الناشر.
 * - نشر مستقل لكل لغة: locales=["ar"] ينشر العربية فقط ولا يمس الإنجليزية المنشورة.
 * - الصفحات المؤرشفة لا تُنشر (409).
 */
import { type NextRequest } from "next/server";
import { guardApi, json } from "@/lib/auth/session";
import { publishPageCore } from "@/lib/pages/publish-core";
import { hasUnpublishedChanges } from "@/lib/page-settings";
import { db } from "@/lib/db";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardApi(req, "pages.publish");
  if (!guard.ok) return guard.response;
  const { id } = await params;

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  // اللغات المطلوب نشرها — الافتراضي اللغتان (توافقًا مع السلوك السابق)
  const rawLocales = Array.isArray(body.locales) ? body.locales : ["ar", "en"];
  const locales = rawLocales.filter((l): l is "ar" | "en" => l === "ar" || l === "en");
  if (locales.length === 0) return json({ ok: false, code: "invalid" }, 400);

  // ربط النشر بمراجعة محفوظة — يُفحص هنا قبل النواة حتى تعود الشيفرة 409 بمفاتيحها الدقيقة
  const page = await db.page.findUnique({ where: { id }, select: { draftRevision: true } });
  if (!page) return json({ ok: false, code: "not_found" }, 404);
  if (typeof body.baseRevision !== "number" || !Number.isInteger(body.baseRevision)) {
    return json({ ok: false, code: "revision_required" }, 409);
  }
  if (body.baseRevision !== page.draftRevision) {
    return json({ ok: false, code: "conflict", serverRevision: page.draftRevision }, 409);
  }

  const result = await publishPageCore({ pageId: id, locales, actor: guard.user, via: "manual" });
  if (!result.ok) {
    return json({ ok: false, code: result.code, ...(result.error ? { error: result.error } : {}), ...(result.serverRevision !== undefined ? { serverRevision: result.serverRevision } : {}) }, result.status);
  }

  const fresh = await db.page.findUnique({
    where: { id },
    select: {
      slug: true,
      status: true,
      draftRevision: true,
      publishedRevision: true,
      draftUpdatedAt: true,
      publishedAt: true,
      draftSettings: true,
      publishedSettings: true,
    },
  });
  return json({
    ok: true,
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
