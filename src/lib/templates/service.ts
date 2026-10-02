/**
 * طبقة خدمة قوالب الصفحات — §5:
 * - الزرع الآلي للقوالب المدمجة (idempotent بمفتاح ثابت — لا يكتب فوق محتوى زُرع سابقًا)
 * - إنشاء قالب مخصص من محتوى لغة واحدة (يمر عبر validateContent — يُخزن المطبّع لا الأصلي)
 * - تطبيق قالب على مسودة صفحة: لقطة احتياطية تلقائية + قفل مراجعة ذري + تدقيق
 * - حذف القوالب المخصصة فقط — المدمجة للقراءة
 *
 * كل عمليات الكتابة تُدوَّن في AuditLog بلا محتوى كامل (الأسماء والمفاتيح فقط).
 */
import { db } from "@/lib/db";
import { validateContent } from "@/lib/blocks/validate";
import { BUILTIN_TEMPLATES } from "./builtin";

export type TemplateLocale = "ar" | "en";

/** يحسم محتوى القالب للغة المطلوبة — القالب بلا محتوى لهذه اللغة يُرفض صراحة (لا احتياط صامت) */
export function resolveTemplateBlocks(
  template: { blocksAr: string | null; blocksEn: string | null },
  locale: TemplateLocale
): { ok: true; blocks: string } | { ok: false; error: "template_locale_missing" } {
  const blocks = locale === "en" ? template.blocksEn : template.blocksAr;
  if (!blocks) return { ok: false, error: "template_locale_missing" };
  return { ok: true, blocks };
}

/** زرع القوالب المدمجة — يُستدعى من GET القائمة؛ إنشاء فقط دون تحديث (idempotent) */
export async function ensureBuiltinTemplates(): Promise<void> {
  for (const def of BUILTIN_TEMPLATES) {
    const checkAr = validateContent(JSON.stringify({ schemaVersion: 1, blocks: def.blocksAr }));
    const checkEn = validateContent(JSON.stringify({ schemaVersion: 1, blocks: def.blocksEn }));
    // القوالب المدمجة تُختبر في CI — الفشل هنا خلل بنائي يظهر فورًا ولا يُصمت
    if (!checkAr.ok) throw new Error(`builtin_template_invalid:${def.key}:${checkAr.error}`);
    if (!checkEn.ok) throw new Error(`builtin_template_invalid:${def.key}:${checkEn.error}`);
    const existing = await db.pageTemplate.findUnique({ where: { key: def.key }, select: { id: true } });
    if (!existing) {
      await db.pageTemplate.create({
        data: {
          key: def.key,
          nameAr: def.nameAr,
          nameEn: def.nameEn,
          descAr: def.descAr,
          descEn: def.descEn,
          kind: "builtin",
          blocksAr: checkAr.json,
          blocksEn: checkEn.json,
        },
      });
    }
  }
}

/** مدخل إنشاء قالب مخصص — تطبيع صارم قبل أي كتابة */
export interface CreateTemplateInput {
  nameAr?: unknown;
  nameEn?: unknown;
  descAr?: unknown;
  descEn?: unknown;
  blocksAr?: unknown;
  blocksEn?: unknown;
}

export function parseCreateTemplateInput(
  body: CreateTemplateInput
): { ok: true; data: { nameAr: string; nameEn: string; descAr: string | null; descEn: string | null; blocksAr: string | null; blocksEn: string | null } } | { ok: false; error: string } {
  const nameAr = typeof body.nameAr === "string" ? body.nameAr.trim().slice(0, 120) : "";
  const nameEn = typeof body.nameEn === "string" ? body.nameEn.trim().slice(0, 120) : "";
  const descAr = typeof body.descAr === "string" && body.descAr.trim() ? body.descAr.trim().slice(0, 400) : null;
  const descEn = typeof body.descEn === "string" && body.descEn.trim() ? body.descEn.trim().slice(0, 400) : null;

  // محتوى واحد على الأقل مطلوب — يمر عبر بوابة التحقق ويُخزن مطبّعًا
  let blocksAr: string | null = null;
  let blocksEn: string | null = null;
  if (typeof body.blocksAr === "string" && body.blocksAr.trim()) {
    const check = validateContent(body.blocksAr);
    if (!check.ok) return { ok: false, error: check.error };
    blocksAr = check.json;
  }
  if (typeof body.blocksEn === "string" && body.blocksEn.trim()) {
    const check = validateContent(body.blocksEn);
    if (!check.ok) return { ok: false, error: check.error };
    blocksEn = check.json;
  }
  if (!blocksAr && !blocksEn) return { ok: false, error: "blocks_required" };
  if (!nameAr && !nameEn) return { ok: false, error: "name_required" };

  return {
    ok: true,
    data: {
      nameAr: nameAr || nameEn,
      nameEn: nameEn || nameAr,
      descAr,
      descEn,
      blocksAr,
      blocksEn,
    },
  };
}

/**
 * مدخل تحديث بيانات قالب مخصص (§D جولة 34 — إعادة التسمية).
 *
 * دلالات الحقول (الواجهة ترسل الأربعة معبّأة مسبقًا):
 * - الاسم: غائب/فارغ → يبقى الحالي (لا يمكن تفريغ الاسم؛ لا أسقط إلى fallback عبر اللغتين إلا عند التحديث الفعلي)
 * - الوصف: غائب → يبقى الحالي؛ حاضر فارغ → يُمسح صراحة (null)
 * - الأسماء النهائية يجب ألا تكون كلها فارغة، والتعبئة المتقاطعة بين اللغتين كما في الإنشاء
 */
