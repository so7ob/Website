import Link from "next/link";
import { Eye, Target, Compass, Quote } from "lucide-react";
import { Section } from "@/components/site/section";
import { localePath, type Locale } from "@/lib/i18n";
import type { SiteContent } from "@/content/types";

function PageHero({ content }: { content: SiteContent }) {
  return (
    <header className="relative overflow-hidden border-b border-border bg-white">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -top-16 end-[8%] h-56 w-56 rounded-full bg-brand-soft blur-3xl opacity-70" />
        <span className="absolute bottom-4 start-[4%] hidden select-none font-mono text-6xl font-bold text-navy/5 lg:block">{"{ }"}</span>
      </div>
      <div className="relative mx-auto max-w-4xl px-4 py-14 text-center sm:px-6 sm:py-20">
        <p className="mb-4 inline-block rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-brand-strong">
          {content.about.kicker}
        </p>
        <h1 className="text-balance text-3xl font-bold leading-snug text-navy sm:text-4xl lg:text-[2.75rem]">
          {content.about.title}
        </h1>
        <div className="mx-auto mt-7 max-w-2xl space-y-4">
          {content.about.intro.map((p, i) => (
            <p key={i} className="text-pretty text-base leading-9 text-muted-foreground">
              {p}
            </p>
          ))}
        </div>
      </div>
    </header>
  );
}

export function AboutPage({ locale, content }: { locale: Locale; content: SiteContent }) {
  const a = content.about;
  return (
    <>
      <PageHero content={content} />

      <Section>
        {/* الرؤية والرسالة */}
        <div className="grid gap-6 md:grid-cols-2">
          <article className="rounded-2xl border border-border bg-navy p-8 text-white">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-skydrop">
              <Eye className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
            </span>
            <h2 className="mt-5 text-xl font-bold">{a.vision.title}</h2>
            <p className="mt-3 text-pretty leading-8 text-white/75">{a.vision.body}</p>
          </article>
          <article className="rounded-2xl border border-border bg-white p-8">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-brand-strong">
              <Target className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
            </span>
            <h2 className="mt-5 text-xl font-bold text-navy">{a.mission.title}</h2>
            <p className="mt-3 text-pretty leading-8 text-muted-foreground">{a.mission.body}</p>
          </article>
        </div>

        {/* القيم */}
        <div className="mt-16">
          <h2 className="text-2xl font-bold text-navy sm:text-3xl">{a.valuesTitle}</h2>
          <p className="mt-3 max-w-2xl leading-8 text-muted-foreground">{a.valuesIntro}</p>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {a.values.map((v, i) => (
              <li key={v.title} className="rounded-2xl border border-border bg-white p-6">
                <span className="font-mono text-sm font-bold text-brand" aria-hidden="true">
                  0{i + 1}
                </span>
                <h3 className="mt-2 text-lg font-bold text-navy">{v.title}</h3>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">{v.body}</p>
              </li>
            ))}
            <li className="flex items-center justify-center rounded-2xl border-2 border-dashed border-skydrop/50 bg-accent/40 p-6 text-center">
              <Quote className="me-2 h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
              <span className="text-sm font-semibold leading-7 text-brand-strong">{a.honesty}</span>
            </li>
          </ul>
        </div>

        {/* المبادئ */}
        <div className="mt-16">
          <h2 className="text-2xl font-bold text-navy sm:text-3xl">{a.principlesTitle}</h2>
          <ol className="mt-8 space-y-4">
            {a.principles.map((p, i) => (
              <li key={p.title} className="flex gap-5 rounded-2xl border border-border bg-white p-6">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-navy font-mono text-sm font-bold text-skydrop">
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-bold text-navy">{p.title}</h3>
                  <p className="mt-1.5 text-sm leading-7 text-muted-foreground">{p.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* دعوة للانتقال */}
        <div className="mt-14 flex flex-col items-center gap-4 rounded-2xl bg-accent/50 p-8 text-center sm:flex-row sm:justify-between sm:text-start">
          <p className="flex items-center gap-3 text-base font-semibold text-navy">
            <Compass className="h-5 w-5 text-brand" aria-hidden="true" />
            {content.services.title}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href={localePath(locale, "services")}
              className="inline-flex min-h-11 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-brand-strong"
            >
              {content.nav.services}
            </Link>
            <Link
              href={localePath(locale, "process")}
              className="inline-flex min-h-11 items-center rounded-full border border-brand/30 bg-white px-5 text-sm font-semibold text-brand transition-colors hover:border-brand"
            >
              {content.nav.process}
            </Link>
          </div>
        </div>
      </Section>
    </>
  );
}
