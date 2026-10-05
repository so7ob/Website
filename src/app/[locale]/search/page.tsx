import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Search, ArrowUpRight, FileText, SearchX, Compass, Sparkles } from "lucide-react";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth/session";
import { canAccessPage } from "@/lib/auth/resource-access";
import { parsePageSettings } from "@/lib/page-settings";
import { locales, defaultLocale, type Locale } from "@/lib/i18n";
import { ar } from "@/content/ar";
import { en } from "@/content/en";
import type { Snippet } from "@/lib/search/site-search";
import { searchPages, tokenizeQuery, type SearchablePage } from "@/lib/search/site-search";

export const dynamic = "force-dynamic";

interface Params {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** سقف طول الاستعلام — يمنع الاستعلامات المفتعلة الطويلة */
const MAX_QUERY_LENGTH = 100;

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale = (locales.includes(raw as Locale) ? raw : defaultLocale) as Locale;
  const content = locale === "en" ? en : ar;
  return {
    title: content.search.title,
    description: content.search.subtitle,
    // صفحة نتائج البحث لا تُفهرس — سلوك SEO قياسي
    robots: { index: false, follow: true },
  };
}

/** هل النسخة المنشورة للغة موجودة؟ (مطابق لمسار الصفحة: مصفوفة قديمة أو غلاف v1) */
function localePublished(blocksJson: string | null): boolean {
  if (!blocksJson) return false;
  try {
    const parsed = JSON.parse(blocksJson) as unknown;
    if (Array.isArray(parsed)) return parsed.length > 0;
    if (typeof parsed === "object" && parsed !== null && Array.isArray((parsed as { blocks?: unknown }).blocks)) {
      return ((parsed as { blocks: unknown[] }).blocks).length > 0;
    }
    return false;
  } catch {
    return false;
  }
}

/** تمييز القصاصة داخل الواجهة — mark بلون العلامة التجارية فوق المقطع المطابق */
function HighlightedSnippet({ snippet, labels }: { snippet: Snippet; labels: { start: string; end: string } }) {
  return (
    <p className="text-sm leading-7 text-muted-foreground">
      {snippet.startTrimmed ? <span className="text-muted-foreground/60">{labels.start}</span> : null}
      {snippet.before}
      <mark className="rounded bg-accent px-1 font-semibold text-brand-strong">{snippet.hit}</mark>
      {snippet.after}
      {snippet.endTrimmed ? <span className="text-muted-foreground/60">{labels.end}</span> : null}
    </p>
  );
}

