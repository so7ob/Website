"use client";

import { Section, SectionHeading } from "@/components/site/section";
import { ServiceIcon } from "@/components/site/service-icon";
import { localePath, type Locale } from "@/lib/i18n";
import { ar } from "@/content/ar";
import { en } from "@/content/en";
import { type z } from "zod";
import type { blockSchemas } from "@/lib/blocks/types";
import type { ServiceType } from "@/lib/validation";
import { BlockLink } from "./block-link";

export type ServicesGridBlockProps = z.input<typeof blockSchemas.servicesGrid>["props"];

/** بطاقات الخدمات — نسخة من HomeServices: بطاقتان بارزتان + بقية مكثفة */
export function ServicesGridBlock({ props, locale }: { props: ServicesGridBlockProps; locale: Locale }) {
  const t = locale === "en" ? en : ar;
  const cards = (props.cards ?? []).map((c) => ({
    ...c,
    name:
      props.items?.find((i) => i.service === c.service)?.name ?? t.form.services[c.service as ServiceType],
  }));
  const learnMore = props.learnMore ?? t.actions.learnMore;
  const viewAllLabel = props.viewAllLabel ?? t.actions.viewAllServices;
  const viewAllHref = props.viewAllHref || localePath(locale, "services");

  const [first, second, ...rest] = cards;
  const featured = second ? [first, second] : first ? [first] : [];

  return (
    <Section className="bg-white">
      <SectionHeading kicker={props.kicker} title={props.title} description={props.description} />
      <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {featured.map((card) => (
          <BlockLink
            key={card.service}
            href={`${localePath(locale, "services")}#${card.service}`}
            locale={locale}
            className="group relative block overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-navy to-navy-soft p-7 text-white transition-transform hover:-translate-y-1"
          >
            <div className="absolute -end-10 -top-10 h-36 w-36 rounded-full bg-skydrop/10 blur-2xl" aria-hidden="true" />
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-skydrop">
              <ServiceIcon service={card.service as ServiceType} />
            </span>
            <h3 className="mt-5 text-xl font-bold">{card.name}</h3>
            <p className="mt-3 text-sm leading-7 text-white/75">{card.blurb}</p>
            <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-skydrop">
              {learnMore}
              <Chevron />
            </span>
          </BlockLink>
        ))}
        {rest.map((card) => (
          <BlockLink
            key={card.service}
            href={`${localePath(locale, "services")}#${card.service}`}
            locale={locale}
            className="group block rounded-2xl border border-border bg-background p-6 transition-all hover:border-brand/40 hover:shadow-md"
          >
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-brand-strong">
              <ServiceIcon service={card.service as ServiceType} />
            </span>
            <h3 className="mt-4 text-base font-bold text-navy">{card.name}</h3>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">{card.blurb}</p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand">
              {learnMore}
              <Chevron />
            </span>
          </BlockLink>
        ))}
      </div>
      <div className="mt-8">
        <BlockLink
          href={viewAllHref}
          locale={locale}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-white px-5 text-sm font-semibold text-navy transition-colors hover:border-brand hover:text-brand"
        >
          {viewAllLabel}
        </BlockLink>
      </div>
    </Section>
  );
}

function Chevron() {
  return (
    <svg
      className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 rtl:rotate-180"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
