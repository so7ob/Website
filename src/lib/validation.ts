/**
 * تحقق مشترك بين الواجهة والخادم — مصدر واحد للحقيقة.
 * الأخطاء تُعاد كرموز (codes) تُترجم لكل لغة في الواجهة،
 * والخادم يعيد الرموز نفسها فتُعرض مترجمة بعد الفشل.
 */

export const REQUEST_TYPES = ["discussion", "quote"] as const;
export const SERVICE_TYPES = ["web", "mobile", "systems", "ux", "automation", "maintenance", "unsure"] as const;
export const BUDGET_TIERS = ["tier1", "tier2", "tier3", "tier4", "unspecified"] as const;
export const CURRENCIES = ["SAR", "AED", "EGP", "KWD", "QAR", "USD", "EUR"] as const;
export const TIMELINES = ["flexible", "asap", "1-3m", "3-6m", "6m+"] as const;
export const CONTACT_METHODS = ["email", "phone", "any"] as const;

export type RequestType = (typeof REQUEST_TYPES)[number];
export type ServiceType = (typeof SERVICE_TYPES)[number];
export type BudgetTier = (typeof BUDGET_TIERS)[number];
export type Currency = (typeof CURRENCIES)[number];
export type Timeline = (typeof TIMELINES)[number];
export type ContactMethod = (typeof CONTACT_METHODS)[number];

export interface ProjectRequestInput {
  requestType: RequestType;
  serviceType: ServiceType;
  description: string;
  budget: BudgetTier;
  currency: Currency | "";
  timeline: Timeline;
  name: string;
  company: string;
  email: string;
  phone: string;
  preferredContact: ContactMethod;
  referenceUrl: string;
  /** حقل خداع للبوتات — يجب أن يبقى فارغًا */
  website: string;
  /** زمن فتح النموذج (ms epoch) لرصد الإرسال الآلي السريع */
  startedAt: number;
  /** لغة النموذج عند الإرسال */
  locale: "ar" | "en";
}

/** رموز أخطاء الحقول — تُترجم في ملف المحتوى (form.errors) */
export type FieldErrorCode =
  | "required"
  | "invalidEmail"
  | "invalidPhone"
  | "invalidUrl"
  | "descriptionShort"
  | "descriptionLong"
  | "nameShort"
  | "nameLong"
  | "currencyRequired"
  | "phoneRequiredForPreferred"
  | "tooLong"
  | "invalidValue";

export type FieldErrors = Partial<Record<keyof ProjectRequestInput, FieldErrorCode>>;

/** حدود الإدخال — معلنة في مكان واحد */
export const LIMITS = {
  descriptionMin: 30,
  descriptionMax: 5000,
  nameMin: 2,
  nameMax: 100,
  textMax: 120,
  urlMax: 300,
  emailMax: 200,
  /** أقل زمن معقول لملء النموذج (ms) — أقل من ذلك يُعد إرسالًا آليًا */
  minFillMs: 2000,
} as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** هاتف متساهل: أرقام و+ ومسافات وشرطات وأقواس، 7-20 محرفًا فعليًا */
const PHONE_RE = /^[+]?[\d\s\-()]{7,20}$/;
const URL_RE = /^https?:\/\/[^\s]+$/i;

function pick<T extends readonly string[]>(list: T, value: unknown): T[number] | null {
  return typeof value === "string" && (list as readonly string[]).includes(value) ? (value as T[number]) : null;
}

function cleanText(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max + 1) : "";
}

/**
 * يتحقق من طلب كامل ويعيد الأخطاء لكل حقل أو البيانات المنقاة.
 * يُستخدم في الواجهة (قبل الإرسال) وفي الخادم (مصدر الحقيقة النهائي).
 */
export function validateProjectRequest(raw: unknown): { ok: true; data: ProjectRequestInput } | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {};
  const r = (raw ?? {}) as Record<string, unknown>;

  const requestType = pick(REQUEST_TYPES, r.requestType);
  if (!requestType) errors.requestType = "required";

  const serviceType = pick(SERVICE_TYPES, r.serviceType);
  if (!serviceType) errors.serviceType = "required";

  const description = cleanText(r.description, LIMITS.descriptionMax);
  if (!description) errors.description = "required";
  else if (description.length < LIMITS.descriptionMin) errors.description = "descriptionShort";
  else if (description.length > LIMITS.descriptionMax) errors.description = "descriptionLong";

  const budget = pick(BUDGET_TIERS, r.budget);
  if (!budget) errors.budget = "required";

  let currency: Currency | "" = "";
  if (typeof r.currency === "string" && r.currency) {
    currency = pick(CURRENCIES, r.currency) ?? "";
    if (!currency) errors.currency = "invalidValue";
  } else if (budget && budget !== "unspecified") {
    errors.currency = "currencyRequired";
  }

  const timeline = pick(TIMELINES, r.timeline);
  if (!timeline) errors.timeline = "required";

  const name = cleanText(r.name, LIMITS.nameMax);
  if (!name) errors.name = "required";
  else if (name.length < LIMITS.nameMin) errors.name = "nameShort";
  else if (name.length > LIMITS.nameMax) errors.name = "nameLong";

  const company = cleanText(r.company, LIMITS.textMax);
  if (company.length > LIMITS.textMax) errors.company = "tooLong";

  const email = cleanText(r.email, LIMITS.emailMax);
  if (!email) errors.email = "required";
  else if (email.length > LIMITS.emailMax || !EMAIL_RE.test(email)) errors.email = "invalidEmail";

  const phone = cleanText(r.phone, LIMITS.textMax);
  if (phone && !PHONE_RE.test(phone)) errors.phone = "invalidPhone";

  const preferredContact = pick(CONTACT_METHODS, r.preferredContact);
  if (!preferredContact) errors.preferredContact = "required";
  else if (preferredContact === "phone" && !phone) errors.preferredContact = "phoneRequiredForPreferred";

  const referenceUrl = cleanText(r.referenceUrl, LIMITS.urlMax);
  if (referenceUrl && (referenceUrl.length > LIMITS.urlMax || !URL_RE.test(referenceUrl))) {
    errors.referenceUrl = "invalidUrl";
  }

  // حماية من البوتات: حقل العسل يجب أن يبقى فارغًا، والزمن معقول
  const website = cleanText(r.website, LIMITS.textMax);
  const startedAt = typeof r.startedAt === "number" && Number.isFinite(r.startedAt) ? r.startedAt : 0;
  const locale = r.locale === "en" ? "en" : "ar";
  const botSuspected = website !== "" || (startedAt > 0 && Date.now() - startedAt < LIMITS.minFillMs);

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    data: {
      requestType: requestType!,
      serviceType: serviceType!,
      description,
      budget: budget!,
      currency: budget === "unspecified" ? "" : (currency as Currency),
      timeline: timeline!,
      name,
      company: company || "",
      email,
      phone: phone || "",
      preferredContact: preferredContact!,
      referenceUrl: referenceUrl || "",
      website,
      startedAt,
      locale,
      ...(botSuspected ? {} : {}),
    },
  };
}

/** يكشف الإرسال الآلي بعد نجاح التحقق الأساسي (يُستخدم في الخادم فقط) */
export function isBotLike(data: ProjectRequestInput): boolean {
  return data.website !== "" || (data.startedAt > 0 && Date.now() - data.startedAt < LIMITS.minFillMs);
}
