/**
 * بوابة التحقق والتطبيع للشجرة — تُنفذ في الخادم قبل أي حفظ أو نشر، وفي
 * المحرر قبل الإرسال. المدخل JSON نصي (مصفوفة v0 أو مغلف v1) والمخرج دائمًا
 * مغلف v1 مطبّع: القيم الافتراضية مفعلة، المفاتيح غير المعروفة مُسقطة،
 * والأخطاء صريحة (لا تحويل صامت إلى صفحات فارغة).
 *
 * الفحوص: حجم JSON، عدد العقد، العمق، الأنواع المسجلة (فحص ملكية مباشر
 * Object.hasOwn)، مخطط كل عقدة، قواعد قبول الأبناء، منع تكرار المعرفات
 * والمراسات، ومنع الأبناء داخل الكتل الورقية (منع الدورات بنيويًا).
 */
import { z } from "zod";
import {
  BLOCK_REGISTRY,
  MAX_CONTENT_BYTES,
  MAX_TREE_DEPTH,
  MAX_TREE_NODES,
  isContainerType,
  type ContentEnvelope,
  type ContentNode,
} from "./tree";
import { nodeStyleSchema } from "./style";
import { migrateContent } from "./migrate";

export interface ValidateContentOk {
  ok: true;
  envelope: ContentEnvelope;
  /** JSON جاهز للحفظ (مطبّع) */
  json: string;
  /** أبناء الجذر — شكل المحرر */
  tree: ContentNode[];
  /** هل خضع المدخل لترحيل من v0؟ */
  migrated: boolean;
}

export type ValidateContentResult = ValidateContentOk | { ok: false; error: string };

function looksLikeEnvelopeText(text: string): boolean {
  return text.trimStart().startsWith("{");
}

/** تطبيع عقدة واحدة مع أبنائها — يتحقق من المخطط والقواعد والحدود */
function normalizeNode(
  raw: unknown,
  depth: number,
  ctx: {
    seenIds: Set<string>;
    seenAnchors: Set<string>;
    count: { value: number };
  }
): { ok: true; node: ContentNode } | { ok: false; error: string } {
  if (depth > MAX_TREE_DEPTH) return { ok: false, error: "tree_too_deep" };
  ctx.count.value += 1;
  if (ctx.count.value > MAX_TREE_NODES) return { ok: false, error: "too_many_nodes" };

  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, error: "block_invalid" };
  }
  const rec = raw as Record<string, unknown>;
  const type = rec.type;
  // فحص ملكية مباشر — يمنع تجاوز الفحص بمفاتيح سلسلة النموذج (constructor/proto)
  if (typeof type !== "string" || !Object.hasOwn(BLOCK_REGISTRY, type)) {
    return { ok: false, error: `block_type_unknown:${String(type)}` };
  }
  const def = BLOCK_REGISTRY[type as keyof typeof BLOCK_REGISTRY];

  const schema = def.schema as z.ZodTypeAny;
  const result = schema.safeParse(rec);
  if (!result.success) {
    const issue = result.error.issues[0];
    return { ok: false, error: `block_schema:${type}:${issue?.path.join(".") ?? "?"}` };
  }
  const data = result.data as Record<string, unknown>;

  // المعرف والمرساة — فحص التكرار
  const id = typeof data.id === "string" ? data.id : undefined;
  if (!id) return { ok: false, error: `block_invalid:${type}` };
  if (ctx.seenIds.has(id)) return { ok: false, error: "block_duplicate_id" };
  ctx.seenIds.add(id);

  const anchorId = typeof data.anchorId === "string" && data.anchorId ? data.anchorId : undefined;
  if (anchorId) {
    if (ctx.seenAnchors.has(anchorId)) return { ok: false, error: `anchor_duplicate:${anchorId}` };
    ctx.seenAnchors.add(anchorId);
  }

  const node: ContentNode = { id, type: type as ContentNode["type"] };
  if (anchorId) node.anchorId = anchorId;

  // النمط — الشكل الجديد (قاعدة + تجاوزات أجهزة) أولًا، ثم تحويل الشكل القديم
  // {background, paddingY} إلى base حتى لا يُفقد أبدًا
  if (rec.style !== undefined && rec.style !== null && typeof rec.style === "object") {
    const styleCheck = nodeStyleSchema.safeParse(rec.style);
    if (styleCheck.success) {
      node.style = styleCheck.data;
    } else {
      const legacy = data.style as { background?: string; paddingY?: string } | undefined;
      if (legacy) {
        node.style = {
          base: { background: legacy.background as never, paddingY: legacy.paddingY as never },
        };
      }
    }
  }
  if (data.visibility !== undefined) {
    node.visibility = data.visibility as ContentNode["visibility"];
  }

  if (isContainerType(type)) {
    const childrenRaw = Array.isArray(data.children) ? data.children : [];
    const rule = def.children;
    if (rule && childrenRaw.length > rule.max) {
      return { ok: false, error: `children_too_many:${type}` };
    }
    const children: ContentNode[] = [];
    for (const childRaw of childrenRaw) {
      // قاعدة قبول الأبناء — تُفحص قبل التطبيع (النوع معروف من البيانات الخام)
      if (
        rule &&
        typeof childRaw === "object" &&
        childRaw !== null &&
        typeof (childRaw as { type?: unknown }).type === "string" &&
        !rule.allowed.includes((childRaw as { type: string }).type as never)
      ) {
        return { ok: false, error: `child_not_allowed:${type}:${String((childRaw as { type: unknown }).type)}` };
      }
      const child = normalizeNode(childRaw, depth + 1, ctx);
      if (!child.ok) return child;
      children.push(child.node);
    }
    node.children = children;
    if (data.props !== undefined && typeof data.props === "object" && !Array.isArray(data.props)) {
      node.props = data.props as Record<string, unknown>;
    }
  } else {
    if (rec.children !== undefined) {
      return { ok: false, error: `leaf_has_children:${type}` };
    }
    node.props = data.props as Record<string, unknown> | undefined;
  }

  return { ok: true, node };
}

