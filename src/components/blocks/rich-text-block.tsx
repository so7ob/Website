"use client";

import { Info } from "lucide-react";
import { Section } from "@/components/site/section";
import { type z } from "zod";
import type { blockSchemas } from "@/lib/blocks/types";
import type { Locale } from "@/lib/i18n";

export type RichTextBlockProps = z.input<typeof blockSchemas.richText>["props"];

/** نص غني: عنوان اختياري + مقدمة + فقرات + تنبيه كهرماني اختياري */
export function RichTextBlock({ props }: { props: RichTextBlockProps; locale: Locale }) {
  const align = props.align ?? "start";

  return (
    <Section>
      <div className={align === "center" ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}>
        {props.heading && <h2 className="text-balance text-2xl font-bold text-navy sm:text-3xl">{props.heading}</h2>}
        {props.lead && <p className="mt-4 text-pretty text-lg leading-9 text-foreground/80">{props.lead}</p>}
        <div className={props.heading || props.lead ? "mt-5 space-y-5" : "space-y-5"}>
          {(props.paragraphs ?? []).map((p, i) => (
            <p key={i} className="text-pretty text-base leading-9 text-muted-foreground">
              {p}
            </p>
          ))}
        </div>
        {props.notice && (
          <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <p className="flex items-start gap-3 text-sm font-semibold leading-7 text-amber-900">
              <Info className="mt-1 h-4.5 w-4.5 shrink-0" aria-hidden="true" />
              {props.notice}
            </p>
          </div>
        )}
      </div>
    </Section>
  );
}
