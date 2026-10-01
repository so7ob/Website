"use client";

import type { ReactNode } from "react";

/**
 * حاوية موحّدة للمكونات العامة — نفس عرض المحتوى المستخدم في Section
 * مع تنفّس رأسي أخف (py-8) يناسب تركيب العناوين والنصوص والصور فوق بعضها.
 */
export function BlockContainer({ children, pad = "py-8" }: { children: ReactNode; pad?: string }) {
  return (
    <div className={pad}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">{children}</div>
    </div>
  );
}
