/**
 * تتبع استخدام الوسائط (§7) — مصدر الحقيقة الوحيد لمكان ظهور كل صورة.
 *
 * الوسائط تُشير إليها الكتل عبر الرابط /api/media/{id} داخل نصوص JSON
 * (مسودات الصفحات، المنشور، القوالب) — ومطابقة المعرف يجب أن تكون صارمة
 * على الحدود: /api/media/abc لا يطابق /api/media/abcdef.
 *
 * القرارات:
 * - الاستخدام في **منشور** = حاجز حذف صلب (حذفه يعطل صفحة حية).
 * - الاستخدام في **مسودة** = حاجز حذف أيضًا (المحرر قد يعيد الإدراج؛
 *   الأدمن يزيل الاستخدام أولًا فيصبح الحذف ممكنًا — لا صمت ولا تعطل).
 * - الاستخدام في **قوالب** مدمجة أو مخصصة = حاجز حذف (تطبيق القالب يعيد إدراج الرابط الميت).
 * - صورة المشاركة ogMediaId حقل علائقي منطقي — يدخل في الحاجز نفسه.
 */
import { db } from "@/lib/db";

export const MEDIA_URL_PREFIX = "/api/media/";

/**
 * استخراج كل معرفات الوسائط المشار إليها في نص JSON — مطابقة على حدود المعرف.
 * يعيدها كـ Set بلا تكرار. آمن على نصوص غير صالحة (يرجع فارغًا).
 */
export function extractMediaRefs(text: string | null | undefined): Set<string> {
  const refs = new Set<string>();
  if (!text || !text.includes(MEDIA_URL_PREFIX)) return refs;
  // الالتقاط الجائع يعيد المعرف الكامل دائمًا — الروابط في JSON تحمل معرفات مكتملة
  const global = new RegExp(`${MEDIA_URL_PREFIX}([0-9a-zA-Z_-]+)`, "g");
  let m: RegExpExecArray | null;
  while ((m = global.exec(text)) !== null) {
    refs.add(m[1]);
  }
  return refs;
}

