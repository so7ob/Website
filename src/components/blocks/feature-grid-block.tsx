"use client";

import { Section, SectionHeading } from "@/components/site/section";
import { type z } from "zod";
import type { blockSchemas } from "@/lib/blocks/types";
import type { Locale } from "@/lib/i18n";

export type FeatureGridBlockProps = z.input<typeof blockSchemas.featureGrid>["props"];

/** «ما الذي يميز طريقة العمل» — صفوف بيان/شرح مرقمة (الأصل HomeWhy) */
export function FeatureGridBlock({ props }: { props: FeatureGridBlockProps; locale: Locale }) {
  const items = props.items ?? [];
  const columns = props.columns ?? "3";

  return (
    <Section>
      <SectionHeading kicker={props.kicker} title={props.title} />
      <ol className={columns === "2" ? "mt-12 grid gap-8 md:grid-cols-2" : "mt-12 space-y-8"}>
        {items.map((item, i) => (
          <li
            key={`${i}-${item.title}`}
            className="relative rounded-2xl border border-border bg-white p-7 sm:p-9 md:ms-16"
          >
            <span
              className="absolute -start-16 top-7 hidden h-12 w-12 select-none items-center justify-center rounded-xl bg-navy font-mono text-2xl font-bold text-skydrop md:flex"
              aria-hidden="true"
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="grid gap-3 md:grid-cols-[1fr_1.4fr] md:gap-10">
              <h3 className="text-pretty text-xl font-bold leading-9 text-navy">
                <span className="me-2 font-mono text-brand md:hidden" aria-hidden="true">
                  {String(i + 1).padStart(2, "0")} —
                </span>
                {item.title}
              </h3>
              <p className="text-pretty text-[15px] leading-8 text-muted-foreground">{item.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </Section>
  );
}
