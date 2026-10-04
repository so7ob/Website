/**
 * نواة النشر المشتركة — مسار واحد للنشر اليدوي والمجدول.
 *
 * استُخرج منطق POST /api/admin/pages/[id]/publish حرفيًا حتى تنفّذ الجدولة
 * النشر بمرآة الأمان نفسها: ربط بمراجعة، تحقق خادمي، لقطة إعدادات، معاملة
 * ذرية، إصدارات عند التغيير فقط، تحويلات الرابط، إعادة التحقق، التدقيق والإشعارات.
 *
 * الصلاحية (pages.publish) تُفحص عند مدخل الطلب اليدوي؛ الجدولة تنفّذ نيابة
 * عن مستخدم جادل بالفعل يملك الصلاحية (تحققت وقت الجدولة) — ويُدوَّن الفاعل الحقيقي.
 */
import { db } from "@/lib/db";
import { validateContent } from "@/lib/blocks/validate";
import { isValidSlug } from "@/lib/blocks/types";
import { audit, AUDIT_ACTIONS } from "@/lib/auth/audit";
import { revalidatePath } from "next/cache";
import { notifyMany } from "@/lib/auth/notifications";
import { parsePageSettings, serializePageSettings } from "@/lib/page-settings";

export type PublishLocale = "ar" | "en";
export type PublishLocales = PublishLocale[];
export type PublishVia = "manual" | "scheduled";

export interface PublishActor {
  id: string;
  email: string;
}

export type PublishCoreResult =
  | {
      ok: true;
      publishedAt: Date;
      slug: string;
      revision: number;
      locales: PublishLocales;
    }
  | { ok: false; status: number; code: string; error?: string; serverRevision?: number };

/**
 * إعادة تحقق آمنة — revalidatePath يرمي خارج سياق طلب (مثل دورة الجدولة الخلفية:
 * "static generation store missing"). النشر المجدول يعمل بلا مخزن طلب فنلتقط
 * ونُسجل بدل إسقاط النشر كله بعد نجاح معاملته.
 */
function safeRevalidate(path: string): void {
  try {
    revalidatePath(path);
  } catch (err) {
    console.warn(`[publish-core] revalidatePath skipped for ${path}:`, err instanceof Error ? err.message : err);
  }
}

