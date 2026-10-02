"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FlaskConical } from "lucide-react";
import { ProjectRequestForm } from "@/components/form/project-request-form";
import { ar } from "@/content/ar";
import { en } from "@/content/en";
import type { Locale } from "@/lib/i18n";
import { useRenderMode } from "./nested-context";

/**
 * غلاف تفاعلي لنموذج طلب المشروع: يطبّق الخدمة المحددة مسبقًا من البلوك
 * عبر معامل الرابط ?service= (النموذج نفسه يقرأه)، دون تعديل ملف النموذج.
 *
 * وضع الاختبار (test): يعرض شارة واضحة ويحاكي الإرسال — لا يصل أي طلب
 * حقيقي إلى الخادم. وضع live كما هو تمامًا.
 */
export function RequestFormShell({ locale, preselectService }: { locale: Locale; preselectService?: string }) {
  const content = locale === "en" ? en : ar;
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const mode = useRenderMode();
  const simulate = mode === "test";

  useEffect(() => {
    if (!preselectService || !pathname) return;
    if (params.get("service")) return; // لا نتدخل إن حدّد الزائر خدمة عبر الرابط
    const next = new URLSearchParams(params.toString());
    next.set("service", preselectService);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }, [preselectService, params, pathname, router]);

  if (simulate) {
    return (
      <div className="space-y-3">
        <p className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-semibold text-amber-800">
          <FlaskConical className="size-4 shrink-0" aria-hidden="true" />
          {locale === "en"
            ? "Interaction test — submission is simulated, no real request is sent."
            : "اختبار تفاعل — الإرسال محاكى ولا يُرسل أي طلب حقيقي."}
        </p>
        <ProjectRequestForm locale={locale} content={content} simulate />
      </div>
    );
  }

  return <ProjectRequestForm locale={locale} content={content} />;
}
