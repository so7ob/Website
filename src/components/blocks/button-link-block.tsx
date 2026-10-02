"use client";

import { BlockContainer } from "./block-container";
import { type z } from "zod";
import type { blockSchemas } from "@/lib/blocks/types";
import type { Locale } from "@/lib/i18n";
import { BlockLink } from "./block-link";
import { useRenderMode } from "./nested-context";
import { EditableText } from "./inline-edit-context";

export type ButtonLinkBlockProps = z.input<typeof blockSchemas.buttonLink>["props"];

/** أنماط الأزرار — نفس هوية أزرار الواجهة الافتتاحية */
const VARIANT_CLASSES: Record<string, string> = {
  primary:
    "inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-primary px-7 text-base font-semibold text-primary-foreground shadow-md shadow-brand/20 transition-all hover:bg-brand-strong hover:shadow-lg",
  outline:
    "inline-flex min-h-12 items-center justify-center gap-2 rounded-full border-2 border-navy/15 bg-white px-7 text-base font-semibold text-navy transition-colors hover:border-brand hover:text-brand",
  navy: "inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-navy px-7 text-base font-semibold text-white transition-colors hover:bg-navy-soft",
};

/** زر/رابط واحد بثلاثة أنماط من هوية الموقع */
export function ButtonLinkBlock({ props, locale }: { props: ButtonLinkBlockProps; locale: Locale }) {
  const variant = props.variant ?? "primary";
  const mode = useRenderMode();
  // وضع التحرير: span بلا تنقل — حتى لا يسرق النقر المتابعة أثناء جلسة التحرير المباشر
  const classes = VARIANT_CLASSES[variant] ?? VARIANT_CLASSES.primary;

  if (mode === "edit") {
    return (
      <BlockContainer>
        <span className={classes}>
          <EditableText field="label" value={props.label} as="span" primary className="outline-none" />
        </span>
      </BlockContainer>
    );
  }

  return (
    <BlockContainer>
      <BlockLink href={props.href} locale={locale} className={classes}>
        {props.label}
      </BlockLink>
    </BlockContainer>
  );
}
