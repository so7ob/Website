/**
 * شجرة المحتوى v1 — النموذج البنيوي لصفحات الموقع.
 *
 * تتكون الصفحة من مغلف ContentEnvelope:
 *   { schemaVersion: 1, blocks: ContentNode[] }
 * وكل ContentNode إما:
 * - عقدة حاوية (section | container | row | column) لها children، أو
 * - كتلة ورقية (hero, text, heading, …) بلا children.
 *
 * تعريف كل كتلة موحّد في BLOCK_REGISTRY: المخطط، هل هي حاوية، قواعد قبول
 * الأبناء (الأنواع المسموحة + الحد الأقصى)، التسمية ثنائية اللغة، والمجموعة.
 *
 * الحدود (تُفحص في validateContent قبل الحفظ):
 * - عمق الشجرة ≤ MAX_TREE_DEPTH
 * - عدد العقد ≤ MAX_TREE_NODES
 * - حجم JSON ≤ MAX_CONTENT_BYTES
 * - لا معرفات مكررة، لا مراسات (anchorId) مكررة، لا أبناء داخل كتل ورقية.
 */
import { z } from "zod";
import { blockSchemas, type BlockType } from "./types";

// ─── الإصدار والحدود ───

export const CONTENT_SCHEMA_VERSION = 1;
export const MAX_TREE_DEPTH = 6;
export const MAX_TREE_NODES = 120;
export const MAX_CONTENT_BYTES = 300_000;

// ─── أنواع الحاويات ───

export const CONTAINER_TYPES = ["section", "container", "row", "column"] as const;
export type ContainerType = (typeof CONTAINER_TYPES)[number];

export function isContainerType(type: string): type is ContainerType {
  return (CONTAINER_TYPES as readonly string[]).includes(type);
}

// ─── عقدة الشجرة ───

export interface ContentNode {
  id: string;
  type: BlockType;
  props?: Record<string, unknown>;
  /** أبناء العقدة — للحاويات فقط */
  children?: ContentNode[];
  style?: import("./style").NodeStyle;
  visibility?: { mobile?: boolean; tablet?: boolean; desktop?: boolean };
  anchorId?: string;
}

export interface ContentEnvelope {
  schemaVersion: number;
  blocks: ContentNode[];
}

// ─── مخططات الحاويات ───

const containerBase = {
  id: z.string().min(1).max(60),
  style: z.any().optional(),
  visibility: z.any().optional(),
  anchorId: z.string().regex(/^[a-zA-Z][\w-]{0,60}$/, "invalid_anchor").optional(),
};

/** القسم: غلاف علوي بخلفية وحشوة — يفتح بعرض الموقع الداخلي */
export const sectionSchema = z.object({
  ...containerBase,
  type: z.literal("section"),
  children: z.array(z.any()).max(24).default([]),
});

/** الحاوية: صندوق عام قابل للتنسيق (خلفية/حدود/ظل/زوايا) داخل الأقسام والأعمدة */
export const containerSchema = z.object({
  ...containerBase,
  type: z.literal("container"),
  children: z.array(z.any()).max(24).default([]),
});

/** الصف: شبكة أعمدة — الأبناء أعمدة فقط، والعرض على الحاسوب بعدد الأبناء */
export const rowSchema = z.object({
  ...containerBase,
  type: z.literal("row"),
  props: z
    .object({
      gap: z.enum(["xs", "sm", "md", "lg"]).default("md"),
      /** توزيع الأعمدة على الحاسوب: عدد فئوي (يتجاوز عدد الأبناء عند الحاجة) */
      columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).optional(),
    })
    .default({ gap: "md" }),
  children: z.array(z.any()).max(6).default([]),
});

/** العمود: كومة رأسية من الكتل — يقبل كتلًا ورقية وحاويات */
export const columnSchema = z.object({
  ...containerBase,
  type: z.literal("column"),
  props: z
    .object({
      gap: z.enum(["xs", "sm", "md", "lg"]).default("md"),
      /** امتداد العمود داخل الصف على الحاسوب */
      span: z.enum(["auto", "1", "2", "3", "4"]).default("auto"),
      align: z.enum(["start", "center"]).default("start"),
    })
    .default({ gap: "md", span: "auto", align: "start" }),
  children: z.array(z.any()).max(12).default([]),
});

// ─── قواعد قبول الأبناء ───

