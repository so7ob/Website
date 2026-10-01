"use client";

import { Section, SectionHeading } from "@/components/site/section";
import { type z } from "zod";
import type { blockSchemas } from "@/lib/blocks/types";
import type { Locale } from "@/lib/i18n";

export type ProcessStepsBlockProps = z.input<typeof blockSchemas.processSteps>["props"];

/** خطوات التنفيذ السريعة — مسار نقاط متصلة (الأصل HomeProcess) */
export function ProcessStepsBlock({ props }: { props: ProcessStepsBlockProps; locale: Locale }) {
  const steps = props.steps ?? [];

  return (
    <Section className="bg-white">
      <SectionHeading kicker={props.kicker} title={props.title} align="center" />
      <ol className="relative mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
        {/* الخط الواصل — أفقي على الشاشات الكبيرة */}
        <div className="absolute inset-x-16 top-6 hidden border-t-2 border-dashed border-skydrop/40 lg:block" aria-hidden="true" />
        {steps.map((step, i) => (
          <li key={`${i}-${step.title}`} className="relative text-center lg:text-start">
            <span
              className="relative z-10 mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-navy font-mono text-lg font-bold text-skydrop shadow-md lg:mx-0"
              aria-hidden="true"
            >
              {i + 1}
            </span>
            <h3 className="mt-5 text-lg font-bold text-navy">{step.title}</h3>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">{step.line}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}
