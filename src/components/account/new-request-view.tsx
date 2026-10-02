"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, FilePlus2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/lib/i18n";
import type { SiteContent } from "@/content/types";
import type { PortalContent } from "@/content/portal/types";
import type { ProjectRequestInput } from "@/lib/validation";
import { ProjectRequestForm, SuspenseFallback } from "@/components/form/project-request-form";
import { apiFetch } from "./api";
import type { RequestDraftPayload, RequestListResponse } from "./types";

/** طلب جديد داخل البوابة: مسودة الخادم (استعادة/حفظ تلقائي/مسح) بدل مسودة المتصفح */
export function NewRequestView({
  locale,
  content,
  t,
  heading,
}: {
  locale: Locale;
  content: SiteContent;
  t: PortalContent["account"]["requests"];
  heading: string;
}) {
  const [phase, setPhase] = useState<"loading" | "form">("loading");
  const [initialValues, setInitialValues] = useState<Partial<ProjectRequestInput> | undefined>(undefined);
  const [formKey, setFormKey] = useState(0);
  const [submitted, setSubmitted] = useState<{ refCode: string; id?: string } | null>(null);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishedRef = useRef(false);

  // استعادة مسودة الخادم مرة واحدة عند التحميل
  useEffect(() => {
    let active = true;
    void (async () => {
      const result = await apiFetch<RequestDraftPayload>("/api/account/drafts");
      if (!active) return;
      const draft = result.data.draft;
      if (result.data.ok && draft && Object.values(draft).some((v) => v !== undefined && v !== "" && v !== null)) {
        toast.info(t.draftRestored);
        setInitialValues(draft as Partial<ProjectRequestInput>);
      }
      setPhase("form");
    })();
    return () => {
      active = false;
    };
  }, [t.draftRestored]);

  // إيقاف أي حفظ مؤجل عند مغادرة الصفحة
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  // حفظ تلقائي بمهلة 3 ثوانٍ — مسودة الخادم مرتبطة بالحساب لا بالمتصفح
  const handleValuesChange = useCallback((values: Partial<ProjectRequestInput>) => {
    if (finishedRef.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void apiFetch("/api/account/drafts", { method: "PUT", body: JSON.stringify(values) });
    }, 3000);
  }, []);

  // بعد النجاح: مسح المسودة + إظهار الرقم المرجعي ورابط المتابعة
  const handleSubmitted = useCallback(
    async (refCode: string) => {
      finishedRef.current = true;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      await apiFetch("/api/account/drafts", { method: "DELETE" });
      toast.success(t.submitSuccess);

      const list = await apiFetch<RequestListResponse>("/api/account/requests?page=1");
      const found = list.data.requests?.find((r) => r.refCode === refCode);
      setSubmitted({ refCode, id: found?.id });
    },
    [t.submitSuccess]
  );

  function startAnother() {
    finishedRef.current = false;
    setSubmitted(null);
    setInitialValues(undefined);
    setFormKey((k) => k + 1);
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-brand-strong">
          <FilePlus2 className="size-5" aria-hidden="true" />
        </span>
        <h1 className="text-2xl font-bold text-navy">{heading}</h1>
      </header>

      {submitted ? (
        <div className="rounded-3xl border border-emerald-200 bg-white p-8 text-center sm:p-12" role="status">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <CheckCircle2 className="h-8 w-8" aria-hidden="true" />
          </span>
          <h2 className="mt-5 text-2xl font-bold text-navy">{t.submitSuccess}</h2>
          <p className="mx-auto mt-3 max-w-md leading-8 text-muted-foreground">{t.submitSuccessBody}</p>
          <p className="mt-6 inline-flex items-center gap-3 rounded-xl bg-emerald-50 px-5 py-3 text-emerald-900">
            <span className="font-mono text-lg font-bold tracking-wide ltr-isolate" dir="ltr">
              {submitted.refCode}
            </span>
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            {submitted.id && (
              <Button
                asChild
                className="h-12 rounded-full bg-primary px-6 font-bold text-primary-foreground shadow-md shadow-brand/20 transition-all hover:bg-brand-strong"
              >
                <Link href={`/${locale}/account/requests/${submitted.id}`}>{t.viewDetails}</Link>
              </Button>
            )}
            <Button variant="outline" className="h-12 rounded-full px-6 font-semibold" onClick={startAnother}>
              <FilePlus2 className="h-4 w-4" aria-hidden="true" />
              {t.create}
            </Button>
            <Button asChild variant="ghost" className="h-12 rounded-full px-6 font-semibold text-muted-foreground">
              <Link href={`/${locale}/account`}>{t.cancelEdit}</Link>
            </Button>
          </div>
        </div>
      ) : phase === "loading" ? (
        <div role="status" aria-busy="true" className="flex items-center justify-center gap-3 rounded-3xl border border-border bg-white p-12 text-sm font-medium text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin text-brand" aria-hidden="true" />
          {heading}
        </div>
      ) : (
        <Suspense fallback={<SuspenseFallback />}>
          <ProjectRequestForm
            key={formKey}
            locale={locale}
            content={content}
            initialValues={initialValues}
            onValuesChange={handleValuesChange}
            onSubmitted={handleSubmitted}
            suppressLocalDraft
          />
        </Suspense>
      )}
    </div>
  );
}