/** الأنواع الورقية المسموح إدراجها داخل الحاويات (كل الكتل عدا الأنواع الكبرى للرئيسية؟ لا — الكل مسموح) */
const LEAF_IN_CONTAINER: readonly BlockType[] = [
  "heading",
  "text",
  "image",
  "gallery",
  "buttonLink",
  "simpleTable",
  "divider",
  "spacer",
  "richText",
  "contactInfo",
  "requestForm",
  "navCtaBanner",
];

export interface ChildrenRule {
  allowed: readonly BlockType[];
  max: number;
}

/**
 * سجل التعريف الموحّد لكل نوع (ورقي وحاوية):
 * المخطط + هل هو حاوية + قاعدة الأبناء + التسمية والمجموعة.
 * الحقول التحريرية (FieldDef) والأيقونات جانب المحرر (prop-fields / block-library)،
 * والقيم الافتراضية عبر defaultNode أدناه — مصدر واحد للحقيقة عند الإدراج.
 */
export interface BlockDef {
  schema: z.ZodTypeAny;
  isContainer: boolean;
  children?: ChildrenRule;
  group: "home" | "pages" | "generic" | "layout" | "structure";
  ar: string;
  en: string;
}

const LEAF_GROUPS: Record<string, BlockDef["group"]> = {
  hero: "home",
  servicesGrid: "home",
  featureGrid: "home",
  worksShowcase: "home",
  processSteps: "home",
  faqSection: "home",
  ctaSection: "home",
  pageHeader: "pages",
  richText: "pages",
  visionMission: "pages",
  numberedValues: "pages",
  numberedList: "pages",
  navCtaBanner: "pages",
  servicesDetail: "pages",
  worksFull: "pages",
  processFull: "pages",
  requestForm: "pages",
  contactInfo: "pages",
  heading: "generic",
  text: "generic",
  image: "generic",
  gallery: "generic",
  buttonLink: "generic",
  columns: "generic", // قديمة — تُرحّل إلى row/column ولا تُعرض في المكتبة
  simpleTable: "generic",
  divider: "layout",
  spacer: "layout",
};

const LEAF_LABELS: Record<string, { ar: string; en: string }> = {
  hero: { ar: "واجهة افتتاحية", en: "Hero" },
  servicesGrid: { ar: "بطاقات الخدمات", en: "Services grid" },
  featureGrid: { ar: "شبكة مميزات", en: "Feature grid" },
  worksShowcase: { ar: "معرض أعمال", en: "Works showcase" },
  processSteps: { ar: "خطوات سريعة", en: "Process steps" },
  faqSection: { ar: "أسئلة شائعة", en: "FAQ section" },
  ctaSection: { ar: "دعوة ختامية", en: "Final CTA" },
  pageHeader: { ar: "ترويسة صفحة", en: "Page header" },
  richText: { ar: "نص غني", en: "Rich text" },
  visionMission: { ar: "رؤية ورسالة", en: "Vision & mission" },
  numberedValues: { ar: "قيم مرقمة", en: "Numbered values" },
  numberedList: { ar: "قائمة مبادئ", en: "Numbered list" },
  navCtaBanner: { ar: "شريط روابط", en: "Nav CTA banner" },
  servicesDetail: { ar: "خدمات مفصلة", en: "Services detail" },
  worksFull: { ar: "أعمال موسعة", en: "Works full" },
  processFull: { ar: "مراحل العمل", en: "Process full" },
  requestForm: { ar: "نموذج طلب مشروع", en: "Project request form" },
  contactInfo: { ar: "بيانات تواصل", en: "Contact info" },
  heading: { ar: "عنوان", en: "Heading" },
  text: { ar: "نص", en: "Text" },
  image: { ar: "صورة", en: "Image" },
  gallery: { ar: "معرض صور", en: "Gallery" },
  buttonLink: { ar: "زر/رابط", en: "Button/Link" },
  columns: { ar: "أعمدة (قديمة)", en: "Columns (legacy)" },
  simpleTable: { ar: "جدول بسيط", en: "Simple table" },
  divider: { ar: "فاصل", en: "Divider" },
  spacer: { ar: "مسافة", en: "Spacer" },
};

function leafDef(type: BlockType): BlockDef {
  return {
    schema: blockSchemas[type] as unknown as z.ZodTypeAny,
    isContainer: false,
    group: LEAF_GROUPS[type] ?? "generic",
    ar: LEAF_LABELS[type]?.ar ?? type,
    en: LEAF_LABELS[type]?.en ?? type,
  };
}

