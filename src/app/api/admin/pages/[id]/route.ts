/**
 * GET    /api/admin/pages/[id] — الصفحة بمسودتيها وإعداداتها.
 * PATCH  /api/admin/pages/[id] — حفظ المسودة (كتل + إعدادات) مع تحقق الخادم وكشف التعارض.
 * DELETE /api/admin/pages/[id] — أرشفة الصفحة (لا حذف فيزيائي).
 */
import { type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { guardApi, json } from "@/lib/auth/session";
import { validateBlocks, isValidSlug } from "@/lib/blocks/types";
import { audit, AUDIT_ACTIONS } from "@/lib/auth/audit";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardApi(req, "pages.view");
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const page = await db.page.findUnique({
    where: { id },
    include: {
      versions: {
        orderBy: { createdAt: "desc" },
        take: 30,
        select: { id: true, locale: true, version: true, authorId: true, note: true, createdAt: true, author: { select: { name: true } } },
      },
    },
  });
  if (!page) return json({ ok: false, code: "not_found" }, 404);

  return json({
    ok: true,
    page: {
      id: page.id,
      slug: page.slug,
      isHome: page.isHome,
      order: page.order,
      status: page.status,
      visibility: page.visibility,
      allowedRoles: safeParse(page.allowedRoles),
      titleAr: page.titleAr,
      titleEn: page.titleEn,
      seoTitleAr: page.seoTitleAr,
      seoTitleEn: page.seoTitleEn,
      seoDescAr: page.seoDescAr,
      seoDescEn: page.seoDescEn,
      draftBlocksAr: page.draftBlocksAr,
      draftBlocksEn: page.draftBlocksEn,
      publishedBlocksAr: page.publishedBlocksAr,
      publishedBlocksEn: page.publishedBlocksEn,
      draftUpdatedAt: page.draftUpdatedAt,
      draftUpdatedById: page.draftUpdatedById,
      publishedAt: page.publishedAt,
      sourceKey: page.sourceKey,
      editorTouchedAt: page.editorTouchedAt,
      versions: page.versions,
    },
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardApi(req, "pages.edit");
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const page = await db.page.findUnique({ where: { id } });
  if (!page) return json({ ok: false, code: "not_found" }, 404);

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ ok: false, code: "invalid" }, 400);
  }

  const updates: Record<string, unknown> = {};
  const touchesEditor = { set: new Date() };

  // كشف تعارض التحرير: المرسل يذكر نسخة المسودة التي بنى عليها تعديله
  if (typeof body.draftUpdatedAt === "string" && page.draftUpdatedAt) {
    const clientStamp = new Date(body.draftUpdatedAt).getTime();
    const serverStamp = page.draftUpdatedAt.getTime();
    if (Math.abs(clientStamp - serverStamp) > 1500) {
      return json({ ok: false, code: "conflict", serverDraftUpdatedAt: page.draftUpdatedAt }, 409);
    }
  }

  // المسودة — تحقق الخادم الإلزامي قبل الحفظ
  if (typeof body.draftBlocksAr === "string") {
    const check = validateBlocks(body.draftBlocksAr);
    if (!check.ok) return json({ ok: false, code: "invalid_blocks", error: check.error }, 400);
    updates.draftBlocksAr = body.draftBlocksAr;
  }
  if (typeof body.draftBlocksEn === "string") {
    const check = validateBlocks(body.draftBlocksEn);
    if (!check.ok) return json({ ok: false, code: "invalid_blocks", error: check.error }, 400);
    updates.draftBlocksEn = body.draftBlocksEn;
  }

  if (Object.keys(updates).length > 0) {
    updates.draftUpdatedAt = new Date();
    updates.draftUpdatedById = guard.user.id;
    updates.editorTouchedAt = touchesEditor.set;
  }

  // العنوان الإداري وSEO والإعدادات
  if (typeof body.titleAr === "string") updates.titleAr = body.titleAr.slice(0, 200);
  if (typeof body.titleEn === "string") updates.titleEn = body.titleEn.slice(0, 200);
  if (typeof body.seoTitleAr === "string") updates.seoTitleAr = body.seoTitleAr.slice(0, 300) || null;
  if (typeof body.seoTitleEn === "string") updates.seoTitleEn = body.seoTitleEn.slice(0, 300) || null;
  if (typeof body.seoDescAr === "string") updates.seoDescAr = body.seoDescAr.slice(0, 500) || null;
  if (typeof body.seoDescEn === "string") updates.seoDescEn = body.seoDescEn.slice(0, 500) || null;
  if (typeof body.order === "number") updates.order = Math.max(-1, Math.min(999, Math.trunc(body.order)));

  // الظهور والأدوار
  if (typeof body.visibility === "string" && ["public", "authenticated", "role"].includes(body.visibility)) {
    updates.visibility = body.visibility;
    if (body.visibility === "role" && Array.isArray(body.allowedRoles)) {
      const roles = body.allowedRoles.map(String).slice(0, 10);
      updates.allowedRoles = JSON.stringify(roles);
    }
  }

  // تغيير المسار — مع منع التعارض وإنشاء تحويل للرابط القديم
  if (typeof body.slug === "string" && body.slug !== page.slug) {
    const newSlug = body.slug.toLowerCase().trim();
    if (!isValidSlug(newSlug)) return json({ ok: false, code: "invalid_slug" }, 400);
    const taken = await db.page.findUnique({ where: { slug: newSlug } });
    if (taken) return json({ ok: false, code: "slug_taken" }, 409);
    // منع حلقات التحويل: الهدف لا يحول إلى مسار آخر
    const targetRedirect = await db.pageRedirect.findUnique({ where: { fromSlug: newSlug } });
    if (targetRedirect) return json({ ok: false, code: "redirect_loop" }, 409);

    updates.slug = newSlug;
    if (page.slug !== "" && page.status === "published") {
      await db.pageRedirect.create({ data: { fromSlug: page.slug, toSlug: newSlug } }).catch(() => {});
    }
  }

  // تحديد الرئيسية — واحدة فقط
  if (body.isHome === true && !page.isHome) {
    await db.page.updateMany({ where: { isHome: true }, data: { isHome: false } });
    updates.isHome = true;
    // الرئيسية تُخدم من المسار الفارغ
    updates.slug = "";
  }

  if (!Object.keys(updates).length) return json({ ok: false, code: "invalid" }, 400);

  const updated = await db.page.update({
    where: { id },
    data: updates,
    select: { id: true, slug: true, draftUpdatedAt: true, status: true },
  });

  if (body.draftBlocksAr !== undefined || body.draftBlocksEn !== undefined) {
    await audit({
      actorId: guard.user.id, actorEmail: guard.user.email, action: AUDIT_ACTIONS.pageDraftSaved,
      entityType: "page", entityId: id, details: { slug: updated.slug },
    });
  }

  return json({ ok: true, page: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardApi(req, "pages.delete");
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const page = await db.page.findUnique({ where: { id } });
  if (!page) return json({ ok: false, code: "not_found" }, 404);
  if (page.isHome) return json({ ok: false, code: "is_home" }, 409);

  await db.page.update({ where: { id }, data: { status: "archived" } });
  await audit({
    actorId: guard.user.id, actorEmail: guard.user.email, action: AUDIT_ACTIONS.pageArchived,
    entityType: "page", entityId: id, details: { slug: page.slug },
  });
  return json({ ok: true });
}

function safeParse(value: string): string[] {
  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
}
