/**
 * حقول التحرير النصي المباشر (inline editing):
 * خرائط الحقول القابلة للتحرير داخل لوحة الرسم لكل نوع كتلة، وأدوات قراءة/
 * كتابة القيمة داخل props العقدة بسلامة (بلا مساس ببقية الخصائص).
 *
 * صيغة الحقل:
 * - "text" | "label" | "kicker" | "title" — مفتاح مباشر في props
 * - "paragraphs:0" — عنصر نصي داخل مصفوفة في props
 * - "items:0.title" — خاصية كائن داخل عنصر مصفوفة (عناوين البطاقات والأسئلة)
 *
 * حدود الطول تُحل حسب المسار: المفاتيح المباشرة بمفتاحها، ومسارات العناصر
 * بنمط "key:*.prop" — القص على حد أدنى من حد المخطط آمن دائمًا (لا يفشل الحفظ).
 */

/** الأنواع التي تدعم التحرير المباشر للنص في لوحة الرسم (خارطة الطريق 1.3 — G3) */
export const INLINE_EDITABLE_TYPES = [
  "heading",
  "text",
  "buttonLink",
  "richText",
  "ctaSection",
  "faqSection",
  "numberedList",
  "numberedValues",
  "featureGrid",
  "processSteps",
] as const;

export type InlineEditableType = (typeof INLINE_EDITABLE_TYPES)[number];

/** الحقل الأساسي الذي يتلقى التركيز عند بدء جلسة التحرير لكل نوع */
export const INLINE_PRIMARY_FIELD: Record<InlineEditableType, string> = {
  heading: "text",
  text: "paragraphs:0",
  buttonLink: "label",
  richText: "paragraphs:0",
  ctaSection: "title",
  faqSection: "title",
  numberedList: "title",
  numberedValues: "title",
  featureGrid: "title",
  processSteps: "title",
};

/** الحد الأقصى لطول كل حقل — مطابق لمخططات zod حتى لا يفشل الحفظ التلقائي */
const FIELD_MAX: Record<string, number> = {
  // مفاتيح مباشرة
  text: 300, // heading.text
  kicker: 120,
  label: 120,
  paragraphs: 5000,
  heading: 300, // richText.heading
  lead: 2000, // richText.lead
  title: 300, // العناوين المباشرة (ctaSection/numberedList/numberedValues/faq/featureGrid/processSteps)
  body: 1500, // ctaSection.body
  q: 600, // محجوز للاستخدام المباشر — أسئلة FAQ تُحرر عبر المسار أدناه
  // مسارات عناصر المصفوفات الكائنية — "key:*.prop"
  "items:*.title": 200, // titledBody.title (numberedList/numberedValues/featureGrid)
  "items:*.body": 3000, // titledBody.body
  "steps:*.title": 200, // processSteps.steps
  "items:*.q": 600, // faqSection.items (متاح للتعميم لاحقًا)
};

export function isInlineEditableType(type: string): type is InlineEditableType {
  return (INLINE_EDITABLE_TYPES as readonly string[]).includes(type);
}

/** تفكيك الحقل إلى أجزائه: "items:0.title" → key=items, index="0", prop="title" */
function splitField(field: string): { key: string; index: string | null; prop: string | null } {
  const colon = field.indexOf(":");
  if (colon < 0) return { key: field, index: null, prop: null };
  const key = field.slice(0, colon);
  const rest = field.slice(colon + 1);
  const dot = rest.indexOf(".");
  if (dot < 0) return { key, index: rest, prop: null };
  return { key, index: rest.slice(0, dot), prop: rest.slice(dot + 1) };
}

/** حد الطول للمسار — المباشر بمفتاحه، وعناصر المصفوفات بنمط "key:*.prop" */
function maxForField(key: string, index: string | null, prop: string | null): number | undefined {
  if (index === null) return FIELD_MAX[key];
  if (prop === null) return FIELD_MAX[key];
  return FIELD_MAX[`${key}:*.${prop}`];
}

/** قراءة قيمة حقل من props — تُرجع null إن كان الحقل غير موجود */
export function readInlineField(props: unknown, field: string): string | null {
  if (typeof props !== "object" || props === null) return null;
  const record = props as Record<string, unknown>;
  const { key, index, prop } = splitField(field);

  if (index === null) {
    const v = record[key];
    return typeof v === "string" ? v : null;
  }

  const idx = Number(index);
  if (!Number.isInteger(idx) || idx < 0) return null;
  const arr = record[key];
  if (!Array.isArray(arr) || idx >= arr.length) return null;

  if (prop === null) {
    const v = arr[idx];
    return typeof v === "string" ? v : null;
  }

  const entry = arr[idx];
  if (typeof entry !== "object" || entry === null || Array.isArray(entry)) return null;
  const v = (entry as Record<string, unknown>)[prop];
  return typeof v === "string" ? v : null;
}

/**
 * كتابة قيمة حقل داخل نسخة من props — لا تعدّل الأصل.
 * تُرجع null عند تعذر التطبيق (حقل غريب/فهرس خارج النطاق/عنصر غير كائن)
 * لتتجاهله الواجهة بدل أن تفسد الخصائص. القيمة تُقتطع على الحد الأقصى للمخطط.
 */
export function applyInlineField(
  props: Record<string, unknown>,
  field: string,
  value: string
): Record<string, unknown> | null {
  const { key, index, prop } = splitField(field);
  if (!key) return null;
  const max = maxForField(key, index, prop);
  if (max === undefined) return null; // حقل غير معروف — لا كتابة صامتة
  const clamped = typeof max === "number" ? value.slice(0, max) : value;

  if (index === null) {
    const next = { ...props };
    next[key] = clamped;
    return next;
  }

  const idx = Number(index);
  if (!Number.isInteger(idx) || idx < 0) return null;
  const arr = props[key];
  if (!Array.isArray(arr)) return null;

  if (prop === null) {
    if (idx >= arr.length) return null;
    const nextArr = arr.slice();
    nextArr[idx] = clamped;
    return { ...props, [key]: nextArr };
  }

  if (idx >= arr.length) return null;
  const entry = arr[idx];
  if (typeof entry !== "object" || entry === null || Array.isArray(entry)) return null;
  const nextEntry = { ...(entry as Record<string, unknown>) };
  nextEntry[prop] = clamped;
  const nextArr = arr.slice();
  nextArr[idx] = nextEntry;
  return { ...props, [key]: nextArr };
}
