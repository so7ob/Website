"use client";

import { Section, SectionHeading } from "@/components/site/section";
import { FaqAccordion } from "@/components/site/faq-accordion";
import { localePath, type Locale } from "@/lib/i18n";
import { ar } from "@/content/ar";
import { en } from "@/content/en";
import { type z } from "zod";
import type { blockSchemas } from "@/lib/blocks/types";
import { BlockLink } from "./block-link";

export type FaqSectionBlockProps = z.input<typeof blockSchemas.faqSection>["props"];

/** أسئلة شائعة مختارة (الأصل HomeFaq) — الأكورديون تفاعلي لكن القسم نفسه خادم */
export function FaqSectionBlock({ props, locale }: { props: FaqSectionBlockProps; locale: Locale }) {
  const t = locale === "en" ? en : ar;
  const items = props.limit ? props.items.slice(0, props.limit) : props.items;
  const ctaLabel = props.ctaLabel ?? t.actions.viewAllFaq;
  const ctaHref = props.ctaHref || localePath(locale, "faq");

  return (
    <Section className="bg-white">
      <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
        <div>
          <SectionHeading kicker={props.kicker} title={props.title} description={props.description} />
          <BlockLink
            href={ctaHref}
            locale={locale}
            className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-background px-5 text-sm font-semibold text-navy transition-colors hover:border-brand hover:text-brand"
          >
            {ctaLabel}
          </BlockLink>
        </div>
        <FaqAccordion items={items} />
      </div>
    </Section>
  );
}
