"use client";

import { Section } from "@/components/site/section";
import { type z } from "zod";
import type { blockSchemas } from "@/lib/blocks/types";
import type { Locale } from "@/lib/i18n";
import { EditableText } from "./inline-edit-context";

export type NumberedListBlockProps = z.input<typeof blockSchemas.numberedList>["props"];

/** قائمة مبادئ مرقمة (من AboutPage) */
export function NumberedListBlock({ props }: { props: NumberedListBlockProps; locale: Locale }) {
  const items = props.items ?? [];

  return (
    <Section>
      <div>
        <EditableText
          field="title"
          value={props.title}
          as="h2"
          primary
          className="text-balance text-2xl font-bold text-navy sm:text-3xl"
        />
        <ol className="mt-8 space-y-4">
          {items.map((p, i) => (
            <li key={`${i}-${p.title}`} className="flex gap-5 rounded-2xl border border-border bg-white p-6">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-navy font-mono text-sm font-bold text-skydrop">
                {i + 1}
              </span>
              <div>
                <h3 className="font-bold text-navy">
                  <EditableText
                    field={`items:${i}.title`}
                    value={p.title}
                    as="span"
                    className="rounded-sm outline-none"
                  />
                </h3>
                <EditableText
                  field={`items:${i}.body`}
                  value={p.body}
                  as="p"
                  className="mt-1.5 text-sm leading-7 text-muted-foreground"
                />
              </div>
            </li>
          ))}
        </ol>
      </div>
    </Section>
  );
}
