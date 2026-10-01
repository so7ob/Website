import Link from "next/link";
import { Section, SectionHeading } from "@/components/site/section";
import { ServiceIcon } from "@/components/site/service-icon";
import { localePath, type Locale } from "@/lib/i18n";
import type { SiteContent } from "@/content/types";

/** قسم الخدمات في الرئيسية: شبكة غير متماثلة — بطاقتان بارزتان + أربع مكثفة */
export function HomeServices({ locale, content }: { locale: Locale; content: SiteContent }) {
  const s = content.home.services;
  const items = s.cards.map((c) => ({
    ...c,
    full: content.services.items.find((i) => i.service === c.service)!,
  }));
  const [first, second, ...rest] = items;

  return (
    <Section className="bg-white">
      <SectionHeading kicker={s.kicker} title={s.title} description={s.description} />
      <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {[first, second].map((card) => (
          <Link
            key={card.service}
            href={`${localePath(locale, "services")}#${card.service}`}
            className="group relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-navy to-navy-soft p-7 text-white transition-transform hover:-translate-y-1"
          >
            <div className="absolute -end-10 -top-10 h-36 w-36 rounded-full bg-skydrop/10 blur-2xl" aria-hidden="true" />
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-skydrop">
              <ServiceIcon service={card.service} />
            </span>
            <h3 className="mt-5 text-xl font-bold">{card.full.name}</h3>
            <p className="mt-3 text-sm leading-7 text-white/75">{card.blurb}</p>
            <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-skydrop">
              {content.actions.learnMore}
              <Chevron locale={locale} />
            </span>
          </Link>
        ))}
        {rest.map((card) => (
          <Link
            key={card.service}
            href={`${localePath(locale, "services")}#${card.service}`}
            className="group rounded-2xl border border-border bg-background p-6 transition-all hover:border-brand/40 hover:shadow-md"
          >
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-brand-strong">
              <ServiceIcon service={card.service} />
            </span>
            <h3 className="mt-4 text-base font-bold text-navy">{card.full.name}</h3>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">{card.blurb}</p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand">
              {content.actions.learnMore}
              <Chevron locale={locale} />
            </span>
          </Link>
        ))}
      </div>
      <div className="mt-8">
        <Link
          href={localePath(locale, "services")}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-white px-5 text-sm font-semibold text-navy transition-colors hover:border-brand hover:text-brand"
        >
          {content.actions.viewAllServices}
        </Link>
      </div>
    </Section>
  );
}

function Chevron({ locale }: { locale: Locale }) {
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
