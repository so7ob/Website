/**
 * مقارنة إصدارات الصفحة (خارطة الطريق 1.4 — G4).
 *
 * الفلسفة نفسها المتبعة في بصمة القوالب (templatePreview): لا ننقل محتوى الإصدارات
 * كاملًا إلى الواجهة بل «بصمة» خفيفة — أنواع الكتل بترتيبها مع مستخلص نصي قصير —
 * ثم نحسب الفرق بين بصمتين بخوارزمية LCS فتظهر الكتل المضافة/المحذوفة بوضوح
 * والاستعادة تصبح قرارًا مستنيرًا لا قفزة في الظلام.
 *
 * الدوال نقية بلا آثار جانبية وتعمل في البيئتين (خادم/عميل):
 * - versionFingerprint: من JSON الإصدار المحفوظ (مغلف v1 أو مصفوفة v0)
 * - fingerprintFromNodes: من شجرة المسودة الحية في المحرر مباشرة
 * - diffFingerprints: الفرق بين بصمتين (المرجع = المسودة، الهدف = الإصدار)
 */
import { isContainerType } from "./tree";
import type { ContentNode } from "./tree";

/** سقف مدخلات البصمة — يتسق مع حد شجرة المحتوى (MAX_TREE_NODES = 120) */
export const DIFF_MAX_ENTRIES = 80;

/** أقصى طول للمستخلص النصي للمدخل الواحد */
export const DIFF_LABEL_MAX = 120;

export interface DiffEntry {
  type: string;
  /** مستخلص نصي قصير من خصائص الكتلة (أول حقل معبر) — فارغ للحاويات والكتل الشكلية */
  label: string;
}

export interface VersionDiffResult {
  /** في الإصدار الهدف لا في المرجع — تعود بالاستعادة */
  added: DiffEntry[];
  /** في المرجع لا في الإصدار الهدف — تُزال بالاستعادة */
  removed: DiffEntry[];
  unchangedCount: number;
  identical: boolean;
}

// ─── استخراج المستخلص النصي ───

/** حقول العنوان بالأولوية — تغطي مخططات الكتل المعمولة */
const LABEL_KEYS = ["title", "heading", "text", "label", "q", "alt", "caption", "lead"] as const;

/** مصفوفات الفقرات: نأخذ أول عنصر نصي معبر */
const LABEL_ARRAY_KEYS = ["paragraphs", "intro", "support"] as const;

/** مفاتيح تستبعد من المسح العميق (روابط ومسارات ومعرفات وخصائص تنسيق لا محتوى) */
const SKIP_KEYS = new Set([
  "href", "src", "url", "id", "anchorId", "key", "service",
  "size", "align", "gap", "span", "level", "columns", "rounded", "width", "kind", "limit",
]);

function isNoiseString(value: string): boolean {
  if (!value.trim()) return true;
  return /^(https?:)?\/\//.test(value) || value.startsWith("/");
}

/** تقليم وتوحيد المسافات مع اقتطاع بسقف DIFF_LABEL_MAX */
function normalizeLabel(raw: string): string {
  const flat = raw.replace(/\s+/g, " ").trim();
  if (flat.length <= DIFF_LABEL_MAX) return flat;
  return `${flat.slice(0, DIFF_LABEL_MAX - 1)}…`;
}

function firstMeaningfulString(value: unknown): string | null {
  if (typeof value !== "string" || isNoiseString(value)) return null;
  return value;
}

/**
 * مسح عميق محدود (≤ مستويين من التداخل) لأول سلسلة نصية معبرة —
 * يغطي visionMission.vision.title وgallery images[].alt.
 * السلاسل النصية أوراق تُقرأ في أي عمق يصل إليها؛ حد العمق يحكم النزول في الحاويات فقط.
 */
