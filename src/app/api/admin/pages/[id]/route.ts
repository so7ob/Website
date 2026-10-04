/**
 * GET    /api/admin/pages/[id] — الصفحة بمسودتيها وإعداداتها ومراجعاتها.
 * PATCH  /api/admin/pages/[id] — حفظ المسودة (كتل + إعدادات عامة) بقفل مراجعة ذري.
 * DELETE /api/admin/pages/[id] — أرشفة الصفحة (لا حذف فيزيائي).
 *
 * قواعد السلامة:
 * - كل ما يؤثر في ما يراه الزوار (الكتل + الرابط/الظهور/الأدوار/العنوان الظاهر/SEO/الترتيب)
 *   يُحفظ في أعمدة المسودة فقط، ولا يصل للزوار إلا عبر النشر (pages.publish).
 * - العنوان الإداري (titleAr/titleEn) داخلي غير علني — يُحدّث مباشرة.
 * - الحفظ ذري بمراجعة رقمية: baseRevision إلزامي لأي تعديل مسودة؛
 *   عدم التطابق → 409 دون الكتابة فوق تعديل آخر.
 * - تعيين الرئيسية عملية ذرية واحدة: لا تصطدم بالرابط الفارغ ولا تترك الموقع بلا رئيسية.
 */
import { type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { guardApi, json } from "@/lib/auth/session";
import { validateContent } from "@/lib/blocks/validate";
import { isValidSlug } from "@/lib/blocks/types";
import { audit, AUDIT_ACTIONS } from "@/lib/auth/audit";
import { notifyMany, publishersToNotify } from "@/lib/auth/notifications";
import { parsePageSettings, serializePageSettings, settingsFromInput, hasUnpublishedChanges, type PageSettings } from "@/lib/page-settings";
import { canSubmitForReview, normalizeReviewNote } from "@/lib/pages/review";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardApi(req, "pages.view");
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const page = await db.page.findUnique({
    where: { id },
    include: {
      versions: {
        orderBy: { createdAt: "desc" },
        take: 60,
        select: { id: true, locale: true, version: true, authorId: true, note: true, createdAt: true, author: { select: { name: true } } },
      },
    },
  });
  if (!page) return json({ ok: false, code: "not_found" }, 404);

  // اسم آخر محرر (علاقة غير معرفة في المخطط — استعلام مستقل)
  const draftUpdater = page.draftUpdatedById
    ? await db.user.findUnique({ where: { id: page.draftUpdatedById }, select: { name: true } })
    : null;

  const draftSettings = parsePageSettings(page.draftSettings, page, { ar: page.titleAr, en: page.titleEn });
  const publishedSettings = page.publishedSettings
    ? parsePageSettings(page.publishedSettings, page, { ar: page.titleAr, en: page.titleEn })
    : null;

  return json({
    ok: true,
    page: {
      id: page.id,
      slug: page.slug,
      isHome: page.isHome,
      status: page.status,
      visibility: draftSettings.visibility,
      allowedRoles: draftSettings.allowedRoles,
      titleAr: page.titleAr,
      titleEn: page.titleEn,
      // حقول الإعدادات للمحرر تأتي من المسودة
      order: draftSettings.order,
      seoTitleAr: draftSettings.seoTitleAr,
      seoTitleEn: draftSettings.seoTitleEn,
      seoDescAr: draftSettings.seoDescAr,
      seoDescEn: draftSettings.seoDescEn,
      draftSlug: draftSettings.slug,
      draftTitleAr: draftSettings.titleAr,
      draftTitleEn: draftSettings.titleEn,
      draftSettings,
      publishedSettings,
      draftBlocksAr: page.draftBlocksAr,
      draftBlocksEn: page.draftBlocksEn,
      publishedBlocksAr: page.publishedBlocksAr,
      publishedBlocksEn: page.publishedBlocksEn,
      draftUpdatedAt: page.draftUpdatedAt,
      draftUpdatedById: page.draftUpdatedById,
      draftUpdatedByName: draftUpdater?.name ?? null,
      draftRevision: page.draftRevision,
      publishedRevision: page.publishedRevision,
      publishedAt: page.publishedAt,
      scheduledPublishAt: page.scheduledPublishAt,
      scheduledRevision: page.scheduledRevision,
      hasUnpublishedChanges: hasUnpublishedChanges(page),
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
  if (page.status === "archived") return json({ ok: false, code: "archived" }, 409);

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ ok: false, code: "invalid" }, 400);
  }

  // ——— إلغاء الأرشفة (بصلاحية الحذف) ———
  if (body.action === "unarchive") {
    const delGuard = await guardApi(req, "pages.delete");
    if (!delGuard.ok) return delGuard.response;
    await db.page.update({ where: { id }, data: { status: "draft" } });
    await audit({
      actorId: guard.user.id, actorEmail: guard.user.email, action: AUDIT_ACTIONS.pageRestored,
      entityType: "page", entityId: id, details: { slug: page.slug, unarchived: true },
    });
    return json({ ok: true, page: { id, slug: page.slug, draftUpdatedAt: page.draftUpdatedAt, status: "draft", draftRevision: page.draftRevision } });
  }

  // ——— إرسال للمراجعة (صلاحية التحرير) → in_review: يُقفل الحفظ الآلي حتى القرار ———
  if (body.action === "submit_review") {
    if (!canSubmitForReview(page.status)) {
      return json({ ok: false, code: page.status === "in_review" ? "already_in_review" : "archived" }, 409);
    }
    // ربط الإرسال بمراجعة محفوظة — ما يُراجع هو المحفوظ لا شاشة أحد
    if (typeof body.baseRevision !== "number" || !Number.isInteger(body.baseRevision)) {
      return json({ ok: false, code: "revision_required" }, 409);
    }
    if (body.baseRevision !== page.draftRevision) {
      return json({ ok: false, code: "conflict", serverRevision: page.draftRevision }, 409);
    }
    const note = normalizeReviewNote(body.note);
    await db.page.update({ where: { id }, data: { status: "in_review" } });
    await audit({
      actorId: guard.user.id, actorEmail: guard.user.email, action: AUDIT_ACTIONS.pageReviewSubmitted,
      entityType: "page", entityId: id,
      details: { slug: page.slug, revision: page.draftRevision, ...(note ? { note } : {}) },
    });
    // إشعار الناشرين (عدا الفاعل) — برابط بلغة كل مستخدم
    const publishers = await publishersToNotify();
    await notifyMany(
      publishers
        .filter((p) => p.id !== guard.user.id)
        .map((p) => ({
          userId: p.id,
          type: "status_changed" as const,
          payload: {
            pageTitle: page.titleAr || page.titleEn || page.slug || "home",
            slug: page.slug || "home",
            decision: "submitted",
            by: guard.user.name || guard.user.email,
            ...(note ? { note } : {}),
          },
          link: `/${p.locale === "en" ? "en" : "ar"}/admin/pages/${id}/edit`,
        }))
    );
    return json({ ok: true, page: { id, slug: page.slug, status: "in_review", draftRevision: page.draftRevision } });
  }

  const currentSettings = parsePageSettings(page.draftSettings, page, { ar: page.titleAr, en: page.titleEn });
  const touchesDraft =
    typeof body.draftBlocksAr === "string" ||
    typeof body.draftBlocksEn === "string" ||
    typeof body.draftSettings === "object";

  // ——— قفل المراجعة الإلزامي لأي تعديل مسودة ———
  // لا يُقبل الحفظ بلا مراجعة أساس؛ التعارض يرجع 409 قبل أي كتابة.
  let baseRevision = page.draftRevision;
  if (touchesDraft) {
    if (typeof body.baseRevision !== "number" || !Number.isInteger(body.baseRevision)) {
      return json({ ok: false, code: "revision_required" }, 409);
    }
    baseRevision = body.baseRevision;
    if (baseRevision !== page.draftRevision) {
      return json({ ok: false, code: "conflict", serverRevision: page.draftRevision }, 409);
    }
  }

  const data: Record<string, unknown> = {};
  let savedBlocksAr: string | null = null;
  let savedBlocksEn: string | null = null;

  // المسودة — تحقق الخادم الإلزامي قبل الحفظ، ويُخزن المحتوى المطّعّم لا الأصلي
  if (typeof body.draftBlocksAr === "string") {
    const check = validateContent(body.draftBlocksAr);
    if (!check.ok) return json({ ok: false, code: "invalid_blocks", error: check.error }, 400);
    savedBlocksAr = check.json;
    data.draftBlocksAr = savedBlocksAr;
  }
  if (typeof body.draftBlocksEn === "string") {
    const check = validateContent(body.draftBlocksEn);
    if (!check.ok) return json({ ok: false, code: "invalid_blocks", error: check.error }, 400);
    savedBlocksEn = check.json;
    data.draftBlocksEn = savedBlocksEn;
  }

  // ——— إعدادات المسودة العامة (تصل الزوار عند النشر فقط) ———
  let nextSettings: PageSettings = currentSettings;
  if (typeof body.draftSettings === "object" && body.draftSettings !== null) {
    const incoming = settingsFromInput(body.draftSettings);
    if (!incoming) return json({ ok: false, code: "invalid_settings" }, 400);

    // فحص الرابط المسودة: صيغة + عدم التصادم مع روابط صفحات أخرى (المنشورة أو المسودة)
    if (!isValidSlug(incoming.slug)) return json({ ok: false, code: "invalid_slug" }, 400);
    if (incoming.slug !== currentSettings.slug) {
      const takenLive = await db.page.findFirst({ where: { slug: incoming.slug, id: { not: id } } });
      if (takenLive) return json({ ok: false, code: "slug_taken" }, 409);
      const others = await db.page.findMany({
        where: { id: { not: id } },
        select: { id: true, draftSettings: true },
      });
      for (const other of others) {
        const otherSettings = parsePageSettings(other.draftSettings, {});
        if (otherSettings.slug === incoming.slug) return json({ ok: false, code: "slug_taken" }, 409);
      }
      if (incoming.slug) {
        // منع حلقات التحويل: الهدف لا يحول إلى مسار آخر
        const targetRedirect = await db.pageRedirect.findUnique({ where: { fromSlug: incoming.slug } });
        if (targetRedirect) return json({ ok: false, code: "redirect_loop" }, 409);
      }
    }
    if (incoming.slug === "" && !page.isHome && body.isHome !== true) {
      return json({ ok: false, code: "home_slug" }, 400);
    }
    nextSettings = incoming;
    data.draftSettings = serializePageSettings(nextSettings);
  }

  // ——— تحديد الرئيسية — عملية ذرية واحدة لا تترك الموقع بلا رئيسية ———
  if (body.isHome === true && !page.isHome) {
    const oldHome = await db.page.findFirst({ where: { isHome: true, id: { not: id } } });
    if (oldHome) {
      // الرئيسية القديمة تحتاج رابطًا جديدًا فريدًا — نشتقه من عنوانها
      const base = slugify(oldHome.titleEn || oldHome.titleAr) || "page";
      let newSlug = base;
      for (let i = 2; i < 50; i++) {
        const clash = await db.page.findFirst({ where: { slug: newSlug, id: { not: oldHome.id } } });
        if (!clash) break;
        newSlug = `${base}-${i}`;
      }
      const oldSettings = parsePageSettings(oldHome.draftSettings, oldHome, { ar: oldHome.titleAr, en: oldHome.titleEn });
      const [oldHomeRow] = await db.$transaction([
        db.page.update({
          where: { id: oldHome.id },
          data: { isHome: false, slug: newSlug, draftSettings: serializePageSettings({ ...oldSettings, slug: newSlug }) },
          select: { id: true },
        }),
        db.page.update({
          where: { id },
          data: { isHome: true, slug: "", draftSettings: serializePageSettings({ ...nextSettings, slug: "" }) },
          select: { id: true },
        }),
      ]);
      if (touchesDraft) {
        await db.page.update({
          where: { id },
          data: {
            draftUpdatedAt: new Date(),
            draftUpdatedById: guard.user.id,
            editorTouchedAt: new Date(),
            draftRevision: baseRevision + 1,
          },
        });
      }
      await audit({
        actorId: guard.user.id, actorEmail: guard.user.email, action: AUDIT_ACTIONS.pageUpdated,
        entityType: "page", entityId: id,
        details: { homeChanged: true, from: oldHome.slug, newHomeSlug: "", oldHomeNewSlug: newSlug },
      });
      const fresh = await db.page.findUnique({ where: { id: oldHomeRow.id }, select: { draftRevision: true, draftUpdatedAt: true, slug: true, status: true } });
      return json({
        ok: true,
        page: {
          id, slug: "", status: page.status,
          draftUpdatedAt: fresh?.draftUpdatedAt ?? null,
          draftRevision: fresh?.draftRevision ?? page.draftRevision,
          isHome: true,
        },
      });
    }
    // لا رئيسية قديمة (حالة نادرة) — التعيين المباشر آمن
    data.isHome = true;
    data.slug = "";
    nextSettings = { ...nextSettings, slug: "" };
    data.draftSettings = serializePageSettings(nextSettings);
  }

  // العنوان الإداري الداخلي (غير علني) — يُحدّث مباشرة
  if (typeof body.titleAr === "string") data.titleAr = body.titleAr.slice(0, 200);
  if (typeof body.titleEn === "string") data.titleEn = body.titleEn.slice(0, 200);

  if (touchesDraft) {
    data.draftUpdatedAt = new Date();
    data.draftUpdatedById = guard.user.id;
    data.editorTouchedAt = new Date();
    data.draftRevision = { increment: 1 };
  }

  if (!Object.keys(data).length) return json({ ok: false, code: "invalid" }, 400);

  // التحديث الذري: يفشل إذا سبقنا إلى المراجعة نفسها (دفاع ثانٍ بعد الفحص)
  let updated: { id: string; slug: string; status: string; draftUpdatedAt: Date | null; draftRevision: number };
  if (touchesDraft) {
    const result = await db.page.updateMany({
      where: { id, draftRevision: baseRevision },
      data: { ...data, draftRevision: baseRevision + 1 },
    });
    if (result.count === 0) {
      return json({ ok: false, code: "conflict", serverRevision: page.draftRevision }, 409);
    }
    const found = await db.page.findUnique({
      where: { id },
      select: { id: true, slug: true, status: true, draftUpdatedAt: true, draftRevision: true },
    });
    if (!found) return json({ ok: false, code: "not_found" }, 404);
    updated = found;
  } else {
    updated = await db.page.update({
      where: { id },
      data,
      select: { id: true, slug: true, status: true, draftUpdatedAt: true, draftRevision: true },
    });
  }

  const isBlocksSave = savedBlocksAr !== null || savedBlocksEn !== null;
  if (isBlocksSave) {
    await audit({
      actorId: guard.user.id, actorEmail: guard.user.email, action: AUDIT_ACTIONS.pageDraftSaved,
      entityType: "page", entityId: id, details: { slug: updated.slug },
    });
  } else if (typeof body.draftSettings === "object") {
    await audit({
      actorId: guard.user.id, actorEmail: guard.user.email, action: AUDIT_ACTIONS.pageUpdated,
      entityType: "page", entityId: id, details: { draftSettingsSaved: true, slug: nextSettings.slug },
    });
  }

  return json({
    ok: true,
    page: {
      id: updated.id,
      slug: updated.slug,
      status: updated.status,
      draftUpdatedAt: updated.draftUpdatedAt,
      draftRevision: updated.draftRevision,
      draftSettings: nextSettings,
    },
  });
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

/** توليد slug من نص (للرئيسية القديمة عند تعيين رئيسية جديدة) */
function slugify(text: string): string {
  const cleaned = text
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  // الروابط اللاتينية فقط — العربية تُستبدل باسم محايد
  return /^[a-z0-9-]+$/.test(cleaned) && cleaned.length > 0 ? cleaned.slice(0, 60) : "page";
}
