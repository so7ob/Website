"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ProjectRequestForm } from "@/components/form/project-request-form";
import { ar } from "@/content/ar";
import { en } from "@/content/en";
import type { Locale } from "@/lib/i18n";

/**
 * غلاف تفاعلي لنموذج طلب المشروع: يطبّق الخدمة المحددة مسبقًا من البلوك
 * عبر معامل الرابط ?service= (النموذج نفسه يقرأه)، دون تعديل ملف النموذج.
 */
export function RequestFormShell({ locale, preselectService }: { locale: Locale; preselectService?: string }) {
  const content = locale === "en" ? en : ar;
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!preselectService || !pathname) return;
    if (params.get("service")) return; // لا نتدخل إن حدّد الزائر خدمة عبر الرابط
    const next = new URLSearchParams(params.toString());
    next.set("service", preselectService);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }, [preselectService, params, pathname, router]);

  return <ProjectRequestForm locale={locale} content={content} />;
}
