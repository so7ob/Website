/**
 * حقول التحرير النصي المباشر (inline editing):
 * خرائط الحقول القابلة للتحرير داخل لوحة الرسم لكل نوع كتلة، وأدوات قراءة/
 * كتابة القيمة داخل props العقدة بسلامة (بلا مساس ببقية الخصائص).
 *
 * صيغة الحقل:
 * - "text" | "label" | "kicker" — مفتاح مباشر في props
 * - "paragraphs:0" — عنصر داخل مصفوفة في props
 */

/** الأنواع التي تدعم التحرير المباشر للنص في لوحة الرسم */
export const INLINE_EDITABLE_TYPES = ["heading", "text", "buttonLink"] as const;

export type InlineEditableType = (typeof INLINE_EDITABLE_TYPES)[number];

/** الحقل الأساسي الذي يتلقى التركيز عند بدء جلسة التحرير لكل نوع */
export const INLINE_PRIMARY_FIELD: Record<InlineEditableType, string> = {
  heading: "text",
  text: "paragraphs:0",
  buttonLink: "label",
};

/** الحد الأقصى لطول كل حقل — مطابق لمخططات zod حتى لا يفشل الحفظ التلقائي */
const FIELD_MAX: Record<string, number> = {
  text: 300, // heading.text
  kicker: 120,
  label: 120,
  paragraphs: 5000,
};

export function isInlineEditableType(type: string): type is InlineEditableType {
  return (INLINE_EDITABLE_TYPES as readonly string[]).includes(type);
}

/** قراءة قيمة حقل من props — تُرجع null إن كان الحقل غير موجود */
export function readInlineField(props: unknown, field: string): string | null {
  if (typeof props !== "object" || props === null) return null;
  const record = props as Record<string, unknown>;
  const [key, indexStr] = splitField(field);
  if (indexStr === null) {
    const v = record[key];
    return typeof v === "string" ? v : null;
  }
  const arr = record[key];
  if (!Array.isArray(arr)) return null;
  const index = Number(indexStr);
  if (!Number.isInteger(index) || index < 0 || index >= arr.length) return null;
  const v = arr[index];
  return typeof v === "string" ? v : null;
}

/**
 * كتابة قيمة حقل داخل نسخة من props — لا تعدّل الأصل.
 * تُرجع null عند تعذر التطبيق (حقل غريب/فهرس خارج النطاق) لتتجاهله الواجهة
 * بدل أن تفسد الخصائص. القيمة تُقتطع على الحد الأقصى للمخطط.
 */
export function applyInlineField(
  props: Record<string, unknown>,
  field: string,
  value: string
): Record<string, unknown> | null {
  const [key, indexStr] = splitField(field);
  if (!key) return null;
  const max = FIELD_MAX[key];
  const clamped = typeof max === "number" ? value.slice(0, max) : value;

  if (indexStr === null) {
    if (max === undefined) return null; // حقل غير معروف — لا كتابة صامتة
    const next = { ...props };
    next[key] = clamped;
    return next;
  }

  const arr = props[key];
  if (!Array.isArray(arr)) return null;
  const index = Number(indexStr);
  if (!Number.isInteger(index) || index < 0 || index >= arr.length) return null;
  if (max === undefined) return null;
  const nextArr = arr.slice();
  nextArr[index] = clamped;
  return { ...props, [key]: nextArr };
}

/** تفكيك "paragraphs:2" إلى ["paragraphs", "2"] — والمفاتيح المباشرة بلا فهرس */
function splitField(field: string): [string, string | null] {
  const colon = field.indexOf(":");
  if (colon < 0) return [field, null];
  return [field.slice(0, colon), field.slice(colon + 1)];
}
