/**
 * البحث في صفحات الموقع المنشورة — دوال نقية قابلة للاختبار بلا I/O.
 *
 * التصميم:
 * - استخراج النصوص من شجرة الكتل دفاعيًا (نفس فلسفة قراءة الحافظة/الإعدادات):
 *   نسرّب على props بشكل عام ونجمع النصوص، مستثنيين مفاتيح غير لفظية
 *   (روابط، مفاتيح تعداد، أيقونات) والسلاسل الشبيهة بالروابط.
 * - تطبيع عربي خفيف يحسّن الاستدعاء كثيرًا: إزالة التشكيل، توحيد الألف،
 *   التاء المربوطة، والألف المقصورة — ويطبق على المتن والاستعلام معًا.
 * - المطابقة تعيد مواضع **النص الأصلي** عبر خريطة فهارس، فتبقى القصاصة
 *   بالرسم الأصلي (بالتشكيل) والتمييز دقيقًا.
 * - الترتيب بأوزان: العنوان ×6، الوصف ×2، المتن ×1 — والأعلى أولًا،
 *   والتعادل يحفظ ترتيب الإدخال.
 */
import type { ContentNode } from "@/lib/blocks/tree";

/** مفاتيح props غير لفظية — قيمها معرفات/روابط/مفاتيح تعداد لا تصلح نصًا يُبحث فيه */
const NON_TEXTUAL_KEYS = new Set([
  "href",
  "url",
  "src",
  "key",
  "kind",
  "service",
  "variant",
  "icon",
  "type",
  "id",
  "align",
  "columns",
  "limit",
  "anchorId",
  "locale",
  "currency",
  "budget",
  "timeline",
  "status",
]);

/** شكل نتيجة قصاصة: ما قبل المطابقة، المطابقة، ما بعدها — للتمييز في الواجهة */
export interface Snippet {
  before: string;
  hit: string;
  after: string;
  /** قُصّت بداية النص (تُعرض بنقاط بادئة) */
  startTrimmed: boolean;
  /** قُصّت نهاية النص */
  endTrimmed: boolean;
}

/** صفحة مرشحة للبحث — مدخلات منسوخة من قاعدة البيانات (بلا كائنات حية) */
export interface SearchablePage {
  slug: string;
  title: string;
  description: string;
  blocksJson: string | null;
}

/** نتيجة بحث جاهزة للعرض */
export interface SearchHit {
  slug: string;
  title: string;
  /** قصاصة من المتن عند مطابقته — وإلا يُعرض الوصف (fallback) */
  snippet: Snippet | null;
  fallback: string;
  score: number;
}

// ─── التطبيع ───

/** تشكيل عربي + محارف تحكم اتجاه وتطويل تُهمل عند المطابقة */
const DIACRITICS = /[\u064B-\u0652\u0670\u0640\u200E\u200F\u202A-\u202E]/;

/** اختبار حرف (بكود point كامل) هل هو من المحارف المهملة */
function isIgnored(ch: string): boolean {
  return DIACRITICS.test(ch);
}

/**
 * تطبيع حرف عربي واحد إلى شكله الموحد — يعيد الحرف نفسه إن لم ينطبق تحويل.
 * (أ إ آ ٱ → ا | ة → ه | ى → ي)
 */
function normalizeChar(ch: string): string {
  if (ch === "أ" || ch === "إ" || ch === "آ" || ch === "ٱ") return "ا";
  if (ch === "ة") return "ه";
  if (ch === "ى") return "ي";
  return ch;
}

export interface NormalizedText {
  /** النص بعد التطبيع والت lowercase */
  norm: string;
  /** map[i] = موقع norm[i] في النص الأصلي (المحذوف كالتشكيل لا يظهر) */
  map: number[];
}

/** يبني نسخة مطبعة من النص مع خريطة تعيد كل حرف مطبّع إلى موقعه **الأصلي** —
 *  تُبنى من النص الأصلي مباشرة كي لا يزيح حذف التشكيل الفهارس */
