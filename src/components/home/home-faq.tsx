import Link from "next/link";
import { Section, SectionHeading } from "@/components/site/section";
import { FaqAccordion } from "@/components/site/faq-accordion";
import { localePath, type Locale } from "@/lib/i18n";
import type { SiteContent } from "@/content/types";

/** أسئلة شائعة مختارة في الرئيسية */
export function HomeFaq({ locale, content }: { locale: Locale; content: SiteContent }) {
  const f = content.home.faq;
  return (
    <Section className="bg-white">
      <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
        <div>
          <SectionHeading kicker={f.kicker} title={f.title} description={content.faq.intro} />
          <Link
            href={localePath(locale, "faq")}
            className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-background px-5 text-sm font-semibold text-navy transition-colors hover:border-brand hover:text-brand"
          >
            {content.actions.viewAllFaq}
          </Link>
        </div>
        <FaqAccordion items={content.faq.items} selected={f.selected} />
      </div>
    </Section>
  );
}
