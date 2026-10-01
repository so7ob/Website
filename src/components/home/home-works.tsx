import Link from "next/link";
import { Info } from "lucide-react";
import { Section, SectionHeading } from "@/components/site/section";
import { CaseVisual } from "@/components/works/case-visual";
import { localePath, type Locale } from "@/lib/i18n";
import type { SiteContent } from "@/content/types";

/** معرض الأعمال في الرئيسية — بطاقات الحالات الثلاث مع توضيح صادق ظاهر */
export function HomeWorks({ locale, content }: { locale: Locale; content: SiteContent }) {
  const w = content.home.works;
  return (
    <Section>
      <SectionHeading kicker={w.kicker} title={w.title} description={w.description} />
      <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <p className="flex items-start gap-3 text-sm font-semibold leading-7 text-amber-900">
          <Info className="mt-1 h-4.5 w-4.5 shrink-0" aria-hidden="true" />
          {content.works.disclaimer.title}
        </p>
      </div>
      <div className="mt-8 grid gap-6 md:grid-cols-3">
        {w.cases.map((c) => (
          <article key={c.key} className="flex flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-sm transition-shadow hover:shadow-md">
            <div className="p-4 pb-0">
              <CaseVisual kind={c.kind} label={c.title} />
            </div>
            <div className="flex flex-1 flex-col p-6 pt-5">
              <span className="mb-3 inline-flex w-fit items-center rounded-full bg-accent px-3 py-1 text-xs font-bold text-brand-strong">
                {c.badge}
              </span>
              <h3 className="text-lg font-bold text-navy">{c.title}</h3>
              <p className="mt-2 flex-1 text-sm leading-7 text-muted-foreground">{c.summary}</p>
            </div>
          </article>
        ))}
      </div>
      <div className="mt-8">
        <Link
          href={localePath(locale, "works")}
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-navy px-6 text-sm font-semibold text-white transition-colors hover:bg-navy-soft"
        >
          {content.actions.viewAllWorks}
        </Link>
      </div>
    </Section>
  );
}