function deepFirstString(value: unknown, depth: number): string | null {
  if (typeof value === "string") return isNoiseString(value) ? null : value;
  if (depth > 2) return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = deepFirstString(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (typeof value === "object" && value !== null) {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (SKIP_KEYS.has(key)) continue;
      const found = deepFirstString(child, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

/** مستخلص نصي لكتلة واحدة من خصائصها — أول حقل معبر بأولوية معروفة ثم مسح عميق حارس */
export function extractLabel(type: string, props: Record<string, unknown> | undefined): string {
  if (!props || isContainerType(type)) return "";

  for (const key of LABEL_KEYS) {
    const found = firstMeaningfulString(props[key]);
    if (found) return normalizeLabel(found);
  }

  for (const key of LABEL_ARRAY_KEYS) {
    const arr = props[key];
    if (!Array.isArray(arr)) continue;
    for (const item of arr) {
      const direct = firstMeaningfulString(item);
      if (direct) return normalizeLabel(direct);
      if (typeof item === "object" && item !== null) {
        const nested = deepFirstString(item, 0);
        if (nested) return normalizeLabel(nested);
      }
    }
  }

  const deep = deepFirstString(props, 0);
  return deep ? normalizeLabel(deep) : "";
}

// ─── بناء البصمة ───

function pushEntry(type: unknown, props: unknown, out: DiffEntry[]): boolean {
  if (out.length >= DIFF_MAX_ENTRIES) return false;
  if (typeof type !== "string" || !type) return true; // عقدة فاسدة: تُتخطى ولا توقف الجولة
  out.push({
    type,
    label: extractLabel(type, typeof props === "object" && props !== null ? (props as Record<string, unknown>) : undefined),
  });
  return true;
}

function walkRaw(nodes: unknown[], out: DiffEntry[]): void {
  for (const node of nodes) {
    if (out.length >= DIFF_MAX_ENTRIES) return;
    if (typeof node !== "object" || node === null) continue;
    const n = node as { type?: unknown; props?: unknown; children?: unknown };
    if (!pushEntry(n.type, n.props, out)) return;
    if (Array.isArray(n.children)) walkRaw(n.children, out);
  }
}

function walkNodes(nodes: ContentNode[], out: DiffEntry[]): void {
  for (const node of nodes) {
    if (out.length >= DIFF_MAX_ENTRIES) return;
    if (!pushEntry(node.type, node.props, out)) return;
    if (node.children?.length) walkNodes(node.children, out);
  }
}

/** بصمة إصدار محفوظ من JSON — يقبل مغلف v1 ({blocks}) ومصفوفة v0، ويفشل بهدوء إلى [] */
export function versionFingerprint(json: string | null): DiffEntry[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json) as unknown;
    let nodes: unknown[] | null = null;
    if (Array.isArray(parsed)) {
      nodes = parsed; // v0: مصفوفة مسطحة
    } else if (typeof parsed === "object" && parsed !== null && Array.isArray((parsed as { blocks?: unknown }).blocks)) {
      nodes = (parsed as { blocks: unknown[] }).blocks; // v1: مغلف
    }
    if (!nodes) return [];
    const out: DiffEntry[] = [];
    walkRaw(nodes, out);
    return out;
  } catch {
    return [];
  }
}

/** بصمة المسودة الحية من شجرة عقد المحرر مباشرة (بلا مرحلة JSON) */
export function fingerprintFromNodes(nodes: ContentNode[]): DiffEntry[] {
  const out: DiffEntry[] = [];
  walkNodes(nodes, out);
  return out;
}

// ─── حساب الفرق ───

function entryKey(entry: DiffEntry): string {
  return `${entry.type}\u0000${entry.label}`;
}

/**
 * فرق بين بصمتين بمطابقة تعددية على مفتاح المحتوى (النوع + المستخلص).
 * المرجع هو الحالة القائمة (المسودة) والهدف هو الحالة المرشحة (الإصدار).
 * المقارنة على المحتوى لا المواضع: إعادة الترتيب وحدها لا تُعد تغييرًا —
 * الكتلة المنقولة تبقى «دون تغيير»، والتكرارات تُطابقة واحدًا بواحد
 * (نصان متطابقا الحالة يعدّان مدخلًا مشتركًا واحدًا لكل تكرار متقابل).
 */
export function diffFingerprints(reference: DiffEntry[], target: DiffEntry[]): VersionDiffResult {
  // عدد مرات كل مفتاح في كل طرف
  const refCounts = countByKey(reference);
  const tgtCounts = countByKey(target);

  // المتقابل لكل مفتاح = أصغر التكرارين — لكل طرف حصته المستقلة لأن كل مسار
  // يميّز مدخلاته المتطابقة بنفسه؛ إجمالي المشترك يُحتسب مرة واحدة كأزواج متقابلة
  const commonRef = new Map<string, number>();
  const commonTgt = new Map<string, number>();
  let unchangedCount = 0;
  for (const [key, refCount] of refCounts) {
    const common = Math.min(refCount, tgtCounts.get(key) ?? 0);
    if (common > 0) {
      commonRef.set(key, common);
      commonTgt.set(key, common);
      unchangedCount += common;
    }
  }

  const removed = reference.filter((entry) => !consumeMatched(commonRef, entryKey(entry)));
  const added = target.filter((entry) => !consumeMatched(commonTgt, entryKey(entry)));

  return {
    added,
    removed,
    unchangedCount,
    identical: added.length === 0 && removed.length === 0,
  };
}

function countByKey(entries: DiffEntry[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    const key = entryKey(entry);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/** يستهلك وحدة مطابقة واحدة للمفتاح إن توفرت — يميّز المتطابق من الزائد بترتيب الورود */
function consumeMatched(remaining: Map<string, number>, key: string): boolean {
  const left = remaining.get(key) ?? 0;
  if (left <= 0) return false;
  remaining.set(key, left - 1);
  return true;
}
