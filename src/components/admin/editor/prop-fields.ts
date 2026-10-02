"use client";

/**
 * سجل حقول خصائص الكتل — قلب نموذج التحرير العام.
 * لكل نوع كتلة قائمة FieldDef تصف كل خاصية كما في مخططات zod تمامًا
 * (src/lib/blocks/types.ts) — الحقول تنقسم: نص/نص طويل/رقم/اختيار/مفتاح/
 * وسائط/قائمة نصوص/مصفوفة كائنات/مجموعة حقول/صفوف جدول.
 *
 * التسميات ثنائية اللغة inline — أداة تحرير داخلية (مسموح بها هنا فقط).
 * قيم تعدادات الخدمات تأتي من خرائط محتوى الموقع (form.services) وتسميات
 * أنواع الأعمال من works.statuses — نفس مصدر العرض العام.
 */
import { blockSchemas, type BlockType } from "@/lib/blocks/types";
import { SERVICE_TYPES } from "@/lib/validation";
import { ar as siteAr } from "@/content/ar";
import { en as siteEn } from "@/content/en";
import type { Bi } from "./types";

// ─── تعريف الحقل ───

export type FieldType =
  | "text" // نص قصير
  | "textarea" // نص طويل
  | "number" // رقم صحيح
  | "select" // قيمة من تعداد
  | "switch" // منطقي
  | "media" // نص رابط صورة + منتقي وسائط
  | "stringlist" // مصفوفة نصوص
  | "array" // مصفوفة كائنات (itemFields)
  | "group" // كائن واحد مضمن (itemFields)
  | "rows"; // مصفوفة صفوف (كل صف مصفوفة نصوص — simpleTable.rows)

export interface FieldDef {
  key: string;
  label: Bi;
  type: FieldType;
  options?: { value: string; label: Bi }[];
  itemFields?: FieldDef[]; // عناصر array أو حقول group
  optional?: boolean; // اختياري — يسمح بقيمة فارغة في select
  numeric?: boolean; // قيم التعداد أرقام (heading.level / gallery.columns)
  placeholder?: string;
}

const L = (ar: string, en: string): Bi => ({ ar, en });

// ─── خيارات التعدادات ───

/** خدمات من محتوى الموقع — نفس تسميات النموذج العام */
export const SERVICE_OPTIONS: { value: string; label: Bi }[] = SERVICE_TYPES.map((s) => ({
  value: s,
  label: L(siteAr.form.services[s], siteEn.form.services[s]),
}));

/** أنواع حالات الأعمال — من works.statuses في محتوى الموقع */
export const KIND_OPTIONS: { value: string; label: Bi }[] = (["design", "interactive", "flow"] as const).map((k) => ({
  value: k,
  label: L(siteAr.works.statuses[k], siteEn.works.statuses[k]),
}));

const VARIANT_OPTIONS = [
  { value: "primary", label: L("أساسي", "Primary") },
  { value: "outline", label: L("محدد بحدود", "Outline") },
  { value: "navy", label: L("كحلي", "Navy") },
];

const ALIGN_OPTIONS = [
  { value: "start", label: L("بداية السطر", "Start") },
  { value: "center", label: L("وسط", "Center") },
];

const CHANNEL_KIND_OPTIONS = [
  { value: "email", label: L("بريد إلكتروني", "Email") },
  { value: "phone", label: L("هاتف", "Phone") },
  { value: "address", label: L("عنوان", "Address") },
];

// ─── تسميات متكررة ───

