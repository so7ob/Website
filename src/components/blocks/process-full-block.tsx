"use client";

import Link from "next/link";
import { UserCheck, PackageCheck, GitPullRequestArrow } from "lucide-react";
import { Section } from "@/components/site/section";
import { localePath, type Locale } from "@/lib/i18n";
import { ar } from "@/content/ar";
import { en } from "@/content/en";
import { type z } from "zod";
import type { blockSchemas } from "@/lib/blocks/types";

export type ProcessFullBlockProps = z.input<typeof blockSchemas.processFull>["props"];

/** مراحل العمل الكاملة + إدارة التغييرات (من ProcessPage) */
export function ProcessFullBlock({ props, locale }: { props: ProcessFullBlockProps; locale: Locale }) {
  const t = locale === "en" ? en : ar;
  const changes = props.changes;
  const timelineClass = `relative space-y-10 before:absolute before:bottom-10 before:start-7 before:top-10 before:border-s-2 before:border-dashed before:border-skydrop/50 sm:space-y-12 ${
    props.intro ? "mt-12" : ""
  }`;

  return (
    <Section>
      {props.intro && (
        <p className="max-w-2xl text-pretty text-base leading-9 text-muted-foreground">{props.intro}</p>
      )}

      {/* خط الزمن العملي */}
      <ol className={timelineClass}>
        {(props.phases ?? []).map((phase, i) => (
          <li key={`${i}-${phase.title}`} className="relative ps-16 sm:ps-24">
            <span
              className="absolute start-0 top-0 flex h-14 w-14 items-center justify-center rounded-2xl bg-navy font-mono text-xl font-bold text-skydrop shadow-md"
              aria-hidden="true"
            >
              {i + 1}
            </span>
            <div className="rounded-3xl border border-border bg-white p-7 sm:p-9">
              <h2 className="text-xl font-bold text-navy sm:text-2xl">{phase.title}</h2>
              <p className="mt-2 text-[15px] font-medium leading-8 text-brand-strong">{phase.goal}</p>

              <div className="mt-6 grid gap-7 lg:grid-cols-[1.2fr_0.8fr]">
                <div>
                  <ul className="space-y-2.5">
                    {phase.weDo.map((item) => (
                      <li key={item} className="flex items-start gap-2.5 text-[15px] leading-7 text-muted-foreground">
                        <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-skydrop" aria-hidden="true" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-5 rounded-2xl bg-background p-5">
                  <div>
                    <h3 className="flex items-center gap-2 text-sm font-bold text-navy">
                      <UserCheck className="h-4 w-4 text-brand" aria-hidden="true" />
                      {props.labels.clientRole}
                    </h3>
                    <p className="mt-2 text-sm leading-7 text-muted-foreground">{phase.clientRole}</p>
                  </div>
                  <div>
                    <h3 className="flex items-center gap-2 text-sm font-bold text-navy">
                      <PackageCheck className="h-4 w-4 text-brand" aria-hidden="true" />
                      {props.labels.deliverables}
                    </h3>
                    <ul className="mt-2 space-y-1.5">
                      {phase.deliverables.map((d) => (
                        <li key={d} className="flex items-start gap-2.5 text-sm leading-7 text-muted-foreground">
                          <CheckMini />
                          {d}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ol>

      {/* إدارة التغييرات */}
      {changes && (
        <div className="mt-16 overflow-hidden rounded-3xl bg-navy p-8 text-white sm:p-12">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14">
            <div>
              <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-sm font-semibold text-skydrop">
                <GitPullRequestArrow className="h-4 w-4" aria-hidden="true" />
                {changes.kicker}
              </p>
              <h2 className="text-balance text-2xl font-bold leading-snug sm:text-3xl">{changes.title}</h2>
              <p className="mt-4 text-pretty text-[15px] leading-8 text-white/70">{changes.body}</p>
            </div>
            <ol className="space-y-4">
              {changes.items.map((item, i) => (
                <li key={`${i}-${item}`} className="flex items-start gap-4 rounded-2xl bg-white/5 p-4">
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-skydrop/15 font-mono text-sm font-bold text-skydrop"
                    aria-hidden="true"
                  >
                    {i + 1}
                  </span>
                  <p className="text-sm leading-7 text-white/85">{item}</p>
                </li>
              ))}
            </ol>
          </div>
          <div className="mt-9 border-t border-white/10 pt-7">
            <p className="text-lg font-bold">{t.home.finalCta.title}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href={`${localePath(locale, "contact")}?type=discussion`}
                className="inline-flex min-h-11 items-center rounded-full bg-skydrop px-6 text-sm font-bold text-navy transition-colors hover:bg-sky-300"
              >
                {t.actions.discuss}
              </Link>
              <Link
                href={`${localePath(locale, "contact")}?type=quote`}
                className="inline-flex min-h-11 items-center rounded-full border-2 border-white/25 px-6 text-sm font-semibold text-white transition-colors hover:border-skydrop hover:text-skydrop"
              >
                {t.actions.quote}
              </Link>
            </div>
          </div>
        </div>
      )}
    </Section>
  );
}

function CheckMini() {
  return (
    <svg className="mt-2 h-3.5 w-3.5 shrink-0 text-brand" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 8.5L6.5 12L13 4.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
