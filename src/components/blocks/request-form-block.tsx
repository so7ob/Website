"use client";

import { Suspense } from "react";
import { MailCheck, MessagesSquare, ClipboardList } from "lucide-react";
import { Section } from "@/components/site/section";
import { SuspenseFallback } from "@/components/form/project-request-form";
import { ar } from "@/content/ar";
import { en } from "@/content/en";
import type { Locale } from "@/lib/i18n";
import { type z } from "zod";
import type { blockSchemas } from "@/lib/blocks/types";
import { RequestFormShell } from "./request-form-shell";

export type RequestFormBlockProps = z.input<typeof blockSchemas.requestForm>["props"];

const NEXT_ICONS = [ClipboardList, MessagesSquare, MailCheck];

/**
 * بلوك نموذج طلب المشروع — النموذج نفسه تفاعلي (يُحمّل داخل Suspense)،
 * مع بطاقتي «ماذا يحدث بعد الإرسال» و«الخصوصية» الاخياريتين (من ContactPage).
 */
export function RequestFormBlock({ props, locale }: { props: RequestFormBlockProps; locale: Locale }) {
  const t = locale === "en" ? en : ar;
  const c = t.contact;
  const showNextSteps = props.showNextSteps ?? true;
  const showPrivacy = props.showPrivacy ?? true;

  return (
    <Section>
      {showNextSteps || showPrivacy ? (
        <div className="grid gap-10 lg:grid-cols-[1.35fr_0.65fr] lg:gap-14">
          <Suspense fallback={<SuspenseFallback />}>
            <RequestFormShell locale={locale} preselectService={props.preselectService} />
          </Suspense>

          <aside className="space-y-8">
            {showNextSteps && (
              <div className="rounded-3xl border border-border bg-white p-7">
                <h2 className="text-lg font-bold text-navy">{c.nextTitle}</h2>
                <ol className="mt-5 space-y-5">
                  {c.nextSteps.map((step, i) => {
                    const Icon = NEXT_ICONS[i % NEXT_ICONS.length];
                    return (
                      <li key={step.title} className="flex gap-3.5">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-brand-strong">
                          <Icon className="h-4.5 w-4.5" strokeWidth={1.9} aria-hidden="true" />
                        </span>
                        <div>
                          <p className="text-sm font-bold text-navy">{step.title}</p>
                          <p className="mt-1 text-sm leading-7 text-muted-foreground">{step.body}</p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>
            )}

            {showPrivacy && (
              <div className="rounded-3xl bg-navy p-7 text-white">
                <h2 className="flex items-center gap-2 text-lg font-bold">{c.privacyTitle}</h2>
                <p className="mt-3 text-sm leading-7 text-white/70">{c.privacyBody}</p>
                <ul className="mt-4 space-y-2.5">
                  {c.privacyItems.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm leading-7 text-white/80">
                      <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-skydrop" aria-hidden="true" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>
        </div>
      ) : (
        <div className="mx-auto max-w-4xl">
          <Suspense fallback={<SuspenseFallback />}>
            <RequestFormShell locale={locale} preselectService={props.preselectService} />
          </Suspense>
        </div>
      )}
    </Section>
  );
}
