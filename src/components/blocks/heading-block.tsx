"use client";

import { BlockContainer } from "./block-container";
import { type z } from "zod";
import type { blockSchemas } from "@/lib/blocks/types";
import type { Locale } from "@/lib/i18n";
import { EditableText } from "./inline-edit-context";

export type HeadingBlockProps = z.input<typeof blockSchemas.heading>["props"];

const HEADING_CLASSES: Record<2 | 3 | 4, string> = {
  2: "text-balance text-3xl font-bold leading-snug text-navy sm:text-4xl",
  3: "text-balance text-2xl font-bold leading-snug text-navy sm:text-3xl",
  4: "text-balance text-xl font-bold text-navy",
};

const HEADING_TAGS = { 2: "h2", 3: "h3", 4: "h4" } as const;

/** عنوان بمستوى اختياري وشارة علوية اختيارية بأسلوب ترويسات الموقع */
export function HeadingBlock({ props }: { props: HeadingBlockProps; locale: Locale }) {
  const level = props.level ?? 2;
  const align = props.align ?? "start";
  const Tag = HEADING_TAGS[level];

  return (
    <BlockContainer>
      <div className={align === "center" ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}>
        {props.kicker && (
          <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-accent px-3.5 py-1.5 text-sm font-semibold text-brand-strong">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-skydrop" aria-hidden="true" />
            <EditableText
              field="kicker"
              value={props.kicker}
              as="span"
              className="rounded-sm outline-none"
            />
          </p>
        )}
        <EditableText
          field="text"
          value={props.text}
          as={Tag}
          primary
          className={HEADING_CLASSES[level]}
        />
      </div>
    </BlockContainer>
  );
}
