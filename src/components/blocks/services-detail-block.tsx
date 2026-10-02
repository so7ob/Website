"use client";

import Link from "next/link";
import { Check, CircleAlert } from "lucide-react";
import { Section } from "@/components/site/section";
import { ServiceIcon } from "@/components/site/service-icon";
import { localePath, type Locale } from "@/lib/i18n";
import { ar } from "@/content/ar";
import { en } from "@/content/en";
import { type z } from "zod";
import type { blockSchemas } from "@/lib/blocks/types";
import type { ServiceType } from "@/lib/validation";

export type ServicesDetailBlockProps = z.input<typeof blockSchemas.servicesDetail>["props"];

/** تفاصيل الخدمات الموسعة — مقالات بمرساة لكل خدمة (من ServicesPage) */
export function ServicesDetailBlock({ props, locale }: { props: ServicesDetailBlockProps; locale: Locale }) {
  const t = locale === "en" ? en : ar;
  const requestLabel = props.requestLabel ?? t.actions.requestService;

  return (
    <Section>
      <div className="space-y-10">
        {(props.items ?? []).map((item, i) => (
          <article
            key={item.service}
            id={item.service}
            className="scroll-mt-24 overflow-hidden rounded-3xl border border-border bg-white"
          >
            <div className={`grid lg:grid-cols-[0.9fr_1.1fr] ${i % 2 === 1 ? "lg:[&>*:first-child]:order-2" : ""}`}>
              {/* رأس الخدمة */}
              <div className="relative bg-gradient-to-br from-navy to-navy-soft p-8 text-white sm:p-10">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-skydrop">
                  <ServiceIcon service={item.service as ServiceType} />
                </span>
                <h2 className="mt-5 text-balance text-2xl font-bold leading-snug">{item.name}</h2>
                <p className="mt-4 text-pretty text-[15px] leading-8 text-white/75">{item.definition}</p>
                <div className="mt-7">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-white/50">{props.labels.forWhom}</h3>
                  <p className="mt-2.5 text-pretty text-sm leading-7 text-white/80">{item.forWhom}</p>
                </div>
              </div>

              {/* المشكلات والمخرجات */}
              <div className="p-8 sm:p-10">
                <div>
                  <h3 className="flex items-center gap-2 text-base font-bold text-navy">
                    <CircleAlert className="h-4.5 w-4.5 text-digital" strokeWidth={2} aria-hidden="true" />
                    {props.labels.problems}
                  </h3>
                  <ul className="mt-4 space-y-2.5">
                    {item.problems.map((p) => (
                      <li key={p} className="flex items-start gap-2.5 text-[15px] leading-7 text-muted-foreground">
                        <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-digital/70" aria-hidden="true" />
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="mt-7 border-t border-border pt-7">
                  <h3 className="flex items-center gap-2 text-base font-bold text-navy">
                    <Check className="h-4.5 w-4.5 text-brand" strokeWidth={2.5} aria-hidden="true" />
                    {props.labels.deliverables}
                  </h3>
                  <ul className="mt-4 space-y-2.5">
                    {item.deliverables.map((d) => (
                      <li key={d} className="flex items-start gap-2.5 text-[15px] leading-7 text-muted-foreground">
                        <Check className="mt-1.5 h-4 w-4 shrink-0 text-brand" strokeWidth={2.5} aria-hidden="true" />
                        {d}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="mt-8">
                  <Link
                    href={`${localePath(locale, "contact")}?service=${item.service}&type=quote`}
                    className="inline-flex min-h-12 items-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-brand-strong"
                  >
                    {requestLabel}
                    <span aria-hidden="true">{locale === "ar" ? "←" : "→"}</span>
                  </Link>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </Section>
  );
}