const LB = {
  kicker: L("سطر تمهيدي", "Kicker"),
  title: L("العنوان", "Title"),
  description: L("الوصف", "Description"),
  label: L("التسمية", "Label"),
  href: L("الرابط", "Link URL"),
  variant: L("النمط", "Variant"),
  intro: L("المقدمة", "Intro"),
  problems: L("المشكلات", "Problems"),
  deliverables: L("المخرجات", "Deliverables"),
  forWhom: L("لمن", "For whom"),
  service: L("الخدمة", "Service"),
  name: L("الاسم", "Name"),
  definition: L("التعريف", "Definition"),
  body: L("النص", "Body"),
  items: L("العناصر", "Items"),
  key: L("المعرف", "Key"),
  kind: L("النوع", "Kind"),
  summary: L("الملخص", "Summary"),
  badge: L("الشارة", "Badge"),
  align: L("المحاذاة", "Alignment"),
  caption: L("تعليق الصورة", "Caption"),
  alt: L("النص البديل", "Alt text"),
  src: L("مصدر الصورة", "Image source"),
  paragraphs: L("الفقرات", "Paragraphs"),
  columns: L("عدد الأعمدة", "Columns"),
  requestLabel: L("نص زر الطلب", "Request button"),
  goal: L("الهدف", "Goal"),
  weDo: L("ما نقوم به", "What we do"),
  clientRole: L("دور العميل", "Client role"),
  phaseTitle: L("عنوان المرحلة", "Phase title"),
  users: L("المستخدمون", "Users"),
  functions: L("الوظائف", "Functions"),
  problem: L("المشكلة", "Problem"),
  status: L("الحالة", "Status"),
  heading: L("عنوان العمود", "Column heading"),
  disclaimer: L("تنويه", "Disclaimer"),
  changes: L("تغييرات النطاق", "Scope changes"),
};

const SERVICE_ITEM_FIELDS: FieldDef[] = [
  { key: "service", label: LB.service, type: "select", options: SERVICE_OPTIONS },
  { key: "name", label: LB.name, type: "text" },
  { key: "definition", label: LB.definition, type: "textarea" },
  { key: "forWhom", label: LB.forWhom, type: "textarea" },
  { key: "problems", label: LB.problems, type: "stringlist" },
  { key: "deliverables", label: LB.deliverables, type: "stringlist" },
];

const LINK_ITEM_FIELDS: FieldDef[] = [
  { key: "label", label: LB.label, type: "text" },
  { key: "href", label: LB.href, type: "text" },
  { key: "variant", label: LB.variant, type: "select", options: VARIANT_OPTIONS },
];

const TITLED_BODY_FIELDS: FieldDef[] = [
  { key: "title", label: LB.title, type: "text" },
  { key: "body", label: LB.body, type: "textarea" },
];

// ─── السجل: 27 نوعًا ───

