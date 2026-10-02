/**
 * ترحيل المحتوى الآمن — من المصفوفة المسطحة (v0) إلى شجرة المحتوى (v1).
 *
 * الضمانات:
 * - لا تُحوَّل البيانات غير المعروفة إلى صفحات فارغة بصمت: أي نوع غير مسجل
 *   يفشل الترحيل بخطأ صريح يذكر النوع.
 * - شكل الصفحات الحالية محفوظ: كتل v0 تبقى عقدًا ورقية في الجذر كما هي
 *   (بلا إعادة تغليف تخفي عن المحرر بنيتها)، وكتلة columns القديمة ذات
 *   النصوص الثابتة تتحول إلى صف/أعمدة حقيقية بنفس النصوص دون فقدان.
 * - الترحيل(idempotent): المدخل v1 يعود كما هو (بعد فحص بنيوي خفيف).
 * - معرفات جديدة مشتقة من المعرف الأصلي فتبقى مستقرة ومفهومة.
 */
import {
  CONTENT_SCHEMA_VERSION,
  isContainerType,
  type ContentEnvelope,
  type ContentNode,
} from "./tree";
import { blockSchemas, type BlockType } from "./types";

type MigrateResult =
  | { ok: true; envelope: ContentEnvelope }
  | { ok: false; error: string };

/** هل يبدو المدخل مغلف v1؟ */
function isEnvelope(parsed: unknown): parsed is ContentEnvelope {
  return (
    typeof parsed === "object" &&
    parsed !== null &&
    !Array.isArray(parsed) &&
    typeof (parsed as ContentEnvelope).schemaVersion === "number" &&
    Array.isArray((parsed as ContentEnvelope).blocks)
  );
}

function uniqueId(base: string, taken: Set<string>): string {
  let candidate = base.slice(0, 60);
  let i = 2;
  while (taken.has(candidate)) {
    candidate = `${base.slice(0, 56)}-${i++}`;
  }
  taken.add(candidate);
  return candidate;
}

/**
 * ترحيل كتلة columns القديمة (نصوص ثابتة في props) إلى بنية حقيقية:
 * row يحوي أعمدة، وكل عمود يضم كتلة heading اختيارية وكتلة text بنفس النصوص.
 */
function migrateLegacyColumns(
  raw: Record<string, unknown>,
  taken: Set<string>
): ContentNode {
  const baseId = typeof raw.id === "string" && raw.id ? raw.id : "b-columns";
  const rowId = uniqueId(`${baseId}-row`, taken);
  const rawItems = Array.isArray((raw as { props?: { columns?: unknown } }).props?.columns)
    ? ((raw as { props: { columns: unknown[] } }).props.columns as unknown[])
    : [];

  const columns: ContentNode[] = rawItems.slice(0, 6).map((item, index) => {
    const colId = uniqueId(`${baseId}-c${index + 1}`, taken);
    const children: ContentNode[] = [];
    const rec = (typeof item === "object" && item !== null ? item : {}) as {
      heading?: unknown;
      paragraphs?: unknown;
    };
    if (typeof rec.heading === "string" && rec.heading.length > 0) {
      children.push({
        id: uniqueId(`${colId}-h`, taken),
        type: "heading",
        props: { text: rec.heading, level: 3, align: "start" },
      });
    }
    const paragraphs = Array.isArray(rec.paragraphs)
      ? (rec.paragraphs as unknown[]).filter((p): p is string => typeof p === "string")
      : [];
    children.push({
      id: uniqueId(`${colId}-t`, taken),
      type: "text",
      props: { paragraphs: paragraphs.length ? paragraphs : [""] },
    });
    return { id: colId, type: "column", props: { gap: "md", span: "auto", align: "start" }, children };
  });

  const style = typeof (raw as { style?: unknown }).style === "object" && raw.style !== null
    ? (raw as { style: ContentNode["style"] }).style
    : undefined;

  return {
    id: rowId,
    type: "row",
    props: { gap: "md" },
    children: columns.length ? columns : [emptyColumn(uniqueId(`${rowId}-c1`, taken), taken)],
    style,
  };
}

function emptyColumn(id: string, taken: Set<string>): ContentNode {
  return {
    id,
    type: "column",
    props: { gap: "md", span: "auto", align: "start" },
    children: [{ id: uniqueId(`${id}-t`, taken), type: "text", props: { paragraphs: [""] } }],
  };
}

