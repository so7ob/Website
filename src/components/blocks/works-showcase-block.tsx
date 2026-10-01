"use client";

import { Info } from "lucide-react";
import { Section, SectionHeading } from "@/components/site/section";
import { CaseVisual } from "@/components/works/case-visual";
import { localePath, type Locale } from "@/lib/i18n";
import { ar } from "@/content/ar";
import { en } from "@/content/en";
import { type z } from "zod";
import type { blockSchemas } from "@/lib/blocks/types";
import { BlockLink } from "./block-link";

export type WorksShowcaseBlockProps = z.input<typeof blockSchemas.worksShowcase>["props"];

/** معرض الأعمال المختصر — بطاقات الحالات مع توضيح صادق ظاهر (الأصل HomeWorks) */
export function WorksShowcaseBlock({ props, locale }: { props: WorksShowcaseBlockProps; locale: Locale }) {
  const t = locale === "en" ? en : ar;
  const disclaimer = props.disclaimer ?? t.works.disclaimer.title;
  const viewAllLabel = props.viewAllLabel ?? t.actions.viewAllWorks;
  const viewAllHref = props.viewAllHref || localePath(locale, "works");

  return (
    <Section>
      <SectionHeading kicker={props.kicker} title={props.title} description={props.description} />
      <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <p className="flex items-start gap-3 text-sm font-semibold leading-7 text-amber-900">
          <Info className="mt-1 h-4.5 w-4.5 shrink-0" aria-hidden="true" />
          {disclaimer}
        </p>
      </div>
      <div className="mt-8 grid gap-6 md:grid-cols-3">
        {(props.cases ?? []).map((c) => (
          <article
            key={c.key}
            className="flex flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-sm transition-shadow hover:shadow-md"
          >
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
        <BlockLink
          href={viewAllHref}
          locale={locale}
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-navy px-6 text-sm font-semibold text-white transition-colors hover:bg-navy-soft"
        >
          {viewAllLabel}
        </BlockLink>
      </div>
    </Section>
  );
}