export const PROP_FIELDS: Record<BlockType, FieldDef[]> = {
  hero: [
    { key: "kicker", label: LB.kicker, type: "text" },
    { key: "title", label: LB.title, type: "text" },
    { key: "titleAccent", label: L("جزء العنوان الملون", "Accent part of title"), type: "text" },
    { key: "description", label: LB.description, type: "textarea" },
    { key: "support", label: L("أسطر داعمة", "Support lines"), type: "stringlist" },
  ],

  servicesGrid: [
    { key: "kicker", label: LB.kicker, type: "text" },
    { key: "title", label: LB.title, type: "text" },
    { key: "description", label: LB.description, type: "textarea", optional: true },
    {
      key: "cards",
      label: L("بطاقات الخدمات", "Service cards"),
      type: "array",
      itemFields: [
        { key: "service", label: LB.service, type: "select", options: SERVICE_OPTIONS },
        { key: "blurb", label: L("وصف البطاقة", "Card blurb"), type: "textarea" },
      ],
    },
    { key: "items", label: L("تفاصيل الخدمات", "Service details"), type: "array", itemFields: SERVICE_ITEM_FIELDS },
    { key: "learnMore", label: L("نص «اعرف أكثر»", "Learn more label"), type: "text", optional: true },
    { key: "viewAllLabel", label: L("نص «عرض الكل»", "View all label"), type: "text", optional: true },
    { key: "viewAllHref", label: L("رابط «عرض الكل»", "View all link"), type: "text", optional: true },
  ],

  featureGrid: [
    { key: "kicker", label: LB.kicker, type: "text" },
    { key: "title", label: LB.title, type: "text" },
    { key: "items", label: LB.items, type: "array", itemFields: TITLED_BODY_FIELDS },
    {
      key: "columns",
      label: LB.columns,
      type: "select",
      options: [
        { value: "2", label: L("عمودان", "2 columns") },
        { value: "3", label: L("ثلاثة أعمدة", "3 columns") },
      ],
    },
  ],

  worksShowcase: [
    { key: "kicker", label: LB.kicker, type: "text" },
    { key: "title", label: LB.title, type: "text" },
    { key: "description", label: LB.description, type: "textarea", optional: true },
    {
      key: "cases",
      label: L("الحالات", "Cases"),
      type: "array",
      itemFields: [
        { key: "key", label: LB.key, type: "text" },
        { key: "title", label: LB.title, type: "text" },
        { key: "kind", label: LB.kind, type: "select", options: KIND_OPTIONS },
        { key: "summary", label: LB.summary, type: "textarea" },
        { key: "badge", label: LB.badge, type: "text" },
      ],
    },
    { key: "disclaimer", label: LB.disclaimer, type: "textarea", optional: true },
    { key: "viewAllLabel", label: L("نص «عرض الكل»", "View all label"), type: "text", optional: true },
    { key: "viewAllHref", label: L("رابط «عرض الكل»", "View all link"), type: "text", optional: true },
  ],

  processSteps: [
    { key: "kicker", label: LB.kicker, type: "text" },
    { key: "title", label: LB.title, type: "text" },
    {
      key: "steps",
      label: L("الخطوات", "Steps"),
      type: "array",
      itemFields: [
        { key: "title", label: LB.title, type: "text" },
        { key: "line", label: L("السطر", "Line"), type: "textarea" },
      ],
    },
  ],

  faqSection: [
    { key: "kicker", label: LB.kicker, type: "text" },
    { key: "title", label: LB.title, type: "text" },
    { key: "description", label: LB.description, type: "textarea", optional: true },
    {
      key: "items",
      label: L("الأسئلة", "Questions"),
      type: "array",
      itemFields: [
        { key: "q", label: L("السؤال", "Question"), type: "text" },
        { key: "a", label: L("الجواب", "Answer"), type: "textarea" },
      ],
    },
    { key: "limit", label: L("حد العرض (اختياري)", "Display limit (optional)"), type: "number", optional: true },
    { key: "ctaLabel", label: L("نص دعوة إضافية", "CTA label"), type: "text", optional: true },
    { key: "ctaHref", label: L("رابط الدعوة", "CTA link"), type: "text", optional: true },
  ],

  ctaSection: [
    { key: "title", label: LB.title, type: "text" },
    { key: "body", label: LB.body, type: "textarea" },
    { key: "discussNote", label: L("ملاحظة المناقشة", "Discussion note"), type: "textarea", optional: true },
    { key: "quoteNote", label: L("ملاحظة عرض السعر", "Quote note"), type: "textarea", optional: true },
    { key: "links", label: L("الأزرار", "Buttons"), type: "array", itemFields: LINK_ITEM_FIELDS },
  ],

  pageHeader: [
    { key: "kicker", label: LB.kicker, type: "text" },
    { key: "title", label: LB.title, type: "text" },
    { key: "intro", label: L("فقرات المقدمة", "Intro paragraphs"), type: "stringlist" },
    {
      key: "quickLinks",
      label: L("روابط سريعة", "Quick links"),
      type: "array",
      itemFields: [
        { key: "label", label: LB.label, type: "text" },
        { key: "href", label: LB.href, type: "text" },
      ],
    },
  ],

  richText: [
    { key: "heading", label: LB.title, type: "text", optional: true },
    { key: "lead", label: L("المقدمة", "Lead paragraph"), type: "textarea", optional: true },
    { key: "paragraphs", label: LB.paragraphs, type: "stringlist" },
    { key: "align", label: LB.align, type: "select", options: ALIGN_OPTIONS },
    { key: "notice", label: L("تنبيه ختامي", "Notice"), type: "textarea", optional: true },
  ],

  visionMission: [
    { key: "vision", label: L("الرؤية", "Vision"), type: "group", itemFields: TITLED_BODY_FIELDS },
    { key: "mission", label: L("الرسالة", "Mission"), type: "group", itemFields: TITLED_BODY_FIELDS },
  ],

  numberedValues: [
    { key: "title", label: LB.title, type: "text" },
    { key: "intro", label: LB.intro, type: "textarea", optional: true },
    { key: "items", label: L("القيم", "Values"), type: "array", itemFields: TITLED_BODY_FIELDS },
    { key: "closingNote", label: L("ملاحظة ختامية", "Closing note"), type: "textarea", optional: true },
  ],

  numberedList: [
    { key: "title", label: LB.title, type: "text" },
    { key: "items", label: L("المبادئ", "Principles"), type: "array", itemFields: TITLED_BODY_FIELDS },
  ],

  navCtaBanner: [
    { key: "label", label: LB.label, type: "text" },
    { key: "links", label: L("الروابط", "Links"), type: "array", itemFields: LINK_ITEM_FIELDS },
  ],

  servicesDetail: [
    { key: "items", label: L("الخدمات", "Services"), type: "array", itemFields: SERVICE_ITEM_FIELDS },
    {
      key: "labels",
      label: L("تسميات الأقسام", "Section labels"),
      type: "group",
      itemFields: [
        { key: "forWhom", label: LB.forWhom, type: "text" },
        { key: "problems", label: LB.problems, type: "text" },
        { key: "deliverables", label: LB.deliverables, type: "text" },
      ],
    },
    { key: "requestLabel", label: LB.requestLabel, type: "text", optional: true },
  ],

  worksFull: [
    { key: "intro", label: LB.intro, type: "textarea", optional: true },
    {
      key: "disclaimer",
      label: LB.disclaimer,
      type: "group",
      optional: true,
      itemFields: [
        { key: "title", label: LB.title, type: "text" },
        { key: "body", label: LB.body, type: "textarea" },
      ],
    },
    {
      key: "labels",
      label: L("تسميات الحقول", "Field labels"),
      type: "group",
      itemFields: [
        { key: "problem", label: LB.problem, type: "text" },
        { key: "users", label: LB.users, type: "text" },
        { key: "functions", label: LB.functions, type: "text" },
        { key: "status", label: LB.status, type: "text" },
      ],
    },
    {
      key: "statuses",
      label: L("تسميات الأنواع", "Kind labels"),
      type: "group",
      itemFields: [
        { key: "design", label: L("تصور تصميمي", "Design concept"), type: "text" },
        { key: "interactive", label: L("نموذج تفاعلي", "Interactive prototype"), type: "text" },
        { key: "flow", label: L("مخطط سير", "Workflow diagram"), type: "text" },
      ],
    },
    {
      key: "cases",
      label: L("الحالات", "Cases"),
      type: "array",
      itemFields: [
        { key: "key", label: LB.key, type: "text" },
        { key: "title", label: LB.title, type: "text" },
        { key: "kind", label: LB.kind, type: "select", options: KIND_OPTIONS },
        { key: "summary", label: LB.summary, type: "textarea" },
        { key: "problem", label: LB.problem, type: "textarea" },
        { key: "users", label: LB.users, type: "textarea" },
        { key: "functions", label: LB.functions, type: "stringlist" },
      ],
    },
    { key: "interactiveNote", label: L("ملاحظة النموذج التفاعلي", "Interactive note"), type: "textarea", optional: true },
    { key: "flowNote", label: L("ملاحظة مخطط السير", "Flow note"), type: "textarea", optional: true },
  ],

  processFull: [
    { key: "intro", label: LB.intro, type: "textarea", optional: true },
    {
      key: "labels",
      label: L("تسميات الحقول", "Field labels"),
      type: "group",
      itemFields: [
        { key: "clientRole", label: LB.clientRole, type: "text" },
        { key: "deliverables", label: LB.deliverables, type: "text" },
      ],
    },
    {
      key: "phases",
      label: L("المراحل", "Phases"),
      type: "array",
      itemFields: [
        { key: "title", label: LB.phaseTitle, type: "text" },
        { key: "goal", label: LB.goal, type: "textarea" },
        { key: "weDo", label: LB.weDo, type: "stringlist" },
        { key: "clientRole", label: LB.clientRole, type: "textarea" },
        { key: "deliverables", label: LB.deliverables, type: "stringlist" },
      ],
    },
    {
      key: "changes",
      label: LB.changes,
      type: "group",
      optional: true,
      itemFields: [
        { key: "kicker", label: LB.kicker, type: "text" },
        { key: "title", label: LB.title, type: "text" },
        { key: "body", label: LB.body, type: "textarea" },
        { key: "items", label: L("بنود التغيير", "Change items"), type: "stringlist" },
      ],
    },
  ],

  requestForm: [
    { key: "preselectService", label: L("خدمة محددة مسبقًا", "Preselected service"), type: "select", options: SERVICE_OPTIONS, optional: true },
    { key: "showPrivacy", label: L("بطاقة الخصوصية", "Privacy card"), type: "switch" },
    { key: "showNextSteps", label: L("بطاقة الخطوات التالية", "Next steps card"), type: "switch" },
  ],

  contactInfo: [
    { key: "title", label: LB.title, type: "text", optional: true },
    {
      key: "channels",
      label: L("قنوات التواصل", "Channels"),
      type: "array",
      itemFields: [
        { key: "kind", label: L("نوع القناة", "Channel kind"), type: "select", options: CHANNEL_KIND_OPTIONS },
        { key: "label", label: LB.label, type: "text" },
        { key: "value", label: L("القيمة", "Value"), type: "text" },
        { key: "href", label: L("رابط (اختياري)", "Link (optional)"), type: "text", optional: true },
      ],
    },
  ],

  heading: [
    { key: "text", label: L("النص", "Text"), type: "text" },
    {
      key: "level",
      label: L("مستوى العنوان", "Heading level"),
      type: "select",
      numeric: true,
      options: [
        { value: "2", label: L("عنوان 2", "Heading 2") },
        { value: "3", label: L("عنوان 3", "Heading 3") },
        { value: "4", label: L("عنوان 4", "Heading 4") },
      ],
    },
    { key: "align", label: LB.align, type: "select", options: ALIGN_OPTIONS },
    { key: "kicker", label: LB.kicker, type: "text", optional: true },
  ],

  text: [
    { key: "paragraphs", label: LB.paragraphs, type: "stringlist" },
    { key: "align", label: LB.align, type: "select", options: ALIGN_OPTIONS },
    {
      key: "size",
      label: L("حجم الخط", "Font size"),
      type: "select",
      options: [
        { value: "base", label: L("عادي", "Base") },
        { value: "lg", label: L("كبير", "Large") },
      ],
    },
  ],

  image: [
    { key: "src", label: LB.src, type: "media" },
    { key: "alt", label: LB.alt, type: "text" },
    { key: "caption", label: LB.caption, type: "text", optional: true },
    { key: "rounded", label: L("حواف دائرية", "Rounded corners"), type: "switch" },
    {
      key: "width",
      label: L("العرض", "Width"),
      type: "select",
      options: [
        { value: "content", label: L("عرض المحتوى", "Content width") },
        { value: "full", label: L("عرض كامل", "Full width") },
      ],
    },
  ],

  gallery: [
    {
      key: "images",
      label: L("الصور", "Images"),
      type: "array",
      itemFields: [
        { key: "src", label: LB.src, type: "media" },
        { key: "alt", label: LB.alt, type: "text" },
        { key: "caption", label: LB.caption, type: "text", optional: true },
      ],
    },
    {
      key: "columns",
      label: LB.columns,
      type: "select",
      numeric: true,
      options: [
        { value: "2", label: L("عمودان", "2 columns") },
        { value: "3", label: L("ثلاثة أعمدة", "3 columns") },
        { value: "4", label: L("أربعة أعمدة", "4 columns") },
      ],
    },
  ],

  buttonLink: LINK_ITEM_FIELDS,

  columns: [
    {
      key: "columns",
      label: L("الأعمدة", "Columns"),
      type: "array",
      itemFields: [
        { key: "heading", label: LB.heading, type: "text", optional: true },
        { key: "paragraphs", label: LB.paragraphs, type: "stringlist" },
      ],
    },
  ],

  simpleTable: [
    { key: "caption", label: L("عنوان الجدول", "Table caption"), type: "text", optional: true },
    { key: "headers", label: L("رؤوس الأعمدة", "Headers"), type: "stringlist" },
    { key: "rows", label: L("الصفوف", "Rows"), type: "rows" },
  ],

  divider: [],

  spacer: [
    {
      key: "size",
      label: L("الحجم", "Size"),
      type: "select",
      options: [
        { value: "sm", label: L("صغير", "Small") },
        { value: "md", label: L("متوسط", "Medium") },
        { value: "lg", label: L("كبير", "Large") },
      ],
    },
  ],
};

