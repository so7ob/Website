/**
 * نموذج محتوى الصفحة — شجرة Blocks مسلسلة JSON تُحفظ في قاعدة البيانات.
 * كل نوع له مخطط تحقق zod (validateBlocks) يُنفذ في الخادم قبل الحفظ والنشر،
 * ولا يُنفذ أي JavaScript/JSX/MDX قادم من محتوى المستخدم إطلاقًا.
 */
import { z } from "zod";
import { SERVICE_TYPES } from "@/lib/validation";

// ─── أدوات مشتركة ───

const text = (max = 500) => z.string().max(max);
const shortText = (max = 160) => z.string().max(max);
const url = z
  .string()
  .max(300)
  .refine((v) => v === "" || /^(https?:\/\/|mailto:|tel:|\/|#)/i.test(v), "invalid_url");
const anchorId = z.string().regex(/^[a-zA-Z][\w-]{0,60}$/, "invalid_anchor").optional();

export const backgroundTone = z.enum(["default", "white", "accent", "navy", "soft"]);
export const paddingSize = z.enum(["none", "sm", "md", "lg"]);

export const blockStyle = z.object({
  background: backgroundTone.default("default"),
  paddingY: paddingSize.default("md"),
});

export const blockVisibility = z.object({
  mobile: z.boolean().default(true),
  tablet: z.boolean().default(true),
  desktop: z.boolean().default(true),
});

const baseShape = {
  id: z.string().min(1).max(60),
  style: blockStyle.optional(),
  visibility: blockVisibility.optional(),
  anchorId,
};

// ─── أنواع البيانات المشتركة بين المكونات ───

const serviceTypeSchema = z.enum(SERVICE_TYPES as unknown as [string, ...string[]]);

const serviceDetail = z.object({
  service: serviceTypeSchema,
  name: shortText(120),
  definition: text(2000),
  forWhom: text(2000),
  problems: z.array(text(600)).max(12),
  deliverables: z.array(text(600)).max(16),
});

const faqItem = z.object({ q: text(600), a: text(3000) });
const titledBody = z.object({ title: shortText(200), body: text(3000) });
const linkItem = z.object({
  label: shortText(120),
  href: url,
  variant: z.enum(["primary", "outline", "navy"]).default("primary"),
});

// ─── مخططات المكونات (سجل المكونات المسموح بها) ───

export const blockSchemas = {
  // أقسام الصفحة الرئيسية الحالية
  hero: z.object({
    ...baseShape,
    type: z.literal("hero"),
    props: z.object({
      kicker: shortText(),
      title: text(300),
      titleAccent: text(200),
      description: text(1200),
      support: z.array(shortText(200)).max(8).default([]),
    }),
  }),
  servicesGrid: z.object({
    ...baseShape,
    type: z.literal("servicesGrid"),
    props: z.object({
      kicker: shortText(),
      title: text(300),
      description: text(1200).optional(),
      cards: z.array(z.object({ service: serviceTypeSchema, blurb: text(600) })).min(1).max(12),
      items: z.array(serviceDetail).max(8).default([]),
      learnMore: shortText(80).optional(),
      viewAllLabel: shortText(80).optional(),
      viewAllHref: url.optional(),
    }),
  }),
  featureGrid: z.object({
    ...baseShape,
    type: z.literal("featureGrid"),
    props: z.object({
      kicker: shortText(),
      title: text(300),
      items: z.array(titledBody).min(1).max(9),
      columns: z.enum(["2", "3"]).default("3"),
    }),
  }),
  worksShowcase: z.object({
    ...baseShape,
    type: z.literal("worksShowcase"),
    props: z.object({
      kicker: shortText(),
      title: text(300),
      description: text(1200).optional(),
      cases: z
        .array(
          z.object({
            key: z.string().max(60),
            title: shortText(200),
            kind: z.enum(["design", "interactive", "flow"]),
            summary: text(1500),
            badge: shortText(80),
          })
        )
        .min(1)
        .max(9),
      disclaimer: text(600).optional(),
      viewAllLabel: shortText(80).optional(),
      viewAllHref: url.optional(),
    }),
  }),
  processSteps: z.object({
    ...baseShape,
    type: z.literal("processSteps"),
    props: z.object({
      kicker: shortText(),
      title: text(300),
      steps: z.array(z.object({ title: shortText(200), line: text(1000) })).min(1).max(8),
    }),
  }),
  faqSection: z.object({
    ...baseShape,
    type: z.literal("faqSection"),
    props: z.object({
      kicker: shortText(),
      title: text(300),
      description: text(1200).optional(),
      items: z.array(faqItem).min(1).max(30),
      limit: z.number().int().min(1).max(30).optional(),
      ctaLabel: shortText(120).optional(),
      ctaHref: url.optional(),
    }),
  }),
  ctaSection: z.object({
    ...baseShape,
    type: z.literal("ctaSection"),
    props: z.object({
      title: text(300),
      body: text(1500),
      discussNote: text(600).optional(),
      quoteNote: text(600).optional(),
      links: z.array(linkItem).min(1).max(3),
    }),
  }),
  // أقسام الصفحات الداخلية الحالية
  pageHeader: z.object({
    ...baseShape,
    type: z.literal("pageHeader"),
    props: z.object({
      kicker: shortText(),
      title: text(300),
      intro: z.array(text(2000)).max(6).default([]),
      quickLinks: z.array(z.object({ label: shortText(120), href: z.string().max(200) })).max(10).default([]),
    }),
  }),
  richText: z.object({
    ...baseShape,
    type: z.literal("richText"),
    props: z.object({
      heading: text(300).optional(),
      lead: text(2000).optional(),
      paragraphs: z.array(text(5000)).min(1).max(20),
      align: z.enum(["start", "center"]).default("start"),
      notice: text(1500).optional(),
    }),
  }),
  visionMission: z.object({
    ...baseShape,
    type: z.literal("visionMission"),
    props: z.object({
      vision: titledBody,
      mission: titledBody,
    }),
  }),
  numberedValues: z.object({
    ...baseShape,
    type: z.literal("numberedValues"),
    props: z.object({
      title: text(300),
      intro: text(1500).optional(),
      items: z.array(titledBody).min(1).max(12),
      closingNote: text(1000).optional(),
    }),
  }),
  numberedList: z.object({
    ...baseShape,
    type: z.literal("numberedList"),
    props: z.object({
      title: text(300),
      items: z.array(titledBody).min(1).max(12),
    }),
  }),
  navCtaBanner: z.object({
    ...baseShape,
    type: z.literal("navCtaBanner"),
    props: z.object({
      label: text(300),
      links: z.array(linkItem).min(1).max(4),
    }),
  }),
  servicesDetail: z.object({
    ...baseShape,
    type: z.literal("servicesDetail"),
    props: z.object({
      items: z.array(serviceDetail).min(1).max(8),
      labels: z.object({ forWhom: shortText(120), problems: shortText(120), deliverables: shortText(120) }),
      requestLabel: shortText(120).optional(),
    }),
  }),
  worksFull: z.object({
    ...baseShape,
    type: z.literal("worksFull"),
    props: z.object({
      intro: text(2000).optional(),
      disclaimer: z.object({ title: text(600), body: text(2000) }).optional(),
      labels: z.object({ problem: shortText(120), users: shortText(120), functions: shortText(120), status: shortText(120) }),
      statuses: z.object({ design: shortText(80), interactive: shortText(80), flow: shortText(80) }),
      cases: z
        .array(
          z.object({
            key: z.string().max(60),
            title: shortText(200),
            kind: z.enum(["design", "interactive", "flow"]),
            summary: text(2000),
            problem: text(2000),
            users: text(2000),
            functions: z.array(text(600)).max(12),
          })
        )
        .min(1)
        .max(9),
      interactiveNote: text(1000).optional(),
      flowNote: text(1000).optional(),
    }),
  }),
  processFull: z.object({
    ...baseShape,
    type: z.literal("processFull"),
    props: z.object({
      intro: text(2000).optional(),
      labels: z.object({ clientRole: shortText(120), deliverables: shortText(120) }),
      phases: z
        .array(
          z.object({
            title: shortText(200),
            goal: text(2000),
            weDo: z.array(text(600)).max(10),
            clientRole: text(2000),
            deliverables: z.array(text(600)).max(10),
          })
        )
        .min(1)
        .max(8),
      changes: z
        .object({ kicker: shortText(120), title: text(300), body: text(2000), items: z.array(text(600)).max(10) })
        .optional(),
    }),
  }),
  requestForm: z.object({
    ...baseShape,
    type: z.literal("requestForm"),
    props: z.object({
      preselectService: serviceTypeSchema.optional(),
      showPrivacy: z.boolean().default(true),
      showNextSteps: z.boolean().default(true),
    }),
  }),
  contactInfo: z.object({
    ...baseShape,
    type: z.literal("contactInfo"),
    props: z.object({
      title: shortText(200).optional(),
      channels: z
        .array(
          z.object({
            kind: z.enum(["email", "phone", "address"]),
            label: shortText(120),
            value: text(300),
            href: url.optional(),
          })
        )
        .max(6)
        .default([]),
    }),
  }),
  // مكونات عامة للصفحات الجديدة
  heading: z.object({
    ...baseShape,
    type: z.literal("heading"),
    props: z.object({
      text: text(300),
      level: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(2),
      align: z.enum(["start", "center"]).default("start"),
      kicker: shortText(120).optional(),
    }),
  }),
  text: z.object({
    ...baseShape,
    type: z.literal("text"),
    props: z.object({
      paragraphs: z.array(text(5000)).min(1).max(20),
      align: z.enum(["start", "center"]).default("start"),
      size: z.enum(["base", "lg"]).default("base"),
    }),
  }),
  image: z.object({
    ...baseShape,
    type: z.literal("image"),
    props: z.object({
      src: z.string().max(500),
      alt: z.string().max(300),
      caption: text(600).optional(),
      rounded: z.boolean().default(true),
      width: z.enum(["content", "full"]).default("content"),
    }),
  }),
  gallery: z.object({
    ...baseShape,
    type: z.literal("gallery"),
    props: z.object({
      images: z
        .array(z.object({ src: z.string().max(500), alt: z.string().max(300), caption: text(300).optional() }))
        .min(1)
        .max(12),
      columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(3),
    }),
  }),
  buttonLink: z.object({
    ...baseShape,
    type: z.literal("buttonLink"),
    props: linkItem,
  }),
  columns: z.object({
    ...baseShape,
    type: z.literal("columns"),
    props: z.object({
      columns: z
        .array(z.object({ heading: shortText(200).optional(), paragraphs: z.array(text(4000)).min(1).max(10) }))
        .min(1)
        .max(4),
    }),
  }),
  simpleTable: z.object({
    ...baseShape,
    type: z.literal("simpleTable"),
    props: z.object({
      caption: text(300).optional(),
      headers: z.array(shortText(120)).min(1).max(8),
      rows: z.array(z.array(text(300)).max(8)).min(1).max(50),
    }),
  }),
  divider: z.object({
    ...baseShape,
    type: z.literal("divider"),
    props: z.object({}),
  }),
  spacer: z.object({
    ...baseShape,
    type: z.literal("spacer"),
    props: z.object({ size: z.enum(["sm", "md", "lg"]).default("md") }),
  }),
} as const;

export type BlockType = keyof typeof blockSchemas;

export type Block = {
  id: string;
  type: BlockType;
  props: Record<string, unknown>;
  style?: { background?: string; paddingY?: string };
  visibility?: { mobile?: boolean; tablet?: boolean; desktop?: boolean };
  anchorId?: string;
};

/** قائمة الأنواع المعروضة في مكتبة المحرر */
export const BLOCK_LIBRARY: { type: BlockType; group: "home" | "pages" | "generic" | "layout"; ar: string; en: string }[] = [
  { type: "hero", group: "home", ar: "واجهة افتتاحية", en: "Hero" },
  { type: "servicesGrid", group: "home", ar: "بطاقات الخدمات", en: "Services grid" },
  { type: "featureGrid", group: "home", ar: "شبكة مميزات", en: "Feature grid" },
  { type: "worksShowcase", group: "home", ar: "معرض أعمال", en: "Works showcase" },
  { type: "processSteps", group: "home", ar: "خطوات سريعة", en: "Process steps" },
  { type: "faqSection", group: "home", ar: "أسئلة شائعة", en: "FAQ section" },
  { type: "ctaSection", group: "home", ar: "دعوة ختامية", en: "Final CTA" },
  { type: "pageHeader", group: "pages", ar: "ترويسة صفحة", en: "Page header" },
  { type: "richText", group: "pages", ar: "نص غني", en: "Rich text" },
  { type: "visionMission", group: "pages", ar: "رؤية ورسالة", en: "Vision & mission" },
  { type: "numberedValues", group: "pages", ar: "قيم مرقمة", en: "Numbered values" },
  { type: "numberedList", group: "pages", ar: "قائمة مبادئ", en: "Numbered list" },
  { type: "navCtaBanner", group: "pages", ar: "شريط روابط", en: "Nav CTA banner" },
  { type: "servicesDetail", group: "pages", ar: "خدمات مفصلة", en: "Services detail" },
  { type: "worksFull", group: "pages", ar: "أعمال موسعة", en: "Works full" },
  { type: "processFull", group: "pages", ar: "مراحل العمل", en: "Process full" },
  { type: "requestForm", group: "pages", ar: "نموذج طلب مشروع", en: "Project request form" },
  { type: "contactInfo", group: "pages", ar: "بيانات تواصل", en: "Contact info" },
  { type: "heading", group: "generic", ar: "عنوان", en: "Heading" },
  { type: "text", group: "generic", ar: "نص", en: "Text" },
  { type: "image", group: "generic", ar: "صورة", en: "Image" },
  { type: "gallery", group: "generic", ar: "معرض صور", en: "Gallery" },
  { type: "buttonLink", group: "generic", ar: "زر/رابط", en: "Button/Link" },
  { type: "columns", group: "generic", ar: "أعمدة", en: "Columns" },
  { type: "simpleTable", group: "generic", ar: "جدول بسيط", en: "Simple table" },
  { type: "divider", group: "layout", ar: "فاصل", en: "Divider" },
  { type: "spacer", group: "layout", ar: "مسافة", en: "Spacer" },
];

export const BLOCK_TYPES = Object.keys(blockSchemas) as BlockType[];

/** تحقق صفحة كاملة — يُستخدم في الخادم قبل الحفظ والنشر */
export function validateBlocks(input: unknown): { ok: true; blocks: Block[] } | { ok: false; error: string } {
  if (typeof input !== "string") return { ok: false, error: "blocks_not_json" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    return { ok: false, error: "blocks_invalid_json" };
  }
  if (!Array.isArray(parsed)) return { ok: false, error: "blocks_not_array" };
  if (parsed.length > 60) return { ok: false, error: "too_many_blocks" };

  const seenIds = new Set<string>();
  for (const raw of parsed) {
    if (typeof raw !== "object" || raw === null) return { ok: false, error: "block_invalid" };
    const type = (raw as { type?: unknown }).type;
    if (typeof type !== "string" || !(type in blockSchemas)) return { ok: false, error: "block_type_unknown" };
    const schema = blockSchemas[type as BlockType] as z.ZodTypeAny;
    const result = schema.safeParse(raw);
    if (!result.success) {
      return { ok: false, error: `block_schema:${type}:${result.error.issues[0]?.path.join(".") ?? "?"}` };
    }
    const id = (raw as { id?: unknown }).id;
    if (typeof id === "string") {
      if (seenIds.has(id)) return { ok: false, error: "block_duplicate_id" };
      seenIds.add(id);
    }
  }
  return { ok: true, blocks: parsed as Block[] };
}

/** المسارات المحجوزة — لا يمكن لصفحة CMS استخدامها */
export const RESERVED_SLUGS = [
  "api",
  "account",
  "admin",
  "auth",
  "assets",
  "_next",
  "robots.txt",
  "sitemap.xml",
];

export function isValidSlug(slug: string): boolean {
  if (slug === "") return true; // الرئيسية
  if (!/^[a-z0-9-]{1,60}$/.test(slug)) return false;
  if (slug.startsWith("-") || slug.endsWith("-") || slug.includes("--")) return false;
  return !RESERVED_SLUGS.includes(slug);
}
