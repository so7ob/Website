import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth/session";
import { canAccessPage } from "@/lib/auth/resource-access";
import { parsePageSettings } from "@/lib/page-settings";
import { PageRenderer } from "@/components/blocks/page-renderer";
import { loadContentForRender } from "@/lib/blocks/validate";
import { locales, defaultLocale, type Locale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

interface Params {
  params: Promise<{ locale: string; slug?: string[] }>;
}

function resolveSlug(slug: string[] | undefined): string {
  if (!slug || slug.length === 0) return ""; // الرئيسية
  // مسار داخلي متعدد المستويات — ندعم مستوى واحدًا حاليًا للتوافق مع الروابط الحالية
  return slug.join("/").toLowerCase();
}

/**
 * الصفحة المنشورة فقط: نقرأ لقطة الإعدادات المنشورة والكتل المنشورة.
 * - لا نقرأ المسودة أبدًا في أي مسار زائر.
 * - الحالة (مسودة/قيد المراجعة) لا تخفي نسخة منشورة قائمة — الأرشفة وحدها تخفي.
 * - الصفحات القديمة قبل لقطة الإعدادات تُقرأ من الحقول المباشرة كاحتياط.
 */
async function getPage(slug: string) {
  return db.page.findFirst({
    where: { slug, status: { not: "archived" } },
    select: {
      id: true,
      slug: true,
      status: true,
      visibility: true,
      allowedRoles: true,
      titleAr: true,
      titleEn: true,
      seoTitleAr: true,
      seoTitleEn: true,
      seoDescAr: true,
      seoDescEn: true,
      publishedSettings: true,
      publishedBlocksAr: true,
      publishedBlocksEn: true,
    },
  });
}

/** هل النسخة المنشورة للغة موجودة؟ (404 للغة غير المنشورة) — يدعم المصفوفة القديمة ومغلف v1 */
function localePublished(page: { publishedBlocksAr: string | null; publishedBlocksEn: string | null }, locale: Locale): boolean {
  const json = locale === "ar" ? page.publishedBlocksAr : page.publishedBlocksEn;
  if (!json) return false;
  try {
    const parsed = JSON.parse(json) as unknown;
    if (Array.isArray(parsed)) return parsed.length > 0;
    if (typeof parsed === "object" && parsed !== null && Array.isArray((parsed as { blocks?: unknown }).blocks)) {
      return ((parsed as { blocks: unknown[] }).blocks).length > 0;
    }
    return false;
  } catch {
    return false;
  }
}

/** صفحة CMS: تُخدم من قاعدة البيانات — نشر جديد يظهر بلا إعادة بناء */
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale: raw, slug } = await params;
  if (!locales.includes(raw as Locale)) return {};
  const locale = raw as Locale;
  const page = await getPage(resolveSlug(slug));
  if (!page) return {};
  // إصلاح #16: الصفحات المقيدة لا تُفهرس — فحص الوصول يسبق فحص نشر اللغة
  const metaViewer = page.visibility === "public" ? null : await getAuthUser();
  if (!canAccessPage(metaViewer, page)) return { robots: { index: false, follow: false } };
  if (!localePublished(page, locale)) return {};

  const settings = parsePageSettings(page.publishedSettings, page, { ar: page.titleAr, en: page.titleEn });
  const isAr = locale === "ar";
  const title = (isAr ? settings.seoTitleAr : settings.seoTitleEn) ?? ((isAr ? settings.titleAr : settings.titleEn) || undefined);
  const description = (isAr ? settings.seoDescAr : settings.seoDescEn) ?? undefined;
  const path = page.slug ? `/${locale}/${page.slug}` : `/${locale}`;
  const restricted = settings.visibility !== "public";

  // hreflang شرطي — اللغات المتاحة منشورةً فقط (لا نعلن روابط تُرجع 404)
  const availableLocales = locales.filter((l) => localePublished(page, l));
  const languages: Record<string, string> = {};
  for (const l of availableLocales) {
    languages[l] = page.slug ? `/${l}/${page.slug}` : `/${l}`;
  }
  if (availableLocales.includes(defaultLocale)) {
    languages["x-default"] = page.slug ? `/${defaultLocale}/${page.slug}` : `/${defaultLocale}`;
  }

  return {
    title,
    description,
    alternates: {
      canonical: path,
      ...(Object.keys(languages).length > 1 ? { languages } : {}),
    },
    openGraph: {
      title,
      description,
      url: path,
      locale: isAr ? "ar_SA" : "en_US",
      alternateLocale: availableLocales.filter((l) => l !== locale).map((l) => (l === "ar" ? "ar_SA" : "en_US")),
    },
    robots: restricted ? { index: false, follow: false } : { index: true, follow: true },
  };
}

export default async function CmsPage({ params }: Params) {
  const { locale: raw, slug } = await params;
  if (!locales.includes(raw as Locale)) notFound();
  const locale = raw as Locale;
  const target = resolveSlug(slug);

  const page = await getPage(target);
  if (!page) {
    // تحويل مسار قديم بعد تغيير رابط صفحة منشورة
    const redirectRow = await db.pageRedirect.findUnique({ where: { fromSlug: target } });
    if (redirectRow) {
      const to = redirectRow.toSlug ? `/${locale}/${redirectRow.toSlug}` : `/${locale}`;
      redirect(to);
    }
    notFound();
  }

  // اللغة غير المنشورة → 404 (حتى لو اللغة الأخرى منشورة)
  if (!localePublished(page, locale)) notFound();

  // الظهور والأدوار من لقطة الإعدادات المنشورة — لا تأثير فوري لتعديلات المسودة
  const settings = parsePageSettings(page.publishedSettings, page, { ar: page.titleAr, en: page.titleEn });
  if (settings.visibility !== "public") {
    const user = await getAuthUser();
    if (!user) {
      redirect(`/${locale}/auth/login?next=/${locale}${target ? `/${target}` : ""}`);
    }
    // فحص مزدوج: لقطة الإعدادات المنشورة (فصل المسودة عن النشر) + canAccessPage (إصلاح #16 — دفاع متعمّق)
    if (!canAccessPage(user, page)) notFound();
    if (settings.visibility === "role") {
      // تجاوز الأدوار لمن لديه صلاحية موثقة فقط: المدير الأعلى
      const allowed = user.roleKey === "super_admin" || settings.allowedRoles.includes(user.roleKey);
      if (!allowed) notFound();
    }
  }

  const blocksJson = locale === "ar" ? page.publishedBlocksAr : page.publishedBlocksEn;
  // بوابة التحقق نفسها: ترحيل v0 → v1 + تطبيع + فحص الحدود — والخطأ صريح لا صفحة فارغة
  const content = loadContentForRender(blocksJson);
  if (!content.ok || content.tree.length === 0) notFound();

  return <PageRenderer nodes={content.tree} locale={locale} mode="live" />;
}
