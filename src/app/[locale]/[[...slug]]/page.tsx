import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth/session";
import { canAccessPage } from "@/lib/auth/resource-access";
import { PageRenderer } from "@/components/blocks/page-renderer";
import { locales, type Locale } from "@/lib/i18n";
import type { Block } from "@/lib/blocks/types";

export const dynamic = "force-dynamic";

interface Params {
  params: Promise<{ locale: string; slug?: string[] }>;
}

function resolveSlug(slug: string[] | undefined): string {
  if (!slug || slug.length === 0) return ""; // الرئيسية
  // مسار داخلي متعدد المستويات — ندعم مستوى واحدًا حاليًا للتوافق مع الروابط الحالية
  return slug.join("/").toLowerCase();
}

async function getPage(slug: string) {
  // نختار الحقول المنشورة فقط — لا تصل المسودة لأي مسار إرسال للزائر
  return db.page.findFirst({
    where: { slug, status: "published" },
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
      publishedBlocksAr: true,
      publishedBlocksEn: true,
    },
  });
}

/** صفحة CMS: تُخدم من قاعدة البيانات — نشر جديد يظهر بلا إعادة بناء */
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale: raw, slug } = await params;
  if (!locales.includes(raw as Locale)) return {};
  const locale = raw as Locale;
  const page = await getPage(resolveSlug(slug));
  if (!page) return {};
  const viewer = page.visibility === "public" ? null : await getAuthUser();
  if (!canAccessPage(viewer, page)) return { robots: { index: false, follow: false } };

  const isAr = locale === "ar";
  const title = (isAr ? page.seoTitleAr : page.seoTitleEn) ?? (isAr ? page.titleAr : page.titleEn);
  const description = (isAr ? page.seoDescAr : page.seoDescEn) ?? undefined;
  const path = page.slug ? `/${locale}/${page.slug}` : `/${locale}`;
  const restricted = page.visibility !== "public";

  return {
    title,
    description,
    alternates: {
      canonical: path,
      languages: { ar: page.slug ? `/ar/${page.slug}` : "/ar", en: page.slug ? `/en/${page.slug}` : "/en", "x-default": "/ar" },
    },
    openGraph: {
      title,
      description,
      url: path,
      locale: isAr ? "ar_SA" : "en_US",
      alternateLocale: [isAr ? "en_US" : "ar_SA"],
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

  // صلاحية الوصول للصفحة المقيدة
  if (page.visibility !== "public") {
    const user = await getAuthUser();
    if (!user) {
      redirect(`/${locale}/auth/login?next=/${locale}${target ? `/${target}` : ""}`);
    }
    if (!canAccessPage(user, page)) notFound();
  }

  const blocksJson = locale === "ar" ? page.publishedBlocksAr : page.publishedBlocksEn;
  let blocks: Block[] = [];
  try {
    blocks = JSON.parse(blocksJson ?? "[]");
  } catch {
    blocks = [];
  }

  if (blocks.length === 0) notFound();

  return <PageRenderer blocks={blocks} locale={locale} />;
}
