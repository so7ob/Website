"use client";

import { Mail, Phone, MapPin } from "lucide-react";
import { Section } from "@/components/site/section";
import { type z } from "zod";
import type { blockSchemas } from "@/lib/blocks/types";
import type { Locale } from "@/lib/i18n";
import { BlockLink } from "./block-link";

export type ContactInfoBlockProps = z.input<typeof blockSchemas.contactInfo>["props"];

const CHANNEL_ICONS = { email: Mail, phone: Phone, address: MapPin } as const;

/** بطاقات قنوات التواصل — القنوات ذات href تتحول إلى روابط */
export function ContactInfoBlock({ props, locale }: { props: ContactInfoBlockProps; locale: Locale }) {
  const channels = props.channels ?? [];
  const hasTitle = Boolean(props.title);

  return (
    <Section>
      {props.title && <h2 className="text-2xl font-bold text-navy sm:text-3xl">{props.title}</h2>}
      <div
        className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-3 ${hasTitle ? "mt-8" : ""}`}
      >
        {channels.map((ch, i) => {
          const Icon = CHANNEL_ICONS[ch.kind];
          const card = (
            <>
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-brand-strong">
                <Icon className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
              </span>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{ch.label}</p>
              <p
                dir={ch.kind === "address" ? undefined : "ltr"}
                className="mt-1.5 break-words text-base font-bold text-navy"
              >
                {ch.value}
              </p>
            </>
          );
          const className = ch.href
            ? "block rounded-2xl border border-border bg-white p-6 transition-all hover:border-brand/40 hover:shadow-md"
            : "rounded-2xl border border-border bg-white p-6";
          return ch.href ? (
            <BlockLink key={`${i}-${ch.label}`} href={ch.href} locale={locale} className={className}>
              {card}
            </BlockLink>
          ) : (
            <div key={`${i}-${ch.label}`} className={className}>
              {card}
            </div>
          );
        })}
      </div>
    </Section>
  );
}
