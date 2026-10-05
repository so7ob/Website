/**
 * ربط المعاينة بمصدر محدد — خارطة الطريق 5.5 (G11).
 *
 * المتطلب الأصلي §2: «المعاينة مرتبطة بمراجعة». قبل هذا الملف كانت المعاينة
 * تعرض المسودة الحالية حصرًا بلا ربط صريح بمصدر. الآن كل معاينة مثبتة بمصدر واحد من اثنين:
 *
 * - المسودة الحالية (بلا بارامتر revision): حالة العمل الجارية — لا تمثل أي إصدار منشور.
 * - إصدار منشور (revision=N): لقطة PageVersion غير قابلة للتغيير، وهي **لكل لغة على حدة**
 *   (قيود unique pageId+locale+version) — لذا الربط ثنائيّ البعد (رقم الإصدار، لغة المحتوى).
 *
 * الدوال خالصة وقابلة للاختبار؛ الوصول للقاعدة يمر عبر مُحقن fetchVersion
 * (صفحة المعاينة تمرر استعلام Prisma) — لا استيراد db هنا.
 */
import type { Locale } from "@/lib/i18n";

/** نتيجة تحليل بارامتر الاستعلام revision */
export type ParsedRevision = number | null | "invalid";

/**
 * تحليل بارامتر الاستعلام:
 * - غياب/فراغ/فراغات بيضاء → null (معاينة مسودة — السلوك القائم محفوظ)
 * - عدد صحيح عشري ≥ 1 → رقم الإصدار
 * - أي شيء آخر (نص، كسور، صفر، سالب، عدد خارج النطاق الآمن) → "invalid" (خطأ صريح لا صفحة فارغة)
 */
export function parseRevisionParam(raw: string | undefined | null): ParsedRevision {
  if (raw === undefined || raw === null) return null;
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  if (!/^\d+$/.test(trimmed)) return "invalid";
  const n = Number(trimmed);
  if (!Number.isSafeInteger(n) || n < 1) return "invalid";
  return n;
}

export interface PreviewVersionMeta {
  version: number;
  note: string | null;
  authorName: string;
  createdAt: Date;
}

/** مصدر المحتوى الذي تثبت عليه المعاينة */
export type PreviewSource =
  | { kind: "draft"; blocksJson: string }
  | { kind: "version"; blocksJson: string; meta: PreviewVersionMeta }
  | { kind: "invalid_revision" }
  | { kind: "version_not_found" };

interface PreviewPageLike {
  draftBlocksAr: string;
  draftBlocksEn: string;
}

/** شكل الإصدار كما يعيده المُحقن — blocks JSON جاهز للعرض عبر بوابة التحقق */
export interface PreviewVersionRecord {
  version: number;
  blocks: string;
  note: string | null;
  authorName: string;
  createdAt: Date;
}

export type VersionFetcher = (
  pageId: string,
  locale: Locale,
  version: number
) => Promise<PreviewVersionRecord | null>;

/**
 * حل مصدر المعاينة بترتيب بوابات صريح:
 * 1) بارامتر غير صالح → invalid_revision (لا تجربة مسودة احتياطًا — الصريح أولى)
 * 2) بلا بارامتر → مسودة اللغة المطلوبة
 * 3) إصدار غير موجود **لهذه اللغة** → version_not_found
 *    (الإصدارات لكل لغة: رقم موجود بالعربية قد لا يقابل بالإنجليزية)
 * 4) غير ذلك → لقطة الإصدار المطلوبة
 *
 * صفحة مؤرشفة تبقى قابلة للمعاينة بمصدرَيها — المراجعة التاريخية حق للطاقم
 * ولا تسرّب شيئًا: بوابة الصلاحية pages.view على الصفحة كلها سبق الوصول هنا.
 */
export async function resolvePreviewSource(
  page: PreviewPageLike,
  opts: { pageId: string; locale: Locale; revisionParam: string | undefined | null; fetchVersion: VersionFetcher }
): Promise<PreviewSource> {
  const parsed = parseRevisionParam(opts.revisionParam);
  if (parsed === "invalid") return { kind: "invalid_revision" };

  if (parsed === null) {
    return {
      kind: "draft",
      blocksJson: opts.locale === "en" ? page.draftBlocksEn : page.draftBlocksAr,
    };
  }

  const record = await opts.fetchVersion(opts.pageId, opts.locale, parsed);
  if (!record) return { kind: "version_not_found" };

  return {
    kind: "version",
    blocksJson: record.blocks,
    meta: {
      version: record.version,
      note: record.note,
      authorName: record.authorName,
      createdAt: record.createdAt,
    },
  };
}

/** رسالة خطأ المعاينة حسب النتيجة — مترجمة عند الاستدعاء عبر مفاتيح portal */
export function previewSourceErrorKind(source: PreviewSource): "invalid_revision" | "version_not_found" | null {
  if (source.kind === "invalid_revision") return "invalid_revision";
  if (source.kind === "version_not_found") return "version_not_found";
  return null;
}