export default async function SiteSearchPage({ params, searchParams }: Params) {
  const { locale: raw } = await params;
  if (!locales.includes(raw as Locale)) notFound();
  const locale = raw as Locale;
  const content = locale === "en" ? en : ar;
  const t = content.search;

  const sp = await searchParams;
  const rawQuery = Array.isArray(sp.q) ? sp.q[0] : sp.q;
  const query = (rawQuery ?? "").trim().slice(0, MAX_QUERY_LENGTH);
  const hasQuery = query.length > 0 && tokenizeQuery(query).length > 0;

  // صفحات الموقع (غير المؤرشفة) — بوابات الظهور نفسها في مسار الصفحة:
  // لغة منشورة + لقطة الإعدادات المنشورة + canAccessPage للزائر الحالي
  const user = await getAuthUser();
  const rows = await db.page.findMany({
    where: { status: { not: "archived" } },
    orderBy: [{ order: "asc" }],
    select: {
      slug: true,
      visibility: true,
      allowedRoles: true,
      titleAr: true,
      titleEn: true,
      seoDescAr: true,
      seoDescEn: true,
      publishedSettings: true,
      publishedBlocksAr: true,
      publishedBlocksEn: true,
    },
  });

  const searchable: SearchablePage[] = [];
  for (const row of rows) {
    const blocksJson = locale === "ar" ? row.publishedBlocksAr : row.publishedBlocksEn;
    if (!localePublished(blocksJson)) continue;
    const settings = parsePageSettings(row.publishedSettings, row, { ar: row.titleAr, en: row.titleEn });
    // المقيدة تظهر فقط لمن يملك الوصول فعليًا — لا تسرّب وجودها لغير المصرح
    if (settings.visibility !== "public" && !canAccessPage(user, row)) continue;
    searchable.push({
      slug: row.slug,
      title: (locale === "ar" ? settings.titleAr : settings.titleEn) || "",
      description: ((locale === "ar" ? settings.seoDescAr : settings.seoDescEn) ?? "").trim(),
      blocksJson,
    });
  }

  const hits = hasQuery ? searchPages(searchable, query) : [];
  const suggestions = (Object.keys(content.nav) as (keyof typeof content.nav)[]).map((key) => ({
    key,
    label: content.nav[key],
    href: key === "home" ? `/${locale}` : `/${locale}/${key}`,
  }));

  return (
    <div className="flex-1">
      {/* عنوان البحث — خلفية متدرجة بروح الهوية مع هالات ضوئية هادئة */}
      <section className="relative overflow-hidden bg-navy">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="absolute -top-24 start-[8%] size-72 rounded-full bg-brand/25 blur-3xl" />
          <div className="absolute -bottom-32 end-[6%] size-80 rounded-full bg-skydrop/15 blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-3xl px-4 py-14 text-center sm:px-6 sm:py-16">
          <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-white/10 text-skydrop ring-1 ring-white/15">
            <Search className="size-6" aria-hidden="true" />
          </span>
          <h1 className="mt-4 text-3xl font-bold text-white sm:text-4xl">{t.title}</h1>
          <p className="mt-2 text-sm text-white/70 sm:text-base">{t.subtitle}</p>

          <form action={`/${locale}/search`} method="GET" role="search" className="mx-auto mt-7 flex max-w-xl items-stretch gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute start-4 top-1/2 size-4.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input
                type="search"
                name="q"
                defaultValue={query}
                autoFocus
                maxLength={MAX_QUERY_LENGTH}
                placeholder={t.placeholder}
                aria-label={t.placeholder}
                className="h-12 w-full rounded-full border border-white/15 bg-white/95 ps-11 pe-4 text-sm text-navy shadow-lg shadow-navy/20 outline-none transition focus:border-skydrop focus:ring-2 focus:ring-skydrop/40"
              />
            </div>
            <button
              type="submit"
              className="inline-flex h-12 shrink-0 items-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-lg shadow-navy/30 transition hover:bg-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-skydrop/50"
            >
              <Sparkles className="size-4" aria-hidden="true" />
              {t.submit}
            </button>
          </form>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        {hasQuery ? (
          hits.length > 0 ? (
            <section aria-label={t.resultsCount.replace("{count}", String(hits.length))}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-navy" aria-live="polite">
                  {t.resultsCount.replace("{count}", String(hits.length))}
                </p>
                <p className="truncate font-mono text-xs text-muted-foreground ltr-isolate" dir="ltr">
                  &quot;{query}&quot;
                </p>
              </div>

              <ul className="mt-5 space-y-3">
                {hits.map((hit) => {
                  const href = hit.slug ? `/${locale}/${hit.slug}` : `/${locale}`;
                  return (
                    <li key={hit.slug}>
                      <Link
                        href={href}
                        className="group flex items-start gap-3 rounded-2xl border border-border bg-white p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-lg hover:shadow-navy/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                      >
                        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-brand-strong transition-colors group-hover:bg-brand group-hover:text-white">
                          <FileText className="size-4" aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <h2 className="truncate text-base font-semibold text-navy">{hit.title}</h2>
                            <ArrowUpRight
                              className="size-4 shrink-0 text-muted-foreground transition-all duration-300 group-hover:text-brand group-hover:-translate-y-0.5 rtl:-scale-x-100"
                              aria-hidden="true"
                            />
                          </div>
                          {hit.slug ? (
                            <p className="mt-0.5 inline-flex rounded-full bg-muted px-2 py-0.5 font-mono text-[11px] text-muted-foreground ltr-isolate" dir="ltr">
                              /{hit.slug}
                            </p>
                          ) : null}
                          <div className="mt-2">
                            {hit.snippet ? (
                              <HighlightedSnippet snippet={hit.snippet} labels={{ start: t.snippetStart, end: t.snippetEnd }} />
                            ) : (
                              <p className="text-sm leading-7 text-muted-foreground">{hit.fallback || t.describedBy}</p>
                            )}
                          </div>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : (
            <section aria-label={t.noResultsTitle} className="rounded-2xl border border-dashed border-border bg-white p-10 text-center">
              <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                <SearchX className="size-6" aria-hidden="true" />
              </span>
              <h2 className="mt-4 text-lg font-semibold text-navy">{t.noResultsTitle}</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-muted-foreground">{t.noResultsHint}</p>
            </section>
          )
        ) : (
          <section aria-label={t.emptyTitle} className="rounded-2xl border border-dashed border-border bg-white p-10 text-center">
            <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-accent text-brand-strong">
              <Search className="size-6" aria-hidden="true" />
            </span>
            <h2 className="mt-4 text-lg font-semibold text-navy">{t.emptyTitle}</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-muted-foreground">{t.emptyHint}</p>
          </section>
        )}

        {/* اقتراحات التصفح — تظهر مع الحالة الفارغة وبعد عدم وجود نتائج */}
        <section aria-label={t.suggestionsTitle} className="mt-8">
          <div className="flex items-center gap-2">
            <Compass className="size-4 text-muted-foreground" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-navy">{t.suggestionsTitle}</h2>
          </div>
          <ul className="mt-3 flex flex-wrap gap-2">
            {suggestions.map((item) => (
              <li key={item.key}>
                <Link
                  href={item.href}
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-border bg-white px-4 text-sm font-medium text-muted-foreground transition-colors hover:border-brand/40 hover:bg-accent hover:text-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                >
                  <FileText className="size-3.5" aria-hidden="true" />
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
