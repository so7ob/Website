/**
 * POST /api/admin/templates/[id]/apply — تطبيق قالب على مسودة صفحة (§5).
 *
 * قواعد السلامة (مرآة مسار استعادة الإصدارات):
 * - التطبيق للغة المسودة المطلوبة فقط (ar|en) — اللغة الأخرى لا تُمس.
 * - القالب بلا محتوى لهذه اللغة → 400 template_locale_missing (لا احتياط صامت بمحتوى لغة أخرى).
 * - قبل الكتابة تُحفظ لقطة تلقائية من المسودة الحالية (نسخة احتياطية قابلة للاستعادة).
 * - قفل مراجعة إلزامي: baseRevision يجب أن يطابق مسودة الصفحة الحالية (409 وإلا).
 * - تحقق الخادم الإلزامي: يُخزن ناتج validateContent المطبّع لا محتوى القالب الخام.
 * - التطبيق للمسودة فقط — النشر قرار مستقل بصلاحيته.
 * - عداد الاستخدام يُزاد والتطبيق يُدوَّن في AuditLog.
 */
import { type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { guardApi, json } from "@/lib/auth/session";
import { validateContent } from "@/lib/blocks/validate";
import { audit, AUDIT_ACTIONS } from "@/lib/auth/audit";
import { resolveTemplateBlocks } from "@/lib/templates/service";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardApi(req, "pages.edit");
  if (!guard.ok) return guard.response;
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ ok: false, code: "invalid" }, 400);
  }

  const locale = body.locale === "en" ? "en" : body.locale === "ar" ? "ar" : null;
  if (!locale) return json({ ok: false, code: "locale_required" }, 400);

  const page = await db.page.findUnique({ where: { id: body.pageId as string ?? "" } });
  if (!page) return json({ ok: false, code: "page_not_found" }, 404);
  if (page.status === "archived") return json({ ok: false, code: "archived" }, 409);

  // قفل المراجعة — التطبيق فوق مسودة حية دون علمها ممنوع
  if (typeof body.baseRevision !== "number" || !Number.isInteger(body.baseRevision)) {
    return json({ ok: false, code: "revision_required" }, 409);
  }
  if (body.baseRevision !== page.draftRevision) {
    return json({ ok: false, code: "conflict", serverRevision: page.draftRevision }, 409);
  }

  const template = await db.pageTemplate.findUnique({ where: { id } });
  if (!template) return json({ ok: false, code: "not_found" }, 404);

  const resolved = resolveTemplateBlocks(template, locale);
  if (!resolved.ok) return json({ ok: false, code: "template_locale_missing", locale }, 400);

  // يُخزن ناتج التحقق المطبّع — محتوى القالب نفسه يمر ببوابة الشجرة
  const check = validateContent(resolved.blocks);
  if (!check.ok) return json({ ok: false, code: "invalid_blocks", error: check.error }, 400);
  const appliedBlocks = check.json;

  // لقطة احتياطية للمسودة الحالية قبل التطبيق (نفس نمط الاستعادة)
  const currentDraft = locale === "ar" ? page.draftBlocksAr : page.draftBlocksEn;
  const lastBackup = await db.pageVersion.findFirst({
    where: { pageId: page.id, locale },
    orderBy: { version: "desc" },
  });

  const now = new Date();
  const nextRevision = page.draftRevision + 1;

  // التحديث الذري: يفشل إذا سبقنا إلى المراجعة نفسها
  const result = await db.page.updateMany({
    where: { id: page.id, draftRevision: page.draftRevision },
    data: {
      ...(locale === "ar" ? { draftBlocksAr: appliedBlocks } : { draftBlocksEn: appliedBlocks }),
      draftUpdatedAt: now,
      draftUpdatedById: guard.user.id,
      editorTouchedAt: now,
      draftRevision: nextRevision,
    },
  });
  if (result.count === 0) {
    return json({ ok: false, code: "conflict", serverRevision: page.draftRevision }, 409);
  }

  await db.$transaction([
    // اللقطة تُنشأ فقط إذا تغيرت المسودة عن آخر نسخة محفوظة (نفس شرط الاستعادة)
    ...(lastBackup?.blocks !== currentDraft
      ? [
          db.pageVersion.create({
            data: {
              pageId: page.id,
              locale,
              version: (lastBackup?.version ?? 0) + 1,
              blocks: currentDraft,
              authorId: guard.user.id,
              note: "auto-backup-before-template",
            },
          }),
        ]
      : []),
    db.pageTemplate.update({ where: { id: template.id }, data: { usageCount: { increment: 1 } } }),
  ]);

  await audit({
    actorId: guard.user.id,
    actorEmail: guard.user.email,
    action: AUDIT_ACTIONS.templateApplied,
    entityType: "page_template",
    entityId: template.id,
    details: { pageId: page.id, slug: page.slug, locale, templateKey: template.key, templateNameAr: template.nameAr },
  });

  return json({
    ok: true,
    page: {
      id: page.id,
      draftRevision: nextRevision,
      draftUpdatedAt: now.toISOString(),
      [locale === "ar" ? "draftBlocksAr" : "draftBlocksEn"]: appliedBlocks,
      backupCreated: lastBackup?.blocks !== currentDraft,
    },
  });
}