export async function publishPageCore(input: {
  pageId: string;
  locales: PublishLocales;
  actor: PublishActor;
  via: PublishVia;
  /** ملاحظة اختيارية تُخزن على الإصدارات المنشأة (تُستخدم لموافقة المراجعة — «approved») */
  versionNote?: string | null;
}): Promise<PublishCoreResult> {
  const { pageId, locales, actor, via } = input;

  const page = await db.page.findUnique({ where: { id: pageId } });
  if (!page) return { ok: false, status: 404, code: "not_found" };
  if (page.status === "archived") return { ok: false, status: 409, code: "archived" };

  // الناشر (اليدوي أو صاحب الجدولة) يجب أن يكون مستخدمًا نشطًا — حماية من التنفيذ بحساب مُبطل
  const actorUser = await db.user.findUnique({ where: { id: actor.id }, select: { id: true, status: true } });
  if (!actorUser || actorUser.status !== "active") return { ok: false, status: 403, code: "actor_inactive" };

  // تحقق الخادم قبل النشر — مصدر الحقيقة النهائي للغات المطلوبة فقط.
  // الترحيل يحدث هنا أيضًا: مسودة قديمة بصيغة v0 تُرحّل وتُنشر بصيغة v1 المطبّعة.
  let anyNonEmpty = false;
  const validated: Partial<Record<PublishLocale, string | null>> = {};
  for (const locale of locales) {
    const blocks = locale === "ar" ? page.draftBlocksAr : page.draftBlocksEn;
    const check = validateContent(blocks);
    if (!check.ok) return { ok: false, status: 400, code: "invalid_blocks", error: check.error };
    if (check.tree.length > 0) {
      anyNonEmpty = true;
      validated[locale] = check.json;
    } else {
      // لغة مطلوبة ومسودتها فارغة → تُنشر null بقرار صريح (تختفي للزوار)
      validated[locale] = null;
    }
  }
  if (!anyNonEmpty) return { ok: false, status: 400, code: "empty_page" };

  // ——— تطبيق الرابط من إعدادات المسودة (فحص التصادم والحلقات قبل المعاملة) ———
  const draftSettings = parsePageSettings(page.draftSettings, page, { ar: page.titleAr, en: page.titleEn });
  let liveSlug = page.slug;
  const createRedirect = draftSettings.slug !== page.slug;
  if (createRedirect) {
    if (!isValidSlug(draftSettings.slug)) return { ok: false, status: 400, code: "invalid_slug" };
    if (draftSettings.slug === "" && !page.isHome) return { ok: false, status: 400, code: "home_slug" };
    const taken = await db.page.findFirst({ where: { slug: draftSettings.slug, id: { not: pageId } } });
    if (taken) return { ok: false, status: 409, code: "slug_taken" };
    const targetRedirect = await db.pageRedirect.findUnique({ where: { fromSlug: draftSettings.slug } });
    if (targetRedirect) return { ok: false, status: 409, code: "redirect_loop" };
  }
  if (page.isHome) liveSlug = "";

  // آخر إصدار لكل لغة مطلوبة — لتخطي الإصدارات المكررة عند عدم التغيير
  const lastVersions = await db.pageVersion.findMany({
    where: { pageId, locale: { in: locales } },
    orderBy: { version: "desc" },
  });
  const lastVersionFor = (locale: PublishLocale) => lastVersions.find((v) => v.locale === locale);

  const now = new Date();
  const pageUpdate = db.page.update({
    where: { id: pageId },
    data: {
      ...(validated.ar !== undefined ? { publishedBlocksAr: validated.ar } : {}),
      ...(validated.en !== undefined ? { publishedBlocksEn: validated.en } : {}),
      publishedSettings: serializePageSettings(draftSettings),
      // مزامنة الأعمدة الحية مع اللقطة المنشورة — قوائم الإدارة وsitemap تقرأ قيمًا منشورة فعلًا
      visibility: draftSettings.visibility,
      allowedRoles: JSON.stringify(draftSettings.allowedRoles),
      seoTitleAr: draftSettings.seoTitleAr,
      seoTitleEn: draftSettings.seoTitleEn,
      seoDescAr: draftSettings.seoDescAr,
      seoDescEn: draftSettings.seoDescEn,
      order: draftSettings.order,
      ...(createRedirect ? { slug: draftSettings.slug } : {}),
      publishedAt: now,
      publishedById: actor.id,
      publishedRevision: page.draftRevision,
      status: "published",
    },
  });

  const versionCreates = locales
    .filter((locale) => {
      const last = lastVersionFor(locale);
      const blocks = locale === "ar" ? page.draftBlocksAr : page.draftBlocksEn;
      return !last || last.blocks !== blocks;
    })
    .map((locale) => {
      const last = lastVersionFor(locale);
      return db.pageVersion.create({
        data: {
          pageId,
          locale,
          version: (last?.version ?? 0) + 1,
          blocks: locale === "ar" ? page.draftBlocksAr : page.draftBlocksEn,
          authorId: actor.id,
          note: via === "scheduled" ? "scheduled" : input.versionNote ?? null,
        },
      });
    });

  const redirectCreate =
    createRedirect && page.slug !== ""
      ? [db.pageRedirect.upsert({
          where: { fromSlug: page.slug },
          update: { toSlug: draftSettings.slug },
          create: { fromSlug: page.slug, toSlug: draftSettings.slug },
        })]
      : [];

  await db.$transaction([pageUpdate, ...versionCreates, ...redirectCreate]);

  // إعادة تحقق مسارات الصفحة (القديمة والجديدة) فورًا — النشر يظهر بلا إعادة بناء
  const pathsToRevalidate = new Set<string>(["/sitemap.xml"]);
  for (const locale of ["ar", "en"] as const) {
    pathsToRevalidate.add(page.slug ? `/${locale}/${page.slug}` : `/${locale}`);
    if (createRedirect && draftSettings.slug) pathsToRevalidate.add(`/${locale}/${draftSettings.slug}`);
  }
  for (const path of pathsToRevalidate) safeRevalidate(path);

  await audit({
    actorId: actor.id, actorEmail: actor.email, action: AUDIT_ACTIONS.pagePublished,
    entityType: "page", entityId: pageId,
    details: {
      slug: draftSettings.slug,
      locales,
      revision: page.draftRevision,
      via,
      versions: Object.fromEntries(locales.map((l) => [l, (lastVersionFor(l)?.version ?? 0) + 1])),
    },
  });

  // إشعار نشر المحتوى لمحرري المحتوى الآخرين — برابط بلغة كل مستخدم
  const editors = await db.user.findMany({
    where: { status: "active", roleKey: { in: ["super_admin", "content_editor", "ops_manager"] } },
    select: { id: true, locale: true },
  });
  await notifyMany(
    editors.filter((e) => e.id !== actor.id).map((e) => ({
      userId: e.id,
      type: "content_published" as const,
      payload: { slug: draftSettings.slug || "home", title: page.titleAr },
      link: `/${e.locale === "en" ? "en" : "ar"}/admin/pages`,
    }))
  );

  return { ok: true, publishedAt: now, slug: liveSlug, revision: page.draftRevision, locales };
}
