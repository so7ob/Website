"use client";

import { type z } from "zod";
import type { blockSchemas } from "@/lib/blocks/types";
import type { Locale } from "@/lib/i18n";

export type SpacerBlockProps = z.input<typeof blockSchemas.spacer>["props"];

const HEIGHT_CLASSES: Record<string, string> = {
  sm: "h-8",
  md: "h-16",
  lg: "h-28",
};

/** مسافة رأسية دقيقة — زخرفية وتُخفى عن قارئ الشاشة */
export function SpacerBlock({ props }: { props: SpacerBlockProps; locale: Locale }) {
  return <div aria-hidden="true" className={HEIGHT_CLASSES[props.size ?? "md"] ?? "h-16"} />;
}
