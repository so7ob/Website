"use client";

import { type z } from "zod";
import type { blockSchemas } from "@/lib/blocks/types";
import type { Locale } from "@/lib/i18n";
import { BlockLink } from "./block-link";

export type PageHeaderBlockProps = z.input<typeof blockSchemas.pageHeader>["props"];

/**
 * ترويسة صفحة داخلية — من AboutPage (PageHero) مع صف «روابط قفز» اختياري
 * بأسلوب ترويسة صفحة الخدمات.
 */
export function PageHeaderBlock({ props, locale }: { props: PageHeaderBlockProps; locale: Locale }) {
  const intro = props.intro ?? [];
  const quickLinks = props.quickLinks ?? [];

  return (
    <header className="relative overflow-hidden border-b border-border bg-white">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -top-16 end-[8%] h-56 w-56 rounded-full bg-brand-soft blur-3xl opacity-70" />
        <span className="absolute bottom-4 start-[4%] hidden select-none font-mono text-6xl font-bold text-navy/5 lg:block">{"{ }"}</span>
      </div>
      <div className="relative mx-auto max-w-4xl px-4 py-14 text-center sm:px-6 sm:py-20">
        <p className="mb-4 inline-block rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-brand-strong">
          {props.kicker}
        </p>
        <h1 className="text-balance text-3xl font-bold leading-snug text-navy sm:text-4xl lg:text-[2.75rem]">
          {props.title}
        </h1>
        <div className="mx-auto mt-7 max-w-2xl space-y-4">
          {intro.map((p, i) => (
            <p key={i} className="text-pretty text-base leading-9 text-muted-foreground">
              {p}
            </p>
          ))}
        </div>
        {quickLinks.length > 0 && (
          <nav aria-label={props.kicker} className="mt-8 flex flex-wrap justify-center gap-2">
            {quickLinks.map((l, i) => (
              <BlockLink
                key={`${i}-${l.label}`}
                href={l.href}
                locale={locale}
                className="inline-flex min-h-9 items-center rounded-full border border-border bg-background px-3.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-brand hover:text-brand"
              >
                {l.label}
              </BlockLink>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}
