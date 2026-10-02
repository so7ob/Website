"use client";

import { BlockContainer } from "./block-container";
import { type z } from "zod";
import type { blockSchemas } from "@/lib/blocks/types";
import type { Locale } from "@/lib/i18n";

export type ImageBlockProps = z.input<typeof blockSchemas.image>["props"];

/**
 * صورة واحدة من محتوى CMS — img مباشرة (بدون next/image) لتفادي قيود
 * إعداد نطاقات الصور الخارجية، مع alt إلزامي من المحرر.
 */
export function ImageBlock({ props }: { props: ImageBlockProps; locale: Locale }) {
  const rounded = props.rounded ?? true;
  const width = props.width ?? "content";

  const img = (
    <img
      src={props.src}
      alt={props.alt}
      loading="lazy"
      className={`h-auto w-full object-cover ${rounded ? "rounded-2xl" : ""}`}
    />
  );

  if (width === "full") {
    return (
      <figure>
        {img}
        {props.caption && (
          <figcaption className="mx-auto max-w-7xl px-4 pt-3 text-center text-sm leading-6 text-muted-foreground sm:px-6 lg:px-8">
            {props.caption}
          </figcaption>
        )}
      </figure>
    );
  }

  return (
    <BlockContainer>
      <figure className="mx-auto max-w-4xl">
        {img}
        {props.caption && (
          <figcaption className="pt-3 text-center text-sm leading-6 text-muted-foreground">{props.caption}</figcaption>
        )}
      </figure>
    </BlockContainer>
  );
}