const STRUCTURE_ENTRIES: readonly (readonly [ContainerType, BlockDef])[] = [
  [
    "section",
    {
      schema: sectionSchema,
      isContainer: true,
      children: { allowed: [...CONTAINER_TYPES, ...LEAF_IN_CONTAINER], max: 24 },
      group: "structure",
      ar: "قسم",
      en: "Section",
    },
  ],
  [
    "container",
    {
      schema: containerSchema,
      isContainer: true,
      children: { allowed: [...CONTAINER_TYPES, ...LEAF_IN_CONTAINER], max: 24 },
      group: "structure",
      ar: "حاوية",
      en: "Container",
    },
  ],
  [
    "row",
    {
      schema: rowSchema,
      isContainer: true,
      children: { allowed: ["column"], max: 6 },
      group: "structure",
      ar: "صف (أعمدة)", 
      en: "Row (columns)",
    },
  ],
  [
    "column",
    {
      schema: columnSchema,
      isContainer: true,
      children: { allowed: ["container", "row", ...LEAF_IN_CONTAINER], max: 12 },
      group: "structure",
      ar: "عمود",
      en: "Column",
    },
  ],
];

/** السجل الموحّد: كل الأنواع الورقية + أنواع البنية */
export const BLOCK_REGISTRY: Record<BlockType, BlockDef> = (() => {
  const reg = {} as Record<BlockType, BlockDef>;
  for (const type of Object.keys(blockSchemas) as BlockType[]) {
    reg[type] = leafDef(type);
  }
  for (const [type, def] of STRUCTURE_ENTRIES) {
    reg[type] = def;
  }
  return reg;
})();

/** الأنواع المعروضة في مكتبة المحرر — الأنواع القديمة المُرحّلة مستثناة */
export const LIBRARY_HIDDEN_TYPES: readonly BlockType[] = ["columns"];

// ─── أدوات الشجرة ───

/** عدد عقد الشجرة كليًا */
export function countNodes(nodes: ContentNode[]): number {
  let n = 0;
  for (const node of nodes) {
    n += 1;
    if (node.children) n += countNodes(node.children);
  }
  return n;
}

/** أقصى عمق (الجذر = 1) */
export function maxDepth(nodes: ContentNode[]): number {
  let depth = 0;
  for (const node of nodes) {
    const d = node.children?.length ? 1 + maxDepth(node.children) : 1;
    if (d > depth) depth = d;
  }
  return depth;
}

/** البحث عن عقدة بالمعرف (مع مسار الآباء) */
export function findNode(
  nodes: ContentNode[],
  id: string
): { node: ContentNode; parent: ContentNode | null; siblings: ContentNode[] } | null {
  for (const node of nodes) {
    if (node.id === id) return { node, parent: null, siblings: nodes };
    if (node.children?.length) {
      const found = findNode(node.children, id);
      if (found) return { ...found, parent: found.parent ?? node };
    }
  }
  return null;
}

/** حذف عقدة بالمعرف — يعيد true إذا حُذفت */
export function removeNode(nodes: ContentNode[], id: string): boolean {
  const idx = nodes.findIndex((n) => n.id === id);
  if (idx >= 0) {
    nodes.splice(idx, 1);
    return true;
  }
  for (const node of nodes) {
    if (node.children && removeNode(node.children, id)) return true;
  }
  return false;
}

/** استنساخ عميق مع معرفات جديدة فريدة (نسخ/لصق وتكرار) */
export function cloneWithNewIds(
  node: ContentNode,
  takenIds: Set<string>,
  suffixGen: () => string
): ContentNode {
  const newId = (() => {
    for (let i = 0; i < 50; i++) {
      const candidate = `${node.id}-${suffixGen()}`.slice(0, 60);
      if (!takenIds.has(candidate)) return candidate;
    }
    return `b-${suffixGen()}${suffixGen()}`;
  })();
  takenIds.add(newId);
  return {
    ...node,
    id: newId,
    props: node.props ? structuredClone(node.props) : undefined,
    style: node.style ? structuredClone(node.style) : undefined,
    children: node.children?.map((c) => cloneWithNewIds(c, takenIds, suffixGen)),
  };
}

/** جمع كل المعرفات في الشجرة */
export function collectIds(nodes: ContentNode[], into: Set<string> = new Set()): Set<string> {
  for (const node of nodes) {
    into.add(node.id);
    if (node.children) collectIds(node.children, into);
  }
  return into;
}

/** معرف فريد جديد بنمط b-{type}-{random} */
export function newNodeId(type: string, taken: Set<string>): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  for (let attempt = 0; attempt < 50; attempt++) {
    let suffix = "";
    for (let i = 0; i < 6; i++) suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
    const id = `b-${type}-${suffix}`;
    if (!taken.has(id)) return id;
  }
  return `b-${type}-${Date.now().toString(36)}`;
}