export function normalizeWithMap(text: string): NormalizedText {
  const normChars: string[] = [];
  const map: number[] = [];
  let cursor = 0;
  for (const ch of text) {
    if (!isIgnored(ch)) {
      normChars.push(normalizeChar(ch).toLowerCase());
      map.push(cursor);
    }
    cursor += ch.length;
  }
  return { norm: normChars.join(""), map };
}

/** تطبيع سريع بلا خريطة — للعدّ والمقارنات الخفيفة */
export function normalizeText(text: string): string {
  let out = "";
  for (const ch of text) {
    if (!isIgnored(ch)) out += normalizeChar(ch).toLowerCase();
  }
  return out;
}

// ─── الاستعلام ───

/** الحد الأقصى للحدود المستخرجة من الاستعلام (يمنع الاستعلامات المفتعلة الطويلة) */
const MAX_TOKENS = 8;
const MIN_TOKEN_LENGTH = 2;

/** تقطيع الاستعلام إلى حدود مطبعة فريدة — الفراغات حدودًا، وطول أدنى 2 يرفع الدقة */
export function tokenizeQuery(query: string): string[] {
  const seen = new Set<string>();
  const tokens: string[] = [];
  for (const raw of query.split(/\s+/)) {
    if (raw.length < MIN_TOKEN_LENGTH) continue;
    const token = normalizeText(raw);
    if (!token || seen.has(token)) continue;
    seen.add(token);
    tokens.push(token);
    if (tokens.length >= MAX_TOKENS) break;
  }
  return tokens;
}

// ─── استخراج نص المتن ───

/** هل السلسلة شبيهة برابط/مسار — تُستبعد من النص المُفهرس */
function looksLikeUrl(value: string): boolean {
  return /^(https?:\/\/|\/|mailto:|tel:|#)/i.test(value) || value.includes("://");
}

/** جمع السلاسل اللفظية من قيمة props بشكل تعاودي دفاعي (حدود عمق وعدد ضد الحلقات والتضخم) */
function collectStrings(value: unknown, depth: number, out: string[]): void {
  if (out.length >= 400 || depth > 8) return;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed && !looksLikeUrl(trimmed)) out.push(trimmed);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, depth + 1, out);
    return;
  }
  if (value !== null && typeof value === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (NON_TEXTUAL_KEYS.has(key)) continue;
      collectStrings(child, depth + 1, out);
    }
  }
}

/** استخراج نص قابل للفهرسة من عقد شجرة الكتل (تعاودي عبر children) */
export function extractSearchText(nodes: ContentNode[]): string {
  const strings: string[] = [];
  const walk = (node: ContentNode, depth: number) => {
    if (depth > 12) return;
    if (node.props) collectStrings(node.props, 0, strings);
    if (Array.isArray(node.children)) for (const child of node.children) walk(child, depth + 1);
  };
  for (const node of nodes) walk(node, 0);
  return strings.join(" \n ");
}

// ─── المطابقة والقصاصات ───

const SNIPPET_RADIUS = 90;

/** أول مطابقة لأي حد — الأبكر يفوز، وعند التساوي الأطول (تغطية أوضح للتمييز) */
function firstMatch(norm: string, tokens: string[]): { index: number; length: number } | null {
  let best: { index: number; length: number } | null = null;
  for (const token of tokens) {
    const index = norm.indexOf(token);
    if (index === -1) continue;
    if (!best || index < best.index || (index === best.index && token.length > best.length)) {
      best = { index, length: token.length };
    }
  }
  return best;
}

/**
 * بناء قصاصة بتمييز أول مطابقة لأي حد — بالرسم الأصلي (بالتشكيل).
 * النافذة تُفضّل حدود الكلمات عند القص، وتعيد null إن لم يطابق أي حد.
 */
