"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, ShieldCheck, TriangleAlert } from "lucide-react";
import {
  BUDGET_TIERS,
  CONTACT_METHODS,
  CURRENCIES,
  REQUEST_TYPES,
  SERVICE_TYPES,
  TIMELINES,
  validateProjectRequest,
  type FieldErrors,
  type ProjectRequestInput,
} from "@/lib/validation";
import type { Locale } from "@/lib/i18n";
import type { SiteContent } from "@/content/types";

const DRAFT_KEY = "so7ob-request-draft";

type FormState = Omit<ProjectRequestInput, "startedAt">;

export interface ProjectRequestFormProps {
  locale: Locale;
  content: SiteContent;
  /** قيم مبدئية (مسودة الخادم مثلًا) — تُطبق مرة واحدة عند التحميل */
  initialValues?: Partial<ProjectRequestInput>;
  /** يُستدعى بعد نجاح الحفظ في الخادم مع الرقم المرجعي */
  onSubmitted?: (refCode: string) => void;
  /** يُستدعى عند تغيّير القيم (بمهلة قصيرة) — للحفظ التلقائي الخارجي */
  onValuesChange?: (values: Partial<ProjectRequestInput>) => void;
  /** تخطي مسودة localStorage (قراءة وكتابة) — للحسابات المسجلة التي تستخدم مسودات الخادم */
  suppressLocalDraft?: boolean;
}

const EMPTY: FormState = {
  requestType: "discussion",
  serviceType: "unsure",
  description: "",
  budget: "unspecified",
  currency: "",
  timeline: "flexible",
  name: "",
  company: "",
  email: "",
  phone: "",
  preferredContact: "any",
  referenceUrl: "",
  website: "",
  locale: "ar",
};

/**
 * نموذج طلب المشروع — تحقق في الواجهة بالمنطق المشترك نفسه المستخدم في الخادم،
 * حفظ مسودة محلي، منع الإرسال المتكرر، ولا يُعرض نجاح إلا بعد تأكيد الحفظ من الخادم.
 * الخصائص الإضافية اختيارية كليًا: غيابها يحافظ على السلوك العام كما هو.
 */
