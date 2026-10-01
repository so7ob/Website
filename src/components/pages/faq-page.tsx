import Link from "next/link";
import { Section } from "@/components/site/section";
import { FaqAccordion } from "@/components/site/faq-accordion";
import { localePath, type Locale } from "@/lib/i18n";
import type { SiteContent } from "@/content/types";

export function FaqPage({ locale, content }: { locale: Locale; content: SiteContent }) {
  const f = content.faq;
  return (
    <>
      <header className="border-b border-border bg-white">
        <div className="mx-auto max-w-4xl px-4 py-14 text-center sm:px-6 sm:py-20">
          <p className="mb-4 inline-block rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-brand-strong">{f.kicker}</p>
          <h1 className="text-balance text-3xl font-bold leading-snug text-navy sm:text-4xl">{f.title}</h1>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-base leading-9 text-muted-foreground">{f.intro}</p>
        </div>
      </header>

      <Section>
        <div className="mx-auto max-w-3xl">
          <FaqAccordion items={f.items} />

          <div className="mt-12 rounded-2xl bg-accent/50 p-7 text-center">
            <p className="text-base font-semibold text-navy">{content.contact.description}</p>
            <Link
              href={localePath(locale, "contact")}
              className="mt-4 inline-flex min-h-11 items-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground transition-colors hover:bg-brand-strong"
            >
              {content.nav.contact}
            </Link>
          </div>
        </div>
      </Section>
    </>
  );
}