// ─── قوالب الصفحة الجديدة (تسميات أداة المحرر — inline كما في السجل) ───

export const PAGE_TEMPLATE_OPTIONS: { value: string; label: Bi; note: Bi }[] = [
  {
    value: "empty",
    label: L("صفحة فارغة", "Empty page"),
    note: L("بلا كتل — ابدأ من مكتبة المحرر", "No blocks — start from the library"),
  },
  {
    value: "blank-section",
    label: L("ترويسة + نص", "Header + text"),
    note: L("كتلتا ترويسة الصفحة والنص الغني جاهزتان", "Page header and rich text blocks ready"),
  },
];

// ─── الخصائص الافتراضية — قيم دنيا صالحة لكل نوع ───

export const DEFAULT_PROPS: Record<BlockType, Record<string, unknown>> = {
  hero: { kicker: "", title: "", titleAccent: "", description: "", support: [] },
  servicesGrid: { kicker: "", title: "", cards: [{ service: "web", blurb: "" }], items: [] },
  featureGrid: { kicker: "", title: "", items: [{ title: "", body: "" }], columns: "3" },
  worksShowcase: {
    kicker: "",
    title: "",
    cases: [{ key: "case-1", title: "", kind: "design", summary: "", badge: "" }],
  },
  processSteps: { kicker: "", title: "", steps: [{ title: "", line: "" }] },
  faqSection: { kicker: "", title: "", items: [{ q: "", a: "" }] },
  ctaSection: { title: "", body: "", links: [{ label: "", href: "", variant: "primary" }] },
  pageHeader: { kicker: "", title: "", intro: [], quickLinks: [] },
  richText: { paragraphs: [""], align: "start" },
  visionMission: { vision: { title: "", body: "" }, mission: { title: "", body: "" } },
  numberedValues: { title: "", items: [{ title: "", body: "" }] },
  numberedList: { title: "", items: [{ title: "", body: "" }] },
  navCtaBanner: { label: "", links: [{ label: "", href: "", variant: "primary" }] },
  servicesDetail: {
    items: [
      { service: "web", name: "", definition: "", forWhom: "", problems: [], deliverables: [] },
    ],
    labels: { forWhom: "", problems: "", deliverables: "" },
  },
  worksFull: {
    labels: { problem: "", users: "", functions: "", status: "" },
    statuses: { design: "", interactive: "", flow: "" },
    cases: [{ key: "case-1", title: "", kind: "design", summary: "", problem: "", users: "", functions: [] }],
  },
  processFull: {
    labels: { clientRole: "", deliverables: "" },
    phases: [{ title: "", goal: "", weDo: [], clientRole: "", deliverables: [] }],
  },
  requestForm: { showPrivacy: true, showNextSteps: true },
  contactInfo: { channels: [] },
  heading: { text: "", level: 2, align: "start" },
  text: { paragraphs: [""], align: "start", size: "base" },
  image: { src: "", alt: "", rounded: true, width: "content" },
  gallery: { images: [{ src: "", alt: "" }], columns: 3 },
  buttonLink: { label: "", href: "", variant: "primary" },
  columns: { columns: [{ paragraphs: [""] }] },
  simpleTable: { headers: [""], rows: [[""]] },
  divider: {},
  spacer: { size: "md" },
};

/** نسخة خصائص افتراضية عميقة (كل إضافة كتلة تحصل على نسختها) */
export function defaultProps(type: BlockType): Record<string, unknown> {
  return JSON.parse(JSON.stringify(DEFAULT_PROPS[type])) as Record<string, unknown>;
}

/** تحقق تطوري (dev فقط): كل DEFAULT_PROPS يطابق مخطط zod الخاص به */
export function assertDefaultProps(): void {
  if (process.env.NODE_ENV !== "development") return;
  for (const [type, props] of Object.entries(DEFAULT_PROPS)) {
    const schema = blockSchemas[type as BlockType];
    const result = schema.safeParse({ id: `b-${type}-assert`, type, props });
    if (!result.success) {
      const issue = result.error.issues[0];
      console.assert(false, `DEFAULT_PROPS[${type}] fails its zod schema: ${issue?.path.join(".")} — ${issue?.message}`);
    }
  }
}
