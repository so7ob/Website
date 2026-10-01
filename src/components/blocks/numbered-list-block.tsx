"use client";

import { Section } from "@/components/site/section";
import { type z } from "zod";
import type { blockSchemas } from "@/lib/blocks/types";
import type { Locale } from "@/lib/i18n";

export type NumberedListBlockProps = z.input<typeof blockSchemas.numberedList>["props"];

/** قائمة مبادئ مرقمة (من AboutPage) */
export function NumberedListBlock({ props }: { props: NumberedListBlockProps; locale: Locale }) {
  const items = props.items ?? [];

  return (
    <Section>
      <div>
        <h2 className="text-2xl font-bold text-navy sm:text-3xl">{props.title}</h2>
        <ol className="mt-8 space-y-4">
          {items.map((p, i) => (
            <li key={`${i}-${p.title}`} className="flex gap-5 rounded-2xl border border-border bg-white p-6">
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
    </Section>
  );
}
