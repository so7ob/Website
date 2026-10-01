"use client";

import { type z } from "zod";
import type { blockSchemas } from "@/lib/blocks/types";
import type { Locale } from "@/lib/i18n";
import { BlockLink } from "./block-link";

export type CtaSectionBlockProps = z.input<typeof blockSchemas.ctaSection>["props"];

/** أنماط الأزرار على الخلفية الكحلية الداكنة (من الأصل FinalCta) */
const VARIANT_CLASSES: Record<string, string> = {
  primary:
    "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-skydrop px-7 text-base font-bold text-navy transition-colors hover:bg-sky-300 sm:w-auto",
  outline:
    "inline-flex min-h-12 w-full items-center justify-center rounded-full border-2 border-white/25 px-7 text-base font-semibold text-white transition-colors hover:border-skydrop hover:text-skydrop sm:w-auto",
  navy: "inline-flex min-h-12 w-full items-center justify-center rounded-full bg-white px-7 text-base font-semibold text-navy transition-colors hover:bg-white/90 sm:w-auto",
};

/** الدعوة الختامية «ما الذي تريد إنجازه؟» — شريط كحلي برسمة زخرفية (الأصل FinalCta) */
export function CtaSectionBlock({ props, locale }: { props: CtaSectionBlockProps; locale: Locale }) {
  const notes = [props.discussNote, props.quoteNote].filter(Boolean).join(" · ");

  return (
    <section className="relative overflow-hidden bg-navy py-16 sm:py-20 lg:py-24">
      {/* زخارف خفيفة */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -top-20 start-[10%] h-64 w-64 rounded-full bg-skydrop/10 blur-3xl" />
        <div className="absolute bottom-0 end-[5%] h-72 w-72 rounded-full bg-digital/20 blur-3xl opacity-60" />
        <span className="absolute top-10 end-[8%] hidden select-none font-mono text-7xl font-bold text-white/5 lg:block">{"{"}</span>
        <span className="absolute bottom-8 start-[6%] hidden select-none font-mono text-7xl font-bold text-white/5 lg:block">{"}"}</span>
      </div>

      <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
        <h2 className="text-balance text-3xl font-bold leading-snug text-white sm:text-4xl">{props.title}</h2>
        <p className="mx-auto mt-5 max-w-xl text-pretty text-base leading-8 text-white/70">{props.body}</p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          {(props.links ?? []).map((link, i) => (
            <BlockLink
              key={`${i}-${link.label}`}
              href={link.href}
              locale={locale}
              className={VARIANT_CLASSES[link.variant ?? "primary"] ?? VARIANT_CLASSES.primary}
            >
              {link.label}
            </BlockLink>
          ))}
        </div>
        {notes && <p className="mt-6 text-xs leading-6 text-white/50">{notes}</p>}
      </div>
    </section>
  );
}
