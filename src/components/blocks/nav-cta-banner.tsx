"use client";

import { Compass } from "lucide-react";
import { Section } from "@/components/site/section";
import { type z } from "zod";
import type { blockSchemas } from "@/lib/blocks/types";
import type { Locale } from "@/lib/i18n";
import { BlockLink } from "./block-link";

export type NavCtaBannerBlockProps = z.input<typeof blockSchemas.navCtaBanner>["props"];

/** أنماط الروابط على خلفية فاتحة (من بطاقات الانتقال في AboutPage) */
const VARIANT_CLASSES: Record<string, string> = {
  primary:
    "inline-flex min-h-11 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-brand-strong",
  outline:
    "inline-flex min-h-11 items-center rounded-full border border-brand/30 bg-white px-5 text-sm font-semibold text-brand transition-colors hover:border-brand",
  navy: "inline-flex min-h-11 items-center rounded-full bg-navy px-5 text-sm font-semibold text-white transition-colors hover:bg-navy-soft",
};

/** شريط دعوة للانتقال بين الصفحات (من AboutPage) */
export function NavCtaBannerBlock({ props, locale }: { props: NavCtaBannerBlockProps; locale: Locale }) {
  return (
    <Section>
      <div className="flex flex-col items-center gap-4 rounded-2xl bg-accent/50 p-8 text-center sm:flex-row sm:justify-between sm:text-start">
        <p className="flex items-center gap-3 text-base font-semibold text-navy">
          <Compass className="h-5 w-5 text-brand" aria-hidden="true" />
          {props.label}
        </p>
        <div className="flex flex-wrap justify-center gap-3">
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
      </div>
    </Section>
  );
}