/** هل يشير هذا النص إلى وسيلة معينة؟ مطابقة بحدود معرف صارمة (لا مطابقة جزئية). */
export function textReferencesMedia(text: string | null | undefined, mediaId: string): boolean {
  if (!text || !mediaId || !text.includes(MEDIA_URL_PREFIX)) return false;
  // حدود يسار: بداية السلسلة أو ما ليس [0-9a-zA-Z_-] قبل المعرف؛
  // حدود يمين: نهاية السلسلة أو ما ليس [0-9a-zA-Z_-] بعده.
  const pattern = new RegExp(`${MEDIA_URL_PREFIX}${escapeRegExp(mediaId)}(?![0-9a-zA-Z_-])`);
  return pattern.test(text);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ——— أنواع المواقع ———

export type MediaUsageKind = "page_published" | "page_draft" | "page_og" | "template";

export interface MediaUsageLocation {
  kind: MediaUsageKind;
  /** معرف الكيان (صفحة/قالب) — للروابط في الواجهة */
  entityId: string;
  /** عنوان عربي/إنجليزي لعرضه في الواجهة */
  titleAr: string;
  titleEn: string;
  /** اللغة التي يظهر فيها الاستخدام داخل المحتوى (أو null لصورة المشاركة) */
  locale: "ar" | "en" | null;
  /** مسودة أم منشور — يهم للرسالة */
  state: "draft" | "published" | null;
  /** صفحة مؤرشفة — لا تظهر للزوار لكن استعادتها تعيد الوسيلة (تُعرض بوضوح) */
  archived?: boolean;
}

/**
 * فحص استخدام وسيلة واحدة عبر الصفحات والقوالب — يُستخدم لحاجز الحذف
 * ولعرض «أين تُستخدم» في الواجهة.
 */
export async function findMediaUsage(mediaId: string): Promise<MediaUsageLocation[]> {
  if (!mediaId) return [];
  const [pages, templates] = await Promise.all([
    db.page.findMany({
      select: {
        id: true, slug: true, titleAr: true, titleEn: true, status: true,
        ogMediaId: true,
        draftBlocksAr: true, draftBlocksEn: true,
        publishedBlocksAr: true, publishedBlocksEn: true,
      },
    }),
    db.pageTemplate.findMany({
      select: { id: true, nameAr: true, nameEn: true, kind: true, blocksAr: true, blocksEn: true },
    }),
  ]);

  const usage: MediaUsageLocation[] = [];

  for (const p of pages) {
    const archived = p.status === "archived";
    if (p.ogMediaId === mediaId) {
      usage.push({ kind: "page_og", entityId: p.id, titleAr: p.titleAr, titleEn: p.titleEn, locale: null, state: null, archived });
    }
    if (textReferencesMedia(p.publishedBlocksAr, mediaId)) {
      usage.push({ kind: "page_published", entityId: p.id, titleAr: p.titleAr, titleEn: p.titleEn, locale: "ar", state: "published", archived });
    }
    if (textReferencesMedia(p.publishedBlocksEn, mediaId)) {
      usage.push({ kind: "page_published", entityId: p.id, titleAr: p.titleAr, titleEn: p.titleEn, locale: "en", state: "published", archived });
    }
    if (textReferencesMedia(p.draftBlocksAr, mediaId)) {
      usage.push({ kind: "page_draft", entityId: p.id, titleAr: p.titleAr, titleEn: p.titleEn, locale: "ar", state: "draft", archived });
    }
    if (textReferencesMedia(p.draftBlocksEn, mediaId)) {
      usage.push({ kind: "page_draft", entityId: p.id, titleAr: p.titleAr, titleEn: p.titleEn, locale: "en", state: "draft", archived });
    }
  }

  for (const tp of templates) {
    if (textReferencesMedia(tp.blocksAr, mediaId)) {
      usage.push({ kind: "template", entityId: tp.id, titleAr: tp.nameAr, titleEn: tp.nameEn, locale: "ar", state: null });
    }
    if (textReferencesMedia(tp.blocksEn, mediaId)) {
      usage.push({ kind: "template", entityId: tp.id, titleAr: tp.nameAr, titleEn: tp.nameEn, locale: "en", state: null });
    }
  }

  return usage;
}

/**
 * عدّاد استخدام لكل الوسائط دفعة واحدة — فحص واحد للصفحات والقوالب
 * يبني خريطة id → عدد. مناسب لشبكة المكتبة (جدول صغير، فحص رخيص).
 */
export async function mediaUsageCounts(): Promise<Map<string, number>> {
  const [pages, templates] = await Promise.all([
    db.page.findMany({
      select: {
        ogMediaId: true,
        draftBlocksAr: true, draftBlocksEn: true,
        publishedBlocksAr: true, publishedBlocksEn: true,
      },
    }),
    db.pageTemplate.findMany({ select: { blocksAr: true, blocksEn: true } }),
  ]);

  const counts = new Map<string, number>();
  const bump = (id: string) => counts.set(id, (counts.get(id) ?? 0) + 1);

  for (const p of pages) {
    if (p.ogMediaId) bump(p.ogMediaId);
    for (const text of [p.publishedBlocksAr, p.publishedBlocksEn, p.draftBlocksAr, p.draftBlocksEn]) {
      for (const id of extractMediaRefs(text)) bump(id);
    }
  }
  for (const tp of templates) {
    for (const text of [tp.blocksAr, tp.blocksEn]) {
      for (const id of extractMediaRefs(text)) bump(id);
    }
  }
  return counts;
}

/** تطبيع اسم مجلد الوسائط — نص غير فارغ 1-60 بلا محارف تحكم؛ الغائب/الفارغ يعني general. */
export function normalizeMediaFolder(raw: unknown): string | null {
  if (raw === undefined || raw === null) return "general";
  const s = String(raw).trim().replace(/[\u0000-\u001f\u007f]/g, "");
  if (!s) return "general";
  if (s.length > 60) return null;
  return s;
}
