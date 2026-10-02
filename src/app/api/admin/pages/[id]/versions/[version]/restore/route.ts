/**
 * POST /api/admin/pages/[id]/versions/[version]/restore — استعادة إصدار سابق إلى المسودة.
 *
 * قواعد السلامة:
 * - الاستعادة للغة المختارة فقط؛ استعادة اللغتين تتطلب explicit: locales=["ar","en"].
 * - الإصدار غير الموجود للغة المطلوبة → 404 (لا احتياط صامت بمحتوى آخر).
 * - قبل الكتابة تُحفظ لقطة تلقائية من المسودة الحالية (نسخة احتياطية قابلة للاستعادة).
 * - قفل مراجعة إلزامي: baseRevision يجب أن يطابق مسودة الصفحة الحالية (409 وإلا).
 * - الاستعادة إلى المسودة فقط — النشر قرار مستقل بصلاحيته.
 */
import { type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { guardApi, json } from "@/lib/auth/session";
import { validateContent } from "@/lib/blocks/validate";
import { audit, AUDIT_ACTIONS } from "@/lib/auth/audit";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; version: string }> }) {
  const guard = await guardApi(req, "pages.restore");
  if (!guard.ok) return guard.response;
  const { id, version: versionParam } = await params;
  const version = Number(versionParam);
  if (!Number.isInteger(version) || version < 1) return json({ ok: false, code: "invalid" }, 400);

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  // اللغة المطلوبة — الافتراضي: لغة واحدة فقط، واللغتان باختيار صريح
  const rawLocales = Array.isArray(body.locales) ? body.locales : [body.locale];
  const locales = rawLocales.filter((l): l is "ar" | "en" => l === "ar" || l === "en");
  if (locales.length === 0) return json({ ok: false, code: "locale_required" }, 400);

  const page = await db.page.findUnique({ where: { id } });
  if (!page) return json({ ok: false, code: "not_found" }, 404);
  if (page.status === "archived") return json({ ok: false, code: "archived" }, 409);

  // قفل المراجعة — الاستعادة فوق مسودة حية بدون علمها ممنوعة
  if (typeof body.baseRevision !== "number" || !Number.isInteger(body.baseRevision)) {
    return json({ ok: false, code: "revision_required" }, 409);
  }
  if (body.baseRevision !== page.draftRevision) {
    return json({ ok: false, code: "conflict", serverRevision: page.draftRevision }, 409);
  }

  // جلب إصدارات اللغات المطلوبة فقط
  const versions = await db.pageVersion.findMany({
    where: { pageId: id, locale: { in: locales }, version },
  });
  if (versions.length === 0) return json({ ok: false, code: "version_not_found" }, 404);

  const restored: Partial<Record<"ar" | "en", string>> = {};
  for (const locale of locales) {
    const source = versions.find((v) => v.locale === locale);
    if (!source) return json({ ok: false, code: "version_not_found", locale }, 404);
    // إصدارات قديمة بصيغة v0 تُرحّل تلقائيًا إلى الشجرة v1 عند الاستعادة
    const check = validateContent(source.blocks);
    if (!check.ok) return json({ ok: false, code: "invalid_blocks", error: check.error }, 400);
    restored[locale] = check.json;
  }

  // لقطة احتياطية للمسودة الحالية قبل الاستعادة (لكل لغة سيتم استعادتها)
  const backups = await db.pageVersion.findMany({
    where: { pageId: id, locale: { in: locales } },
    orderBy: { version: "desc" },
  });
  const lastBackupFor = (locale: "ar" | "en") => backups.find((v) => v.locale === locale);
  const currentDraftFor = (locale: "ar" | "en") => (locale === "ar" ? page.draftBlocksAr : page.draftBlocksEn);

  const now = new Date();
  const backupCreates = locales
    .filter((locale) => {
      const last = lastBackupFor(locale);
      return !last || last.blocks !== currentDraftFor(locale);
    })
    .map((locale) => {
      const last = lastBackupFor(locale);
      return db.pageVersion.create({
        data: {
          pageId: id,
          locale,
          version: (last?.version ?? 0) + 1,
          blocks: currentDraftFor(locale),
          authorId: guard.user.id,
          note: "auto-backup-before-restore",
        },
      });
    });

  await db.$transaction([
    ...backupCreates,
    db.page.update({
      where: { id },
      data: {
        ...("ar" in restored ? { draftBlocksAr: restored.ar } : {}),
        ...("en" in restored ? { draftBlocksEn: restored.en } : {}),
        draftUpdatedAt: now,
        draftUpdatedById: guard.user.id,
        editorTouchedAt: now,
        draftRevision: page.draftRevision + 1,
      },
    }),
  ]);

  await audit({
    actorId: guard.user.id, actorEmail: guard.user.email, action: AUDIT_ACTIONS.pageRestored,
    entityType: "page", entityId: id,
    details: { version, locales, slug: page.slug, backupCreated: backupCreates.length > 0 },
  });

  return json({
    ok: true,
    restoredVersion: version,
    locales,
    draftRevision: page.draftRevision + 1,
    draftUpdatedAt: now.toISOString(),
  });
}
