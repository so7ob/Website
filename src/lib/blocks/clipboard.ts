/**
 * حافظة الكتل عبر الصفحات — بند 1.1 من خارطة الطريق (فجوة G1).
 *
 * نسخ شجرة كتلة (بأبنائها) إلى localStorage واللصق في أي صفحة أو لغة
 * بمعرفات جديدة عند اللصق. أنماط الأجهزة (style.base/mobile/tablet/desktop)
 * والظهور لكل جهاز تُحفظ ضمن العقدة لأن الاستنساخ عميق.
 *
 * العقود:
 * - قراءة/كتابة دفاعية: أي بيانات فاسدة أو ناقصة تُهمل بهدوء (نمط المشروع).
 * - سعة ثابتة CLIPBOARD_MAX — الأحدث أولًا، وتكرار نسخ نفس الجذر يستبدل القديم.
 * - توليد المعرفات عند اللصق فقط عبر cloneWithNewIds — لا معرفات مكررة أبدًا.
 * - لا استخدام في الخادم إطلاقًا — أدوات محرر العميل فقط.
 */
import { cloneWithNewIds, type ContentNode } from "./tree";

/** مفتاح التخزين — إصدار بذاته للسماح بترقية الشكل لاحقًا دون كسر القديم */
export const CLIPBOARD_KEY = "so7ob.editor.clipboard.v1";

/** السعة القصوى للمدخلات المحفوظة (الأحدث أولًا) */
export const CLIPBOARD_MAX = 8;

export interface ClipboardEntry {
  /** معرف المدخل نفسه — للعرض والاختيار في قائمة اللصق */
  entryId: string;
  /** لقطة العقدة وقت النسخ (بأبنائها كما كانت) */
  node: ContentNode;
  /** وقت النسخ ISO */
  copiedAt: string;
}

/** فحص شكل عقدة مخزنة — ملكية مباشرة للحقول دون ثقة بالبيانات الخارجية */
function isContentNode(v: unknown): v is ContentNode {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
  const rec = v as Record<string, unknown>;
  return typeof rec.id === "string" && rec.id.length > 0 && typeof rec.type === "string" && rec.type.length > 0;
}

function isEntry(v: unknown): v is ClipboardEntry {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
  const rec = v as Record<string, unknown>;
  return typeof rec.entryId === "string" && rec.entryId.length > 0 && isContentNode(rec.node);
}

/** قراءة مدخلات الحافظة — تعمل بأمان على الخادم (تعيد []) ومع البيانات الفاسدة */
export function readClipboard(): ClipboardEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CLIPBOARD_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: ClipboardEntry[] = [];
    for (const item of parsed) {
      if (isEntry(item)) out.push({ entryId: item.entryId, node: item.node, copiedAt: typeof item.copiedAt === "string" ? item.copiedAt : "" });
    }
    return out.slice(0, CLIPBOARD_MAX);
  } catch {
    return [];
  }
}

function writeClipboard(entries: ClipboardEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CLIPBOARD_KEY, JSON.stringify(entries.slice(0, CLIPBOARD_MAX)));
  } catch {
    // التخزين ممتلئ أو محجوب — اللصق داخل الجلسة يبقى مستحيلًا لكن لا نكسر المحرر
  }
}

/**
 * نسخ عقدة (مع شجرتها) إلى الحافظة — لقطة عميقية لحظة النسخ.
 * نسخ نفس الجذر مرة أخرى يستبدل المدخل القديم بالأحدث (آخر تعديل هو المهم).
 * يعيد القائمة الجديدة كاملة لتحديث حالة الواجهة دفعة واحدة.
 */
export function copyToClipboard(node: ContentNode): ClipboardEntry[] {
  const entry: ClipboardEntry = {
    entryId: `cp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    node: structuredClone(node),
    copiedAt: new Date().toISOString(),
  };
  const next = [entry, ...readClipboard().filter((e) => e.node.id !== node.id)].slice(0, CLIPBOARD_MAX);
  writeClipboard(next);
  return next;
}

/** إزالة مدخل واحد من الحافظة (من قائمة اللصق) */
export function removeFromClipboard(entryId: string): ClipboardEntry[] {
  const next = readClipboard().filter((e) => e.entryId !== entryId);
  writeClipboard(next);
  return next;
}

/** إفراغ الحافظة كليًا */
export function clearClipboardStorage(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(CLIPBOARD_KEY);
  } catch {
    // لا شيء — الإزالة ليست حرجة
  }
}

/**
 * إنتاج نسخة قابلة للإدراج من مدخل مخزن: استنساخ عميق بمعرفات جديدة
 * فريدة مقابل المعرفات المأخوذة في الصفحة الهدف (الخصائص والأنماط والظهور كما هي).
 */
export function pasteEntryNode(entry: ClipboardEntry, takenIds: Set<string>, suffixGen: () => string): ContentNode {
  return cloneWithNewIds(structuredClone(entry.node), takenIds, suffixGen);
}
