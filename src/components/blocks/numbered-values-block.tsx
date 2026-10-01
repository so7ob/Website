"use client";

import { Quote } from "lucide-react";
import { Section } from "@/components/site/section";
import { type z } from "zod";
import type { blockSchemas } from "@/lib/blocks/types";
import type { Locale } from "@/lib/i18n";

export type NumberedValuesBlockProps = z.input<typeof blockSchemas.numberedValues>["props"];

/** القيم المرقمة + بطاقة الصدق المتقطعة (من AboutPage) */
export function NumberedValuesBlock({ props }: { props: NumberedValuesBlockProps; locale: Locale }) {
  const items = props.items ?? [];

  return (
    <Section>
      <div>
        <h2 className="text-2xl font-bold text-navy sm:text-3xl">{props.title}</h2>
        {props.intro && <p className="mt-3 max-w-2xl leading-8 text-muted-foreground">{props.intro}</p>}
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((v, i) => (
            <li key={`${i}-${v.title}`} className="rounded-2xl border border-border bg-white p-6">
              <span className="font-mono text-sm font-bold text-brand" aria-hidden="true">
                0{i + 1}
              </span>
              <h3 className="mt-2 text-lg font-bold text-navy">{v.title}</h3>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">{v.body}</p>
            </li>
          ))}
          {props.closingNote && (
            <li className="flex items-center justify-center rounded-2xl border-2 border-dashed border-skydrop/50 bg-accent/40 p-6 text-center">
              <Quote className="me-2 h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
              <span className="text-sm font-semibold leading-7 text-brand-strong">{props.closingNote}</span>
            </li>
          )}
        </ul>
      </div>
    </Section>
  );
}
