import { Info } from "lucide-react";
import { Section } from "@/components/site/section";
import { CaseVisual } from "@/components/works/case-visual";
import { BookingPrototype } from "@/components/works/booking-prototype";
import type { Locale } from "@/lib/i18n";
import type { SiteContent } from "@/content/types";

export function WorksPage({ locale, content }: { locale: Locale; content: SiteContent }) {
  const w = content.works;
  return (
    <>
      <header className="border-b border-border bg-white">
        <div className="mx-auto max-w-4xl px-4 py-14 text-center sm:px-6 sm:py-20">
          <p className="mb-4 inline-block rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-brand-strong">{w.kicker}</p>
          <h1 className="text-balance text-3xl font-bold leading-snug text-navy sm:text-4xl">{w.title}</h1>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-base leading-9 text-muted-foreground">{w.intro}</p>
        </div>
      </header>

      <Section>
        {/* إخلاء المسؤولية الظاهر — شرط أساسي للصدق */}
        <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-6 sm:p-8">
          <p className="flex items-start gap-3 text-base font-bold leading-8 text-amber-900">
            <Info className="mt-1.5 h-5 w-5 shrink-0" aria-hidden="true" />
            {w.disclaimer.title}
          </p>
          <p className="mt-3 ps-8 text-sm leading-8 text-amber-800">{w.disclaimer.body}</p>
        </div>

        <div className="mt-12 space-y-12">
          {w.cases.map((c, i) => (
            <article
              key={c.key}
              id={c.key}
              className="scroll-mt-24 overflow-hidden rounded-3xl border border-border bg-white"
            >
              <div className={`grid lg:grid-cols-2 ${i % 2 === 1 ? "lg:[&>div:first-child]:order-2" : ""}`}>
                {/* المرئيات */}
                <div className="flex flex-col justify-center bg-background/60 p-6 sm:p-10">
                  {c.kind === "interactive" ? (
                    <>
                      <BookingPrototype locale={locale} />
                      <p className="mt-4 text-center text-xs leading-6 text-muted-foreground">{w.interactiveNote}</p>
                    </>
                  ) : (
                    <>
                      <CaseVisual kind={c.kind} label={c.title} />
                      {c.kind === "flow" && <p className="mt-4 text-center text-xs leading-6 text-muted-foreground">{w.flowNote}</p>}
                    </>
                  )}
                </div>

                {/* التفاصيل */}
                <div className="p-7 sm:p-10">
                  <span
                    className={`inline-flex items-center rounded-full px-3.5 py-1.5 text-xs font-bold ${
                      c.kind === "interactive"
                        ? "bg-green-100 text-green-800"
                        : c.kind === "flow"
                          ? "bg-violet-100 text-violet-800"
                          : "bg-accent text-brand-strong"
                    }`}
                  >
                    {w.statuses[c.kind]}
                  </span>
                  <h2 className="mt-4 text-balance text-2xl font-bold leading-snug text-navy">{c.title}</h2>
                  <p className="mt-3 text-pretty text-[15px] leading-8 text-muted-foreground">{c.summary}</p>

                  <dl className="mt-7 space-y-6">
                    <div>
                      <dt className="text-sm font-bold uppercase tracking-wider text-brand">{w.labels.problem}</dt>
                      <dd className="mt-2 text-[15px] leading-8 text-muted-foreground">{c.problem}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-bold uppercase tracking-wider text-brand">{w.labels.users}</dt>
                      <dd className="mt-2 text-[15px] leading-8 text-muted-foreground">{c.users}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-bold uppercase tracking-wider text-brand">{w.labels.functions}</dt>
                      <dd className="mt-3">
                        <ul className="space-y-2.5">
                          {c.functions.map((f) => (
                            <li key={f} className="flex items-start gap-2.5 text-[15px] leading-7 text-muted-foreground">
                              <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-skydrop" aria-hidden="true" />
                              {f}
                            </li>
                          ))}
                        </ul>
                      </dd>
                    </div>
                    <div className="border-t border-border pt-5">
                      <dt className="text-sm font-bold uppercase tracking-wider text-muted-foreground">{w.labels.status}</dt>
                      <dd className="mt-2 text-sm font-semibold text-foreground">{w.statuses[c.kind]}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            </article>
          ))}
        </div>
      </Section>
    </>
  );
}
