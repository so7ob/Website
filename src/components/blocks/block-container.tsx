"use client";

import type { ReactNode } from "react";
import { useIsNestedBlock } from "./nested-context";

/**
 * حاوية موحّدة للمكونات العامة — نفس عرض المحتوى المستخدم في Section
 * مع تنفّس رأسي أخف (py-8) يناسب تركيب العناوين والنصوص والصور فوق بعضها.
 * داخل حاوية شجرة المحتوى يُرسم عاريًا (مسؤولية التباعد للأم).
 */
export function BlockContainer({ children, pad = "py-8" }: { children: ReactNode; pad?: string }) {
  const nested = useIsNestedBlock();
  if (nested) return <div>{children}</div>;
  return (
    <div className={pad}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">{children}</div>
    </div>
  );
}
