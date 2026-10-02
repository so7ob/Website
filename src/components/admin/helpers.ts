/**
 * مساعدات مشتركة لمكونات لوحة الإدارة (آمنة للعميل):
 * طلبات الواجهة + تنسيق التواريخ والأحجام + خرائط ألوان الحالات.
 */
import { format, formatDistanceToNow } from "date-fns";
import { ar as arDfns } from "date-fns/locale";
import type { PortalContent } from "@/content/portal/types";
import type { Locale } from "@/lib/i18n";

/** خطأ موحد لاستجابات الواجهة غير الناجحة */
export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string) {
    super(code);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

async function handle<T>(res: Response): Promise<T> {
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // لا جسم JSON — يعالج كخطأ عام
  }
  if (!res.ok) {
    const code = (data as { code?: string } | null)?.code ?? "generic";
    throw new ApiError(res.status, code);
  }
  return data as T;
}

export async function apiGet<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  return handle<T>(res);
}

export async function apiSend<T>(
  url: string,
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  body?: unknown
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return handle<T>(res);
}

export async function apiUpload<T>(url: string, form: FormData): Promise<T> {
  const res = await fetch(url, { method: "POST", body: form });
  return handle<T>(res);
}

/** رسالة خطأ مفهومة من رمز الواجهة — كل النصوص من ترجمات المنصة */
export function apiErrorMessage(err: unknown, errors: PortalContent["auth"]["errors"]): string {
  const code = err instanceof ApiError ? err.code : "generic";
  const map: Record<string, string> = {
    email_taken: errors.emailTaken,
    rate_limited: errors.rateLimited,
    invalid: errors.invalid,
    required: errors.required,
    empty: errors.required,
    email_invalid: errors.emailInvalid,
    invalid_email: errors.emailInvalid,
    not_found: errors.generic,
    forbidden: errors.generic,
    unauthorized: errors.generic,
    bad_origin: errors.generic,
  };
  return map[code] ?? errors.generic;
}

const dfnsLocale = (locale: Locale) => (locale === "ar" ? arDfns : undefined);

/** تاريخ مختصر مترجم (PP = 12 يناير 2026) */
export function fmtDate(value: string | null | undefined, locale: Locale, pattern = "PP"): string {
  if (!value) return "";
  return format(new Date(value), pattern, { locale: dfnsLocale(locale) });
}

/** تاريخ ووقت مترجم */
export function fmtDateTime(value: string | null | undefined, locale: Locale): string {
  return fmtDate(value, locale, "P p");
}

/** زمن نسبي مترجم (قبل 3 دقائق) */
export function fmtRelative(value: string | null | undefined, locale: Locale): string {
  if (!value) return "";
  return formatDistanceToNow(new Date(value), { addSuffix: true, locale: dfnsLocale(locale) });
}

/** يوم مختصر من تاريخ (للرسم البياني) */
export function fmtDayLabel(date: string, locale: Locale): string {
  return format(new Date(`${date}T00:00:00`), "EEEEEE", { locale: dfnsLocale(locale) });
}

/** حجم ملف بصيغة مقروءة — الوحدات رموز قياسية */
export function formatBytes(size: number): string {
  if (!Number.isFinite(size) || size <= 0) return "0 B";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  return `${(size / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

/** الحد الأقصى لعدد الصفحات من الإجمالي وحجم الصفحة */
export function totalPages(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
}

/** مبني استعلام URL نظيف من قيم غير فارغة */
export function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "" || value === false) continue;
    if (value === true) {
      sp.set(key, "1");
      continue;
    }
    sp.set(key, String(value));
  }
  const q = sp.toString();
  return q ? `?${q}` : "";
}