export interface UpdateTemplateInput {
  nameAr?: unknown;
  nameEn?: unknown;
  descAr?: unknown;
  descEn?: unknown;
}

export function parseUpdateTemplateInput(
  body: UpdateTemplateInput,
  current: { nameAr: string; nameEn: string; descAr: string | null; descEn: string | null }
): { ok: true; data: { nameAr: string; nameEn: string; descAr: string | null; descEn: string | null; changed: string[] } } | { ok: false; error: string } {
  const readName = (v: unknown): string | null => {
    if (typeof v !== "string") return null; // غائب → احتفظ
    const t = v.trim().slice(0, 120);
    return t ? t : null; // فارغ → احتفظ (الاسم لا يُفرَّغ)
  };
  const readDesc = (v: unknown, present: (x: unknown) => boolean): string | null | undefined => {
    if (!present(v)) return undefined; // غائب → احتفظ
    if (typeof v !== "string") return undefined;
    const t = v.trim().slice(0, 400);
    return t ? t : null; // حاضر فارغ → مسح صريح
  };

  const hasKey = (obj: UpdateTemplateInput, key: keyof UpdateTemplateInput): boolean => Object.hasOwn(obj, key);

  const nextNameAr = readName(body.nameAr) ?? current.nameAr;
  const nextNameEn = readName(body.nameEn) ?? current.nameEn;
  const descArRaw = readDesc(body.descAr, (x) => hasKey(body, "descAr"));
  const descEnRaw = readDesc(body.descEn, (x) => hasKey(body, "descEn"));
  const nextDescAr = descArRaw === undefined ? current.descAr : descArRaw;
  const nextDescEn = descEnRaw === undefined ? current.descEn : descEnRaw;

  if (!nextNameAr && !nextNameEn) return { ok: false, error: "name_required" };

  const changed: string[] = [];
  if (nextNameAr !== current.nameAr) changed.push("nameAr");
  if (nextNameEn !== current.nameEn) changed.push("nameEn");
  if (nextDescAr !== current.descAr) changed.push("descAr");
  if (nextDescEn !== current.descEn) changed.push("descEn");
  if (changed.length === 0) return { ok: false, error: "nothing_to_update" };

  return {
    ok: true,
    data: {
      nameAr: nextNameAr || nextNameEn,
      nameEn: nextNameEn || nextNameAr,
      descAr: nextDescAr,
      descEn: nextDescEn,
      changed,
    },
  };
}

/**
 * بصمة معاينة مصغرة للقالب — أنواع الكتل العلوية بترتيبها (بلا محتوى).
 * تُغذي رسمًا تخطيطيًا مصغرًا (wireframe) في حوار القوالب حتى يميّز المحرر
 * القوالب بنظرة قبل التطبيق. بلا نصوص أو معرفات — آمنة للعرض دائمًا.
 */
export const TEMPLATE_PREVIEW_MAX = 14;

export function templatePreview(json: string | null): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json) as { blocks?: unknown };
    if (!Array.isArray(parsed.blocks)) return [];
    const types: string[] = [];
    for (const node of parsed.blocks) {
      if (typeof node === "object" && node !== null) {
        const type = (node as { type?: unknown }).type;
        if (typeof type === "string" && type) types.push(type);
      }
      if (types.length >= TEMPLATE_PREVIEW_MAX) break;
    }
    return types;
  } catch {
    return [];
  }
}

/** بيانات القالب للقائمة — بلا محتوى كامل (يُجلب فقط عند التطبيق في الخادم) */
export function templateListItem(t: {
  id: string;
  key: string | null;
  nameAr: string;
  nameEn: string;
  descAr: string | null;
  descEn: string | null;
  kind: string;
  blocksAr: string | null;
  blocksEn: string | null;
  usageCount: number;
  updatedAt: Date;
  createdBy?: { name: string } | null;
}) {
  const nodeCount = (json: string | null): number => {
    if (!json) return 0;
    try {
      const parsed = JSON.parse(json) as { blocks?: unknown };
      if (!Array.isArray(parsed.blocks)) return 0;
      const count = (nodes: unknown[]): number =>
        nodes.reduce<number>(
          (acc, n) => acc + 1 + (typeof n === "object" && n !== null && Array.isArray((n as { children?: unknown }).children) ? count((n as { children: unknown[] }).children) : 0),
          0
        );
      return count(parsed.blocks);
    } catch {
      return 0;
    }
  };
  return {
    id: t.id,
    key: t.key,
    nameAr: t.nameAr,
    nameEn: t.nameEn,
    descAr: t.descAr,
    descEn: t.descEn,
    kind: t.kind, // builtin | custom
    hasAr: Boolean(t.blocksAr),
    hasEn: Boolean(t.blocksEn),
    arPreview: templatePreview(t.blocksAr),
    enPreview: templatePreview(t.blocksEn),
    arNodeCount: nodeCount(t.blocksAr),
    enNodeCount: nodeCount(t.blocksEn),
    usageCount: t.usageCount,
    createdBy: t.createdBy?.name ?? null,
    updatedAt: t.updatedAt,
  };
}
