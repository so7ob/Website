"use client";

import type { ReactNode } from "react";
import { useIsNestedBlock } from "@/components/blocks/nested-context";

/** ترويسة قسم موحدة: شارة علوية + عنوان + وصف اختياري، بمحاذاة تعتمد الاتجاه */
export function SectionHeading({
  kicker,
  title,
  description,
  align = "start",
  tone = "light",
}: {
  kicker: string;
  title: string;
  description?: string;
  align?: "start" | "center";
  tone?: "light" | "dark";
}) {
  const isDark = tone === "dark";
  return (
    <div className={`max-w-2xl ${align === "center" ? "mx-auto text-center" : ""}`}>
      <p
        className={`mb-3 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-semibold ${
          isDark ? "bg-white/10 text-skydrop" : "bg-accent text-brand-strong"
        }`}
      >
        <KickerDot />
        {kicker}
      </p>
      <h2 className={`text-balance text-3xl font-bold leading-snug sm:text-4xl ${isDark ? "text-white" : "text-navy"}`}>
        {title}
      </h2>
      {description && (
        <p className={`mt-4 text-pretty text-base leading-8 ${isDark ? "text-white/70" : "text-muted-foreground"}`}>
          {description}
        </p>
      )}
    </div>
  );
}

function KickerDot() {
  return <span className="inline-block h-1.5 w-1.5 rounded-full bg-skydrop" aria-hidden="true" />;
}

/** غلاف قسم موحد بعرض محتوى مريح وطول أسطر مضبوط.
 *  داخل حاوية شجرة المحتوى يُرسم عاريًا (بلا حشوة/عرض أقصى ذاتي) —
 *  مسؤولية التباعد للحاوية الأم وحدها. */
export function Section({ children, className = "", id }: { children: ReactNode; className?: string; id?: string }) {
  const nested = useIsNestedBlock();
  if (nested) {
    return (
      <div id={id} className={className}>
        {children}
      </div>
    );
  }
  return (
    <section id={id} className={`py-16 sm:py-20 lg:py-24 ${className}`}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">{children}</div>
    </section>
  );
}
