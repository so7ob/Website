import Link from "next/link";
import { Check, CircleAlert } from "lucide-react";
import { Section } from "@/components/site/section";
import { ServiceIcon } from "@/components/site/service-icon";
import { localePath, type Locale } from "@/lib/i18n";
import type { SiteContent } from "@/content/types";

export function ServicesPage({ locale, content }: { locale: Locale; content: SiteContent }) {
  const s = content.services;
  return (
    <>
      <header className="relative overflow-hidden border-b border-border bg-white">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute -top-16 start-[10%] h-56 w-56 rounded-full bg-brand-soft blur-3xl opacity-70" />
        </div>
        <div className="relative mx-auto max-w-4xl px-4 py-14 text-center sm:px-6 sm:py-20">
          <p className="mb-4 inline-block rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-brand-strong">{s.kicker}</p>
          <h1 className="text-balance text-3xl font-bold leading-snug text-navy sm:text-4xl">{s.title}</h1>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-base leading-9 text-muted-foreground">{s.intro}</p>
          {/* روابط قفز سريع للخدمات */}
          <nav aria-label={s.kicker} className="mt-8 flex flex-wrap justify-center gap-2">
            {s.items.map((item) => (
              <a
                key={item.service}
                href={`#${item.service}`}
                className="inline-flex min-h-9 items-center rounded-full border border-border bg-background px-3.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-brand hover:text-brand"
              >
                {item.name}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <Section>
        <div className="space-y-10">
          {s.items.map((item, i) => (
            <article
              key={item.service}
              id={item.service}
              className="scroll-mt-24 overflow-hidden rounded-3xl border border-border bg-white"
            >
              <div className={`grid lg:grid-cols-[0.9fr_1.1fr] ${i % 2 === 1 ? "lg:[&>*:first-child]:order-2" : ""}`}>
                {/* رأس الخدمة */}
                <div className="relative bg-gradient-to-br from-navy to-navy-soft p-8 text-white sm:p-10">
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-skydrop">
                    <ServiceIcon service={item.service} />
                  </span>
                  <h2 className="mt-5 text-balance text-2xl font-bold leading-snug">{item.name}</h2>
                  <p className="mt-4 text-pretty text-[15px] leading-8 text-white/75">{item.definition}</p>
                  <div className="mt-7">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-white/50">{s.labels.forWhom}</h3>
                    <p className="mt-2.5 text-pretty text-sm leading-7 text-white/80">{item.forWhom}</p>
                  </div>
                </div>

                {/* المشكلات والمخرجات */}
                <div className="p-8 sm:p-10">
                  <div>
                    <h3 className="flex items-center gap-2 text-base font-bold text-navy">
                      <CircleAlert className="h-4.5 w-4.5 text-digital" strokeWidth={2} aria-hidden="true" />
                      {s.labels.problems}
                    </h3>
                    <ul className="mt-4 space-y-2.5">
                      {item.problems.map((p) => (
                        <li key={p} className="flex items-start gap-2.5 text-[15px] leading-7 text-muted-foreground">
                          <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-digital/70" aria-hidden="true" />
                          {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="mt-7 border-t border-border pt-7">
                    <h3 className="flex items-center gap-2 text-base font-bold text-navy">
                      <Check className="h-4.5 w-4.5 text-brand" strokeWidth={2.5} aria-hidden="true" />
                      {s.labels.deliverables}
                    </h3>
                    <ul className="mt-4 space-y-2.5">
                      {item.deliverables.map((d) => (
                        <li key={d} className="flex items-start gap-2.5 text-[15px] leading-7 text-muted-foreground">
                          <Check className="mt-1.5 h-4 w-4 shrink-0 text-brand" strokeWidth={2.5} aria-hidden="true" />
                          {d}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="mt-8">
                    <Link
                      href={`${localePath(locale, "contact")}?service=${item.service}&type=quote`}
                      className="inline-flex min-h-12 items-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-brand-strong"
                    >
                      {content.actions.requestService}
                      <span aria-hidden="true">{locale === "ar" ? "←" : "→"}</span>
                    </Link>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </Section>
    </>
  );
}
