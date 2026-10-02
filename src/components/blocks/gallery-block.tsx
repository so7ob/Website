"use client";

import { BlockContainer } from "./block-container";
import { type z } from "zod";
import type { blockSchemas } from "@/lib/blocks/types";
import type { Locale } from "@/lib/i18n";

export type GalleryBlockProps = z.input<typeof blockSchemas.gallery>["props"];

const GRID_CLASSES: Record<2 | 3 | 4, string> = {
  2: "grid-cols-2",
  3: "grid-cols-2 sm:grid-cols-3",
  4: "grid-cols-2 sm:grid-cols-4",
};

/** شبكة صور بنسب موحدة وتسميات توضيحية اختيارية */
export function GalleryBlock({ props }: { props: GalleryBlockProps; locale: Locale }) {
  const columns = props.columns ?? 3;

  return (
    <BlockContainer>
      <div className={`grid gap-4 ${GRID_CLASSES[columns]}`}>
        {(props.images ?? []).map((image, i) => (
          <figure key={`${i}-${image.alt}`}>
            <img
              src={image.src}
              alt={image.alt}
              loading="lazy"
              className="aspect-[4/3] w-full rounded-2xl border border-border object-cover"
            />
            {image.caption && (
              <figcaption className="pt-2 text-center text-xs leading-6 text-muted-foreground">{image.caption}</figcaption>
            )}
          </figure>
        ))}
      </div>
    </BlockContainer>
  );
}
