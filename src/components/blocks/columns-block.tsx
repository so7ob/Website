"use client";

import { BlockContainer } from "./block-container";
import { type z } from "zod";
import type { blockSchemas } from "@/lib/blocks/types";
import type { Locale } from "@/lib/i18n";

export type ColumnsBlockProps = z.input<typeof blockSchemas.columns>["props"];

const GRID_CLASSES: Record<number, string> = {
  2: "sm:grid-cols-2",
  3: "md:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
};

/** أعمدة نصية متجاوبة (2–4 أعمدة) */
export function ColumnsBlock({ props }: { props: ColumnsBlockProps; locale: Locale }) {
  const cols = props.columns ?? [];
  const isSingle = cols.length === 1;

  return (
    <BlockContainer>
      <div className={isSingle ? "" : `grid gap-8 ${GRID_CLASSES[cols.length] ?? "md:grid-cols-3"}`}>
        {cols.map((col, i) => (
          <div key={i} className={isSingle ? "max-w-3xl" : ""}>
            {col.heading && <h3 className="text-lg font-bold text-navy">{col.heading}</h3>}
            <div className={col.heading ? "mt-3 space-y-3" : "space-y-3"}>
              {col.paragraphs.map((p, j) => (
                <p key={j} className="text-pretty text-sm leading-7 text-muted-foreground">
                  {p}
                </p>
              ))}
            </div>
          </div>
        ))}
      </div>
    </BlockContainer>
  );
}
