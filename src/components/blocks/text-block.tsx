"use client";

import { BlockContainer } from "./block-container";
import { type z } from "zod";
import type { blockSchemas } from "@/lib/blocks/types";
import type { Locale } from "@/lib/i18n";
import { EditableText } from "./inline-edit-context";

export type TextBlockProps = z.input<typeof blockSchemas.text>["props"];

/** فقرات نصية بمحاذاة وحجم اختياريين */
export function TextBlock({ props }: { props: TextBlockProps; locale: Locale }) {
  const align = props.align ?? "start";
  const size = props.size ?? "base";

  return (
    <BlockContainer>
      <div className={align === "center" ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}>
        {(props.paragraphs ?? []).map((p, i) => (
          <EditableText
            key={i}
            field={`paragraphs:${i}`}
            value={p}
            as="p"
            primary={i === 0}
            className={`mt-5 text-pretty leading-9 text-muted-foreground first:mt-0 ${size === "lg" ? "text-lg" : "text-base"}`}
          />
        ))}
      </div>
    </BlockContainer>
  );
}
