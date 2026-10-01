import { Suspense } from "react";
import Link from "next/link";
import { MailCheck, MessagesSquare, ClipboardList } from "lucide-react";
import { Section } from "@/components/site/section";
import { ProjectRequestForm, SuspenseFallback } from "@/components/form/project-request-form";
import { localePath, type Locale } from "@/lib/i18n";
import type { SiteContent } from "@/content/types";

const NEXT_ICONS = [ClipboardList, MessagesSquare, MailCheck];

export function ContactPage({ locale, content }: { locale: Locale; content: SiteContent }) {
  const c = content.contact;
  return (
    <>
      <header className="relative overflow-hidden border-b border-border bg-white">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute -top-16 start-[15%] h-56 w-56 rounded-full bg-brand-soft blur-3xl opacity-70" />
        </div>
        <div className="relative mx-auto max-w-4xl px-4 py-14 text-center sm:px-6 sm:py-20">
          <p className="mb-4 inline-block rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-brand-strong">{c.kicker}</p>
          <h1 className="text-balance text-3xl font-bold leading-snug text-navy sm:text-4xl">{c.title}</h1>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-base leading-9 text-muted-foreground">{c.description}</p>
        </div>
      </header>

      <Section>
        <div className="grid gap-10 lg:grid-cols-[1.35fr_0.65fr] lg:gap-14">
          <Suspense fallback={<SuspenseFallback />}>
            <ProjectRequestForm locale={locale} content={content} />
          </Suspense>

          <aside className="space-y-8">
            {/* ماذا يحدث بعد الإرسال */}
            <div className="rounded-3xl border border-border bg-white p-7">
              <h2 className="text-lg font-bold text-navy">{c.nextTitle}</h2>
              <ol className="mt-5 space-y-5">
                {c.nextSteps.map((step, i) => {
                  const Icon = NEXT_ICONS[i % NEXT_ICONS.length];
                  return (
                    <li key={step.title} className="flex gap-3.5">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-brand-strong">
                        <Icon className="h-4.5 w-4.5" strokeWidth={1.9} aria-hidden="true" />
                      </span>
                      <div>
                        <p className="text-sm font-bold text-navy">{step.title}</p>
                        <p className="mt-1 text-sm leading-7 text-muted-foreground">{step.body}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>

            {/* إشعار الخصوصية */}
            <div className="rounded-3xl bg-navy p-7 text-white">
              <h2 className="flex items-center gap-2 text-lg font-bold">{c.privacyTitle}</h2>
              <p className="mt-3 text-sm leading-7 text-white/70">{c.privacyBody}</p>
              <ul className="mt-4 space-y-2.5">
                {c.privacyItems.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm leading-7 text-white/80">
                    <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-skydrop" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* رابط مساند */}
            <div className="rounded-3xl border border-border bg-accent/40 p-7">
              <p className="text-sm font-semibold leading-7 text-navy">{content.faq.intro}</p>
              <Link
                href={localePath(locale, "faq")}
                className="mt-4 inline-flex min-h-11 items-center rounded-full border border-brand/30 bg-white px-5 text-sm font-semibold text-brand transition-colors hover:border-brand"
              >
                {content.actions.viewAllFaq}
              </Link>
            </div>
          </aside>
        </div>
      </Section>
    </>
  );
}