/** فحص بنيوي خفيف لعقد v1 — النوع مسجل، الحاويات فقط تملك children */
function sanitizeV1Nodes(nodes: unknown[], taken: Set<string>): MigrateResult {
  const out: ContentNode[] = [];
  for (const raw of nodes) {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
      return { ok: false, error: "block_invalid" };
    }
    const rec = raw as Record<string, unknown>;
    const type = rec.type;
    if (typeof type !== "string" || !(Object.hasOwn(blockSchemas, type) || isContainerType(type))) {
      return { ok: false, error: `block_type_unknown:${String(type)}` };
    }
    const node: ContentNode = {
      id: typeof rec.id === "string" && rec.id ? rec.id : uniqueId("b-node", taken),
      type: type as BlockType,
    };
    if (typeof rec.id === "string" && rec.id) {
      if (taken.has(rec.id)) return { ok: false, error: "block_duplicate_id" };
      taken.add(rec.id);
    }
    if (typeof rec.props === "object" && rec.props !== null && !Array.isArray(rec.props)) {
      node.props = rec.props as Record<string, unknown>;
    }
    if (isContainerType(type)) {
      const children = Array.isArray(rec.children) ? rec.children : [];
      const sub = sanitizeV1Nodes(children, taken);
      if (!sub.ok) return sub;
      node.children = sub.envelope.blocks;
    } else if (rec.children !== undefined) {
      // كتلة ورقية تحمل children — بيانات غير متوقعة: نرفض صراحة بدل إسقاطها
      return { ok: false, error: `leaf_has_children:${type}` };
    }
    if (typeof rec.style === "object" && rec.style !== null && !Array.isArray(rec.style)) {
      node.style = rec.style as ContentNode["style"];
    }
    if (typeof rec.visibility === "object" && rec.visibility !== null && !Array.isArray(rec.visibility)) {
      node.visibility = rec.visibility as ContentNode["visibility"];
    }
    if (typeof rec.anchorId === "string") node.anchorId = rec.anchorId;
    out.push(node);
  }
  return { ok: true, envelope: { schemaVersion: CONTENT_SCHEMA_VERSION, blocks: out } };
}

/**
 * ترحيل المحتوى المُحلل (parsed JSON) إلى مغلف v1.
 * يقبل: مصفوفة v0 مسطحة، أو مغلف v1.
 */
export function migrateContent(parsed: unknown): MigrateResult {
  if (isEnvelope(parsed)) {
    if (parsed.schemaVersion > CONTENT_SCHEMA_VERSION) {
      return { ok: false, error: `schema_version_too_new:${parsed.schemaVersion}` };
    }
    return sanitizeV1Nodes(parsed.blocks, new Set());
  }

  if (Array.isArray(parsed)) {
    // v0 — مصفوفة كتل مسطحة
    const taken = new Set<string>();
    const nodes: ContentNode[] = [];
    for (const raw of parsed) {
      if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
        return { ok: false, error: "block_invalid" };
      }
      const rec = raw as Record<string, unknown>;
      const type = rec.type;
      if (typeof type !== "string") return { ok: false, error: "block_invalid" };
      if (type === "columns") {
        // القديمة تتحول لبنية حقيقية بنفس النصوص
        nodes.push(migrateLegacyColumns(rec, taken));
        continue;
      }
      if (!Object.hasOwn(blockSchemas, type)) {
        return { ok: false, error: `block_type_unknown:${type}` };
      }
      const id = typeof rec.id === "string" && rec.id ? String(rec.id) : uniqueId("b-node", taken);
      if (taken.has(id)) return { ok: false, error: "block_duplicate_id" };
      taken.add(id);
      const node: ContentNode = {
        id,
        type: type as BlockType,
        props:
          typeof rec.props === "object" && rec.props !== null && !Array.isArray(rec.props)
            ? (rec.props as Record<string, unknown>)
            : {},
      };
      if (typeof rec.style === "object" && rec.style !== null && !Array.isArray(rec.style)) {
        node.style = rec.style as ContentNode["style"];
      }
      if (typeof rec.visibility === "object" && rec.visibility !== null && !Array.isArray(rec.visibility)) {
        node.visibility = rec.visibility as ContentNode["visibility"];
      }
      if (typeof rec.anchorId === "string") node.anchorId = rec.anchorId;
      nodes.push(node);
    }
    return { ok: true, envelope: { schemaVersion: CONTENT_SCHEMA_VERSION, blocks: nodes } };
  }

  return { ok: false, error: "blocks_not_array" };
}