export function buildSnippet(text: string, tokens: string[]): Snippet | null {
  if (tokens.length === 0) return null;
  const { norm, map } = normalizeWithMap(text);
  const match = firstMatch(norm, tokens);
  if (!match) return null;

  // مواضع النص الأصلي عبر الخريطة — النهاية بعد آخر حرف مطابق
  const origStart = map[match.index];
  const origEnd = (map[match.index + match.length - 1] ?? text.length - 1) + 1;

  // نافذة القصاصة حول المطابقة مع تفضيل حدود الكلمات عند القص
  let winStart = Math.max(0, origStart - SNIPPET_RADIUS);
  let winEnd = Math.min(text.length, origEnd + SNIPPET_RADIUS);
  const startTrimmed = winStart > 0;
  const endTrimmed = winEnd < text.length;
  if (startTrimmed) {
    const space = text.indexOf(" ", winStart);
    if (space !== -1 && space < origStart) winStart = space + 1;
  }
  if (endTrimmed) {
    const space = text.lastIndexOf(" ", winEnd);
    if (space !== -1 && space > origEnd) winEnd = space;
  }

  return {
    before: text.slice(winStart, origStart),
    hit: text.slice(origStart, origEnd),
    after: text.slice(origEnd, winEnd),
    startTrimmed,
    endTrimmed,
  };
}

// ─── التقييم والترتيب ───

const WEIGHT_TITLE = 6;
const WEIGHT_DESC = 2;
const WEIGHT_BODY = 1;
const MAX_HITS = 20;

/** عدد الحدود المطابقة في نص (للأوزان) */
function countTokenHits(text: string, tokens: string[]): number {
  if (!text || tokens.length === 0) return 0;
  const norm = normalizeText(text);
  let hits = 0;
  for (const token of tokens) if (norm.includes(token)) hits++;
  return hits;
}

/**
 * البحث في صفحات مُجهزة مسبقًا — نقية بالكامل (الجلب في الأعلى).
 * - يجب أن يطابق حد واحد على الأقل (عنوان أو وصف أو متن) وإلا تُستبعد الصفحة.
 * - JSON فاسد لا يُسقط الصفحة — يكفي تطابق العنوان/الوصف (قراءة دفاعية).
 */
export function searchPages(pages: SearchablePage[], query: string): SearchHit[] {
  const tokens = tokenizeQuery(query);
  if (tokens.length === 0) return [];

  const hits: { hit: SearchHit; index: number }[] = [];
  pages.forEach((page, index) => {
    const titleHits = countTokenHits(page.title, tokens);
    const descHits = countTokenHits(page.description, tokens);

    let snippet: Snippet | null = null;
    let bodyHits = 0;
    if (page.blocksJson) {
      try {
        const parsed = JSON.parse(page.blocksJson) as unknown;
        const nodes = Array.isArray(parsed)
          ? (parsed as ContentNode[])
          : Array.isArray((parsed as { blocks?: unknown }).blocks)
            ? ((parsed as { blocks: ContentNode[] }).blocks)
            : [];
        const bodyText = extractSearchText(nodes);
        snippet = buildSnippet(bodyText, tokens);
        if (snippet) bodyHits = countTokenHits(bodyText, tokens);
      } catch {
        // JSON فاسد — نكتفي بالعنوان والوصف (نفس فلسفة القراءة الدفاعية)
      }
    }

    const score = titleHits * WEIGHT_TITLE + descHits * WEIGHT_DESC + bodyHits * WEIGHT_BODY;
    if (score === 0) return;

    hits.push({
      hit: { slug: page.slug, title: page.title, snippet, fallback: page.description.slice(0, 180), score },
      index,
    });
  });

  // الأعلى وزنًا أولًا، والتعادل يحفظ ترتيب الإدخال — ثم سقف النتائج
  return hits
    .sort((a, b) => b.hit.score - a.hit.score || a.index - b.index)
    .slice(0, MAX_HITS)
    .map((entry) => entry.hit);
}
