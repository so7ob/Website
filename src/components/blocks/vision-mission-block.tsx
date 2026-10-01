"use client";

import { Eye, Target } from "lucide-react";
import { Section } from "@/components/site/section";
import { type z } from "zod";
import type { blockSchemas } from "@/lib/blocks/types";
import type { Locale } from "@/lib/i18n";

export type VisionMissionBlockProps = z.input<typeof blockSchemas.visionMission>["props"];

/** الرؤية والرسالة — بطاقتان متقابلتان (من AboutPage) */
export function VisionMissionBlock({ props }: { props: VisionMissionBlockProps; locale: Locale }) {
  return (
    <Section>
      <div className="grid gap-6 md:grid-cols-2">
        <article className="rounded-2xl border border-border bg-navy p-8 text-white">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-skydrop">
            <Eye className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
          </span>
          <h2 className="mt-5 text-xl font-bold">{props.vision.title}</h2>
          <p className="mt-3 text-pretty leading-8 text-white/75">{props.vision.body}</p>
        </article>
        <article className="rounded-2xl border border-border bg-white p-8">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-brand-strong">
            <Target className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
          </span>
          <h2 className="mt-5 text-xl font-bold text-navy">{props.mission.title}</h2>
          <p className="mt-3 text-pretty leading-8 text-muted-foreground">{props.mission.body}</p>
        </article>
      </div>
    </Section>
  );
}
