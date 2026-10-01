"use client";

import { useMemo, useState } from "react";
import { Check, CalendarDays, RotateCcw } from "lucide-react";

/**
 * نموذج تفاعلي محلي لتجربة حجز المواعيد — حالة «نموذج تفاعلي» في صفحة الأعمال.
 * بيانات تجريبية بالكامل، لا يرسل ولا يحفظ أي شيء (حالة محلية فقط).
 */

const LABELS = {
  ar: {
    title: "جرّب تجربة الحجز",
    step: "الخطوة",
    of: "من",
    stepNames: ["اختر الخدمة", "اختر الوقت", "أكّد الحجز"],
    service: "الخدمة",
    time: "الوقت المتاح",
    confirm: "تأكيد الحجز",
    done: "تم الحجز (تجريبي)",
    doneBody: "هذا تأكيد محلي داخل النموذج فقط — لا شيء أُرسل أو حُفظ.",
    again: "تجربة من جديد",
    back: "رجوع",
    note: "بيانات تجريبية لأغراض العرض.",
  },
  en: {
    title: "Try the booking flow",
    step: "Step",
    of: "of",
    stepNames: ["Choose a service", "Pick a time", "Confirm"],
    service: "Service",
    time: "Available slot",
    confirm: "Confirm booking",
    done: "Booked (demo)",
    doneBody: "This confirmation is local to the prototype — nothing was sent or stored.",
    again: "Try again",
    back: "Back",
    note: "Synthetic data for illustration.",
  },
} as const;

const SERVICES = {
  ar: ["استشارة تعريفية", "مراجعة نطاق مشروع", "جلسة متابعة تصميم"],
  en: ["Introductory consultation", "Project scope review", "Design follow-up session"],
} as const;

const DAYS = {
  ar: ["الأحد", "الثلاثاء", "الخميس"],
  en: ["Sunday", "Tuesday", "Thursday"],
} as const;

const SLOTS = ["10:00", "11:30", "13:00", "16:00", "17:30"] as const;
/** أوقات غير متاحة عمدًا لمحاكاة التوفر الواقعي */
const UNAVAILABLE = new Set(["1-1", "2-3", "0-3"]);

export function BookingPrototype({ locale }: { locale: "ar" | "en" }) {
  const t = LABELS[locale];
  const [step, setStep] = useState(0);
  const [service, setService] = useState<string | null>(null);
  const [slot, setSlot] = useState<{ day: string; time: string } | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const services = SERVICES[locale];
  const days = DAYS[locale];
  const daySlots = useMemo(
    () => days.map((day, di) => ({ day, slots: SLOTS.map((time, si) => ({ time, ok: !UNAVAILABLE.has(`${di}-${si}`) })) })),
    [days]
  );

  if (confirmed) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-8 text-center" dir={locale === "ar" ? "rtl" : "ltr"}>
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-600 text-white">
          <Check className="h-6 w-6" strokeWidth={2.5} aria-hidden="true" />
        </span>
        <p className="mt-4 text-lg font-bold text-green-900">{t.done}</p>
        <p className="mt-2 text-sm leading-7 text-green-800">{t.doneBody}</p>
        <button
          type="button"
          onClick={() => {
            setConfirmed(false);
            setStep(0);
            setService(null);
            setSlot(null);
          }}
          className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-full border border-green-300 bg-white px-4 text-sm font-semibold text-green-800 hover:bg-green-100"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          {t.again}
        </button>
      </div>
    );
  }

  return (
    <div className="flex justify-center py-2" dir={locale === "ar" ? "rtl" : "ltr"}>
      <div className="w-full max-w-md rounded-2xl border-4 border-navy/90 bg-white p-5 shadow-lg">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200" aria-hidden="true" />
        <p className="text-center text-sm font-bold text-navy">{t.title}</p>

        {/* مؤشر الخطوات */}
        <ol className="mt-4 flex items-center justify-center gap-2" aria-label={`${t.step} ${step + 1} ${t.of} 3`}>
          {t.stepNames.map((name, i) => (
            <li key={name} className="flex items-center gap-2">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
                  i < step ? "bg-green-600 text-white" : i === step ? "bg-brand text-white" : "bg-slate-100 text-slate-400"
                }`}
                aria-current={i === step ? "step" : undefined}
              >
                {i < step ? <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" /> : i + 1}
              </span>
              <span className={`hidden text-xs font-semibold sm:inline ${i === step ? "text-navy" : "text-slate-400"}`}>{name}</span>
              {i < 2 && <span className="h-px w-4 bg-slate-200" aria-hidden="true" />}
            </li>
          ))}
        </ol>

        <div className="mt-5 min-h-[168px]">
          {step === 0 && (
            <div role="radiogroup" aria-label={t.service} className="space-y-2">
              {services.map((s) => (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={service === s}
                  onClick={() => setService(s)}
                  className={`flex min-h-11 w-full items-center justify-between rounded-lg border px-4 text-sm font-medium transition-colors ${
                    service === s ? "border-brand bg-accent text-brand-strong" : "border-border bg-white text-foreground hover:border-brand/50"
                  }`}
                >
                  {s}
                  {service === s && <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />}
                </button>
              ))}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3" aria-label={t.time}>
              {daySlots.map(({ day, slots }) => (
                <div key={day}>
                  <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                    {day}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {slots.map(({ time, ok }) => {
                      const selected = slot?.day === day && slot?.time === time;
                      return (
                        <button
                          key={time}
                          type="button"
                          disabled={!ok}
                          aria-pressed={selected}
                          aria-disabled={!ok}
                          onClick={() => setSlot({ day, time })}
                          className={`ltr-isolate min-h-9 rounded-md border px-3 text-xs font-semibold transition-colors ${
                            selected
                              ? "border-brand bg-brand text-white"
                              : ok
                                ? "border-border bg-white text-foreground hover:border-brand/60"
                                : "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300 line-through"
                          }`}
                        >
                          {time}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3 rounded-xl bg-background p-4">
              <p className="text-sm leading-7">
                <span className="font-semibold text-muted-foreground">{t.service}: </span>
                <span className="font-bold text-navy">{service}</span>
              </p>
              <p className="text-sm leading-7">
                <span className="font-semibold text-muted-foreground">{t.time}: </span>
                <span className="rtl-isolate font-bold text-navy">
                  {slot?.day} — <span className="ltr-isolate">{slot?.time}</span>
                </span>
              </p>
              <p className="text-xs leading-6 text-slate-400">{t.note}</p>
            </div>
          )}
        </div>

        {/* أزرار التنقل */}
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-4">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="inline-flex min-h-10 items-center rounded-full border border-border px-4 text-sm font-semibold text-muted-foreground enabled:hover:border-brand enabled:hover:text-brand disabled:opacity-40"
          >
            {t.back}
          </button>
          {step < 2 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              disabled={(step === 0 && !service) || (step === 1 && !slot)}
              className="inline-flex min-h-10 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground enabled:hover:bg-brand-strong disabled:opacity-40"
            >
              {t.stepNames[step + 1]}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmed(true)}
              className="inline-flex min-h-10 items-center gap-2 rounded-full bg-green-600 px-5 text-sm font-semibold text-white hover:bg-green-700"
            >
              <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
              {t.confirm}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