// ─── القيم الافتراضية عند الإدراج ───

const STYLE_KEYS = ["base", "mobile", "tablet", "desktop"] as const;

/**
 * عقدة افتراضية جاهزة للإدراج: قيم props تلبي المخطط (فارغة لكنها صالحة)،
 * والحاويات تنشئ بنيتها الأولية (صف بعامودين، عمود بنص placeholder).
 * لا تُستخدم في الخادم إطلاقًا — أداة إدراج في المحرر فقط.
 */
export function defaultNode(type: BlockType, takenIds: Set<string>): ContentNode {
  const id = newNodeId(type, takenIds);
  takenIds.add(id);
  const node: ContentNode = { id, type };

  if (type === "section") {
    node.props = {};
    node.children = [];
    return node;
  }
  if (type === "container") {
    node.props = {};
    node.children = [];
    return node;
  }
  if (type === "row") {
    node.props = { gap: "md" };
    node.children = [defaultNode("column", takenIds), defaultNode("column", takenIds)];
    return node;
  }
  if (type === "column") {
    node.props = { gap: "md", span: "auto", align: "start" };
    node.children = [defaultNode("text", takenIds)];
    return node;
  }

  // كتل ورقية — قيم أولية تلبي المخطط لكل نوع
  const emptyDefaults: Partial<Record<BlockType, Record<string, unknown>>> = {
    heading: { text: "", level: 2, align: "start" },
    text: { paragraphs: [""] },
    image: { src: "", alt: "", rounded: true, width: "content" },
    gallery: { images: [{ src: "", alt: "" }], columns: 3 },
    buttonLink: { label: "", href: "#", variant: "primary" },
    simpleTable: { headers: ["", ""], rows: [["", ""]] },
    divider: {},
    spacer: { size: "md" },
    richText: { paragraphs: [""] },
    contactInfo: { channels: [] },
    requestForm: { showPrivacy: true, showNextSteps: true },
    navCtaBanner: { label: "", links: [{ label: "", href: "#", variant: "primary" }] },
    hero: { kicker: "", title: "", titleAccent: "", description: "", support: [] },
    servicesGrid: { kicker: "", title: "", cards: [{ service: "web", blurb: "" }], items: [] },
    featureGrid: { kicker: "", title: "", items: [{ title: "", body: "" }] },
    worksShowcase: { kicker: "", title: "", cases: [{ key: "case", title: "", kind: "design", summary: "", badge: "" }] },
    processSteps: { kicker: "", title: "", steps: [{ title: "", line: "" }] },
    faqSection: { kicker: "", title: "", items: [{ q: "", a: "" }] },
    ctaSection: { title: "", body: "", links: [{ label: "", href: "#", variant: "primary" }] },
    pageHeader: { kicker: "", title: "", intro: [], quickLinks: [] },
    visionMission: { vision: { title: "", body: "" }, mission: { title: "", body: "" } },
    numberedValues: { title: "", items: [{ title: "", body: "" }] },
    numberedList: { title: "", items: [{ title: "", body: "" }] },
    servicesDetail: {
      items: [{ service: "web", name: "", definition: "", forWhom: "", problems: [], deliverables: [] }],
      labels: { forWhom: "", problems: "", deliverables: "" },
    },
    worksFull: {
      labels: { problem: "", users: "", functions: "", status: "" },
      statuses: { design: "", interactive: "", flow: "" },
      cases: [{ key: "case", title: "", kind: "design", summary: "", problem: "", users: "", functions: [] }],
    },
    processFull: {
      labels: { clientRole: "", deliverables: "" },
      phases: [{ title: "", goal: "", weDo: [], clientRole: "", deliverables: [] }],
    },
  };
  node.props = structuredClone(emptyDefaults[type] ?? {});
  // أعمدة legacy ليست في المكتبة لكن أبقيناها صالحة للمخطط
  if (type === "columns") {
    node.props = { columns: [{ heading: "", paragraphs: [""] }] };
  }
  return node;
}

/** تنظيف النمط من المفاتيح غير المعروفة قبل الحفظ */
export function cleanStyle(style: unknown): Record<string, unknown> | undefined {
  if (typeof style !== "object" || style === null || Array.isArray(style)) return undefined;
  const src = style as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of STYLE_KEYS) {
    const slot = src[key];
    if (typeof slot === "object" && slot !== null && !Array.isArray(slot) && Object.keys(slot as object).length > 0) {
      out[key] = slot;
    }
  }
  return Object.keys(out).length ? out : undefined;
}