export function ProjectRequestForm({
  locale,
  content,
  initialValues,
  onSubmitted,
  onValuesChange,
  suppressLocalDraft = false,
}: ProjectRequestFormProps) {
  const t = content.form;
  const params = useSearchParams();
  const mountedAt = useRef(Date.now());

  // مرجع دائم لأحدث نسخة من المستمع — يفصل هوية الدالة عن دورة أثر التغيير
  const valuesChangeListener = useRef(onValuesChange);
  useEffect(() => {
    valuesChangeListener.current = onValuesChange;
  }, [onValuesChange]);

  const [data, setData] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<{ kind: "invalid" | "duplicate" | "rateLimited" | "generic"; message: string } | null>(null);
  const [status, setStatus] = useState<"idle" | "submitting" | "success">("idle");
  const [refCode, setRefCode] = useState("");
  const [restored, setRestored] = useState(false);

  // تعبئة مبدئية من معاملات الرابط: ?type=quote|discussion&service=web
  useEffect(() => {
    const type = params.get("type");
    const service = params.get("service");
    setData((d) => ({
      ...d,
      requestType: type === "quote" || type === "discussion" ? type : d.requestType,
      serviceType: (SERVICE_TYPES as readonly string[]).includes(service ?? "") ? (service as FormState["serviceType"]) : d.serviceType,
      locale,
    }));
  }, [params, locale]);

  // القيم المبدئية (مسودة الخادم) — مرة واحدة فقط، وبعد معاملات الرابط
  const initialApplied = useRef(false);
  useEffect(() => {
    if (initialApplied.current || !initialValues) return;
    initialApplied.current = true;
    setData((d) => ({ ...d, ...initialValues, website: "", locale }));
  }, [initialValues, locale]);

  // استعادة المسودة المحلية — تُتخطى للحسابات المسجلة (مسودات الخادم بديلًا)
  useEffect(() => {
    if (suppressLocalDraft) return;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const draft = JSON.parse(raw) as Partial<FormState>;
        setData((d) => ({ ...d, ...draft, website: "", locale }));
        if (draft.description || draft.email) setRestored(true);
      }
    } catch {
      /* تجاهل مسودة تالفة */
    }
  }, [locale, suppressLocalDraft]);

  // حفظ المسودة عند التغيير (محلية إن لم تُكبت) + إبلاغ المستمع الخارجي
  useEffect(() => {
    const timer = setTimeout(() => {
      const snapshot = { ...data, website: "" } as Partial<ProjectRequestInput>;
      if (!suppressLocalDraft) {
        try {
          localStorage.setItem(DRAFT_KEY, JSON.stringify(snapshot));
        } catch {
          /* لا مساحة للتخزين */
        }
      }
      valuesChangeListener.current?.(snapshot);
    }, 400);
    return () => clearTimeout(timer);
  }, [data, suppressLocalDraft]);

  const currencyNeeded = data.budget !== "unspecified";
  const errorFor = (field: keyof FormState) => (errors[field] ? t.errors[errors[field] as keyof typeof t.errors] : undefined);
  const describedBy = (field: string, hasError: boolean) => (hasError ? `${field}-error` : undefined);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setData((d) => ({ ...d, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  }

  async function onSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (status === "submitting") return; // منع الإرسال المتكرر غير المقصود
    setServerError(null);
    setRestored(false);

    const result = validateProjectRequest({ ...data, startedAt: mountedAt.current });
    if (!result.ok) {
      setErrors(result.errors);
      // تركيز أول حقل خطأ
      const first = Object.keys(result.errors)[0];
      document.getElementById(first)?.focus();
      return;
    }

    setStatus("submitting");
    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...result.data, startedAt: mountedAt.current }),
      });
      const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;

      if (res.ok && body.ok && typeof body.ref === "string") {
        if (!suppressLocalDraft) {
          try {
            localStorage.removeItem(DRAFT_KEY);
          } catch {}
        }
        setRefCode(body.ref);
        setStatus("success");
        onSubmitted?.(body.ref);
        document.getElementById("form-top")?.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }

      if (res.status === 400 && body.errors) {
        setErrors(body.errors as FieldErrors);
        setServerError({ kind: "invalid", message: t.serverErrors.invalid });
      } else if (res.status === 409) {
        setServerError({ kind: "duplicate", message: t.serverErrors.duplicate });
      } else if (res.status === 429) {
        setServerError({ kind: "rateLimited", message: t.serverErrors.rateLimited });
      } else {
        setServerError({ kind: "generic", message: t.serverErrors.generic });
      }
    } catch {
      setServerError({ kind: "generic", message: t.serverErrors.generic });
    }
    setStatus("idle");
  }

  function resetForm() {
    setData({ ...EMPTY, locale });
    setErrors({});
    setRefCode("");
    setStatus("idle");
    mountedAt.current = Date.now();
  }

  const errorCount = useMemo(() => Object.values(errors).filter(Boolean).length, [errors]);

  if (status === "success") {
    return (
      <div className="rounded-3xl border border-green-200 bg-white p-8 text-center sm:p-12" role="status">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-700">
          <CheckCircle2 className="h-8 w-8" aria-hidden="true" />
        </span>
        <h2 className="mt-5 text-2xl font-bold text-navy">{t.success.title}</h2>
        <p className="mx-auto mt-3 max-w-md leading-8 text-muted-foreground">{t.success.body}</p>
        <p className="mt-6 inline-flex items-center gap-3 rounded-xl bg-green-50 px-5 py-3 text-green-900" dir={locale === "ar" ? "rtl" : "ltr"}>
          <span className="text-sm font-semibold">{t.success.refLabel}:</span>
          <span className="ltr-isolate font-mono text-lg font-bold tracking-wide">{refCode}</span>
        </p>
        <div className="mt-8">
          <button
            type="button"
            onClick={resetForm}
            className="inline-flex min-h-11 items-center rounded-full border border-border px-5 text-sm font-semibold text-navy transition-colors hover:border-brand hover:text-brand"
          >
            {t.success.another}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate aria-labelledby="form-title">
      <span id="form-top" className="sr-only">{t.title}</span>
      <div className="rounded-3xl border border-border bg-white p-6 shadow-sm sm:p-9">
        <h2 id="form-title" className="text-xl font-bold text-navy">{t.title}</h2>
        <p className="mt-2 text-sm leading-7 text-muted-foreground">{t.requiredNote}</p>

        {restored && (
          <p className="mt-4 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-brand-strong" role="status">
            {locale === "ar" ? "استُعيدت مسودة سابقة من متصفحك." : "A previous draft was restored from your browser."}
          </p>
        )}

        {serverError && (
          <div
            role="alert"
            className={`mt-5 flex items-start gap-3 rounded-xl p-4 text-sm font-medium leading-7 ${
              serverError.kind === "duplicate"
                ? "bg-amber-50 text-amber-900"
                : serverError.kind === "rateLimited"
                  ? "bg-amber-50 text-amber-900"
                  : "bg-red-50 text-red-800"
            }`}
          >
            <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            {serverError.message}
          </div>
        )}

        {errorCount > 0 && (
          <p role="alert" className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
            {locale === "ar"
              ? `يوجد ${errorCount} حقل يحتاج مراجعة — الحقول المعنية معلَّمة بالأسفل.`
              : `${errorCount} field${errorCount > 1 ? "s" : ""} need attention — highlighted below.`}
          </p>
        )}

        <div className="mt-7 grid gap-6 sm:grid-cols-2">
          {/* نوع الطلب */}
          <Field label={t.requestTypeLabel} htmlFor="requestType" required>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t.requestTypeLabel}>
              {REQUEST_TYPES.map((rt) => (
                <button
                  key={rt}
                  type="button"
                  role="radio"
                  aria-checked={data.requestType === rt}
                  onClick={() => set("requestType", rt)}
                  className={`min-h-11 rounded-xl border px-3 text-sm font-semibold transition-colors ${
                    data.requestType === rt
                      ? "border-brand bg-accent text-brand-strong"
                      : "border-border bg-white text-muted-foreground hover:border-brand/50"
                  }`}
                >
                  {t.requestTypes[rt]}
                </button>
              ))}
            </div>
          </Field>

          {/* نوع الخدمة */}
          <Field label={t.serviceLabel} htmlFor="serviceType" required error={errorFor("serviceType")} errorId="serviceType-error">
            <select
              id="serviceType"
              value={data.serviceType}
              onChange={(e) => set("serviceType", e.target.value as FormState["serviceType"])}
              aria-invalid={Boolean(errors.serviceType)}
              aria-describedby={describedBy("serviceType", Boolean(errors.serviceType))}
              className={selectClass(Boolean(errors.serviceType))}
            >
              {SERVICE_TYPES.map((s) => (
                <option key={s} value={s}>{t.services[s]}</option>
              ))}
            </select>
          </Field>

          {/* وصف الاحتياج */}
          <Field label={t.descriptionLabel} htmlFor="description" required error={errorFor("description")} errorId="description-error" hint={t.descriptionHint} full>
            <textarea
              id="description"
              rows={5}
              maxLength={LIMIT_MAX}
              value={data.description}
              onChange={(e) => set("description", e.target.value)}
              aria-invalid={Boolean(errors.description)}
              aria-describedby={describedBy("description", Boolean(errors.description))}
              className={`${selectClass(Boolean(errors.description))} resize-y leading-8`}
            />
            <p className="mt-1.5 text-xs text-slate-400 ltr-isolate">
              {data.description.length} / {LIMIT_MAX}
            </p>
          </Field>

          {/* الميزانية والعملة */}
          <Field label={t.budgetLabel} htmlFor="budget" required error={errorFor("budget")} errorId="budget-error">
            <select
              id="budget"
              value={data.budget}
              onChange={(e) => {
                const v = e.target.value as FormState["budget"];
                set("budget", v);
                if (v === "unspecified") set("currency", "");
              }}
              aria-invalid={Boolean(errors.budget)}
              aria-describedby={describedBy("budget", Boolean(errors.budget))}
              className={selectClass(Boolean(errors.budget))}
            >
              {BUDGET_TIERS.map((b) => (
                <option key={b} value={b}>{t.budgets[b]}</option>
              ))}
            </select>
          </Field>

          {currencyNeeded ? (
            <Field label={t.currencyLabel} htmlFor="currency" required error={errorFor("currency")} errorId="currency-error">
              <select
                id="currency"
                value={data.currency}
                onChange={(e) => set("currency", e.target.value as FormState["currency"])}
                aria-invalid={Boolean(errors.currency)}
                aria-describedby={describedBy("currency", Boolean(errors.currency))}
                className={selectClass(Boolean(errors.currency))}
              >
                <option value="">{t.choose}</option>
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>{t.currencies[c]}</option>
                ))}
              </select>
            </Field>
          ) : (
            <div className="hidden sm:block" aria-hidden="true" />
          )}

          {/* الموعد المستهدف */}
          <Field label={t.timelineLabel} htmlFor="timeline" required error={errorFor("timeline")} errorId="timeline-error">
            <select
              id="timeline"
              value={data.timeline}
              onChange={(e) => set("timeline", e.target.value as FormState["timeline"])}
              aria-invalid={Boolean(errors.timeline)}
              aria-describedby={describedBy("timeline", Boolean(errors.timeline))}
              className={selectClass(Boolean(errors.timeline))}
            >
              {TIMELINES.map((tl) => (
                <option key={tl} value={tl}>{t.timelines[tl]}</option>
              ))}
            </select>
          </Field>

          {/* الاسم */}
          <Field label={t.nameLabel} htmlFor="name" required error={errorFor("name")} errorId="name-error">
            <input
              id="name"
              type="text"
              autoComplete="name"
              value={data.name}
              onChange={(e) => set("name", e.target.value)}
              aria-invalid={Boolean(errors.name)}
              aria-describedby={describedBy("name", Boolean(errors.name))}
              className={selectClass(Boolean(errors.name))}
            />
          </Field>

          {/* الشركة */}
          <Field label={t.companyLabel} htmlFor="company" optional optionalLabel={t.optional}>
            <input
              id="company"
              type="text"
              autoComplete="organization"
              value={data.company}
              onChange={(e) => set("company", e.target.value)}
              className={selectClass(false)}
            />
          </Field>

          {/* البريد */}
          <Field label={t.emailLabel} htmlFor="email" required error={errorFor("email")} errorId="email-error">
            <input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              dir="ltr"
              value={data.email}
              onChange={(e) => set("email", e.target.value)}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={describedBy("email", Boolean(errors.email))}
              className={`${selectClass(Boolean(errors.email))} ltr-isolate text-start`}
            />
          </Field>

          {/* الهاتف */}
          <Field label={t.phoneLabel} htmlFor="phone" optional optionalLabel={t.optional} error={errorFor("phone")} errorId="phone-error">
            <input
              id="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              dir="ltr"
              value={data.phone}
              onChange={(e) => set("phone", e.target.value)}
              aria-invalid={Boolean(errors.phone)}
              aria-describedby={describedBy("phone", Boolean(errors.phone))}
              className={`${selectClass(Boolean(errors.phone))} ltr-isolate text-start`}
            />
          </Field>

          {/* وسيلة التواصل المفضلة */}
          <Field label={t.preferredContactLabel} htmlFor="preferredContact" required error={errorFor("preferredContact")} errorId="preferredContact-error">
            <select
              id="preferredContact"
              value={data.preferredContact}
              onChange={(e) => set("preferredContact", e.target.value as FormState["preferredContact"])}
              aria-invalid={Boolean(errors.preferredContact)}
              aria-describedby={describedBy("preferredContact", Boolean(errors.preferredContact))}
              className={selectClass(Boolean(errors.preferredContact))}
            >
              {CONTACT_METHODS.map((m) => (
                <option key={m} value={m}>{t.contactMethods[m]}</option>
              ))}
            </select>
          </Field>

          {/* رابط مرجعي */}
          <Field label={t.referenceUrlLabel} htmlFor="referenceUrl" optional optionalLabel={t.optional} error={errorFor("referenceUrl")} errorId="referenceUrl-error">
            <input
              id="referenceUrl"
              type="url"
              inputMode="url"
              dir="ltr"
              placeholder="https://"
              value={data.referenceUrl}
              onChange={(e) => set("referenceUrl", e.target.value)}
              aria-invalid={Boolean(errors.referenceUrl)}
              aria-describedby={describedBy("referenceUrl", Boolean(errors.referenceUrl))}
              className={`${selectClass(Boolean(errors.referenceUrl))} ltr-isolate text-start`}
            />
          </Field>
        </div>

        {/* حقل العسل — مخفي عن المستخدمين */}
        <div className="absolute h-0 w-0 overflow-hidden opacity-0" aria-hidden="true">
          <label htmlFor="website">{t.honeyLabel}</label>
          <input id="website" type="text" tabIndex={-1} autoComplete="off" value={data.website} onChange={(e) => set("website", e.target.value)} />
        </div>

        <div className="mt-9 flex flex-col items-start gap-5 border-t border-border pt-7 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="submit"
            disabled={status === "submitting"}
            className="inline-flex min-h-13 items-center justify-center gap-2.5 rounded-full bg-primary px-8 text-base font-bold text-primary-foreground shadow-md shadow-brand/20 transition-all hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-60"
          >
            {status === "submitting" ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                {t.submitting}
              </>
            ) : (
              t.submit
            )}
          </button>
          <p className="flex max-w-sm items-start gap-2 text-xs leading-6 text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
            {content.contact.privacyBody}
          </p>
        </div>
      </div>
    </form>
  );
}

