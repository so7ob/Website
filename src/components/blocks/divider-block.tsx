"use client";

import { BlockContainer } from "./block-container";
import { type z } from "zod";
import type { blockSchemas } from "@/lib/blocks/types";
import type { Locale } from "@/lib/i18n";

export type DividerBlockProps = z.input<typeof blockSchemas.divider>["props"];

/** فاصل بصري خفيف بحدود الموقع */
export function DividerBlock({ locale: _locale }: { props: DividerBlockProps; locale: Locale }) {
  return (
    <BlockContainer pad="py-6">
      <hr className="border-border" />
    </BlockContainer>
  );
}