/**
 * التحقق الكامل: نص JSON → ترحيل → تطبيع شجري → مغلف v1 جاهز للحفظ.
 * يُعاد JSON المطبّع (لا الأصلي) — الحفظ يخزن ناتج التحقق دائمًا.
 */
export function validateContent(input: unknown): ValidateContentResult {
  if (typeof input !== "string") return { ok: false, error: "blocks_not_json" };
  if (Buffer.byteLength(input, "utf8") > MAX_CONTENT_BYTES) {
    return { ok: false, error: "content_too_large" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    return { ok: false, error: "blocks_invalid_json" };
  }

  const migrated = !looksLikeEnvelopeText(input);
  const mig = migrateContent(parsed);
  if (!mig.ok) return mig;

  const ctx = {
    seenIds: new Set<string>(),
    seenAnchors: new Set<string>(),
    count: { value: 0 },
  };
  const normalized: ContentNode[] = [];
  for (const node of mig.envelope.blocks) {
    const result = normalizeNode(node, 1, ctx);
    if (!result.ok) return result;
    normalized.push(result.node);
  }

  const envelope: ContentEnvelope = { schemaVersion: 1, blocks: normalized };
  return {
    ok: true,
    envelope,
    json: JSON.stringify(envelope),
    tree: normalized,
    migrated,
  };
}

/**
 * تحميل محتوى للعرض (صفحات عامة/معاينة): يمر عبر البوابة نفسها.
 * عند الفشل يعيد خطأ صريحًا — الاستدعاء يعرض رسالة بدل صفحة فارغة.
 */
export function loadContentForRender(
  json: string | null | undefined
): { ok: true; tree: ContentNode[]; migrated: boolean } | { ok: false; error: string } {
  if (!json) return { ok: true, tree: [], migrated: false };
  const result = validateContent(json);
  if (!result.ok) return result;
  return { ok: true, tree: result.tree, migrated: result.migrated };
}