const LIMIT_MAX = 5000;

const selectClass = (invalid: boolean) =>
  `w-full rounded-xl border bg-white px-4 py-3 text-[15px] text-foreground shadow-sm transition-colors placeholder:text-slate-400 ${
    invalid ? "border-red-400 focus:border-red-500" : "border-input focus:border-brand"
  } min-h-11`;

function Field({
  label,
  htmlFor,
  required,
  optional,
  optionalLabel = "optional",
  error,
  errorId,
  hint,
  full,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  optional?: boolean;
  optionalLabel?: string;
  error?: string;
  errorId?: string;
  hint?: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <label htmlFor={htmlFor} className="mb-2 block text-sm font-semibold text-navy">
        {label} {required && <span className="text-red-600" aria-hidden="true">*</span>}
        {optional && <span className="ms-1 text-xs font-normal text-slate-400">({optionalLabel})</span>}
      </label>
      {children}
      {hint && !error && <p className="mt-1.5 text-xs leading-6 text-slate-400">{hint}</p>}
      {error && (
        <p id={errorId} role="alert" className="mt-1.5 flex items-start gap-1.5 text-xs font-medium leading-6 text-red-700">
          <TriangleAlert className="mt-1 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}

export function SuspenseFallback() {
  return (
    <div className="animate-pulse rounded-3xl border border-border bg-white p-9">
      <div className="h-6 w-40 rounded bg-slate-100" />
      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-4 w-24 rounded bg-slate-100" />
            <div className="h-11 rounded-xl bg-slate-50" />
          </div>
        ))}
      </div>
    </div>
  );
}
