/**
 * نظام الأنماط المدرك للأجهزة — تباعد/خلفيات/حدود/زوايا/ظلال/محاذاة
 * بقيم مضبوطة (توكنز) متوافقة مع هوية الموقع.
 *
 * البنية: style.base + تجاوزات لكل جهاز (mobile/tablet/desktop).
 * الوراثة: القيمة الفعالة لأي جهاز = تجاوز الجهاز ?? base ?? الافتراضي.
 * الإصدار للـCSS (mobile-first):
 *   mobile-effective → أصناف بدون بادئة،
 *   tablet-effective → أصناف md:،
 *   desktop-effective → أصناف lg:.
 * وبذلك يطابق العرض بالضبط ما يُرى في معاينة iframe الحقيقية عند كل عرض.
 *
 * خصائص منطقية (RTL/LTR): كل قيم التباعد متناظرة (px/py/my) فتتكافأ في
 * الاتجاهين، والمحاذاة النصية تستخدم start/center المنطقية.
 *
 * مسؤولية التباعد: الحاوية (section/container/row/column) تملك خلفيتها
 * وتباعدها؛ الكتلة الورقية داخل حاوية تُرسم "عارية" بلا غلاف حشوة افتراضي —
 * فلا تتضاعف الحشوة ولا يُتجاهل المظهر بسبب تنسيق داخلي ثابت.
 */
import { z } from "zod";

// ─── التوكنز ───

export const SPACE_TOKENS = ["none", "xs", "sm", "md", "lg", "xl"] as const;
export type SpaceToken = (typeof SPACE_TOKENS)[number];

export const BACKGROUND_TOKENS = ["default", "white", "accent", "navy", "soft", "muted"] as const;
export type BackgroundToken = (typeof BACKGROUND_TOKENS)[number];

export const RADIUS_TOKENS = ["none", "sm", "md", "lg", "xl", "full"] as const;
export type RadiusToken = (typeof RADIUS_TOKENS)[number];

export const SHADOW_TOKENS = ["none", "sm", "md", "lg"] as const;
export type ShadowToken = (typeof SHADOW_TOKENS)[number];

export const BORDER_WIDTH_TOKENS = ["none", "thin", "md"] as const;
export type BorderWidthToken = (typeof BORDER_WIDTH_TOKENS)[number];

export const GAP_TOKENS = ["xs", "sm", "md", "lg"] as const;
export type GapToken = (typeof GAP_TOKENS)[number];

// ─── المخطط ───

/** فتحة نمط لجهاز واحد — كل الحقول اختيارية (تجاوزات فقط) */
export const styleSlotSchema = z
  .object({
    background: z.enum(BACKGROUND_TOKENS).optional(),
    paddingY: z.enum(SPACE_TOKENS).optional(),
    paddingX: z.enum(SPACE_TOKENS).optional(),
    marginY: z.enum(SPACE_TOKENS).optional(),
    radius: z.enum(RADIUS_TOKENS).optional(),
    shadow: z.enum(SHADOW_TOKENS).optional(),
    borderWidth: z.enum(BORDER_WIDTH_TOKENS).optional(),
    gap: z.enum(GAP_TOKENS).optional(),
    contentAlign: z.enum(["start", "center"]).optional(),
  })
  .strict();

export type StyleSlot = z.infer<typeof styleSlotSchema>;

/** النمط الكامل: أساس + تجاوزات أجهزة */
export const nodeStyleSchema = z
  .object({
    base: styleSlotSchema.optional(),
    mobile: styleSlotSchema.optional(),
    tablet: styleSlotSchema.optional(),
    desktop: styleSlotSchema.optional(),
  })
  .strict();

export type NodeStyle = z.infer<typeof nodeStyleSchema>;

// ─── الخرائط إلى أصناف Tailwind ───

const PADDING_Y: Record<SpaceToken, string> = {
  none: "py-0",
  xs: "py-3",
  sm: "py-6",
  md: "py-12",
  lg: "py-20",
  xl: "py-28",
};

const PADDING_X: Record<SpaceToken, string> = {
  none: "px-0",
  xs: "px-3",
  sm: "px-4",
  md: "px-6",
  lg: "px-10",
  xl: "px-16",
};

const MARGIN_Y: Record<SpaceToken, string> = {
  none: "my-0",
  xs: "my-3",
  sm: "my-6",
  md: "my-12",
  lg: "my-20",
  xl: "my-28",
};

const GAP: Record<GapToken, string> = {
  xs: "gap-2",
  sm: "gap-4",
  md: "gap-6",
  lg: "gap-10",
};

const RADIUS: Record<RadiusToken, string> = {
  none: "rounded-none",
  sm: "rounded-lg",
  md: "rounded-2xl",
  lg: "rounded-3xl",
  xl: "rounded-[2rem]",
  full: "rounded-full",
};

const SHADOW: Record<ShadowToken, string> = {
  none: "shadow-none",
  sm: "shadow-sm",
  md: "shadow-md",
  lg: "shadow-lg",
};

const BORDER_WIDTH: Record<BorderWidthToken, string> = {
  none: "border-0",
  thin: "border",
  md: "border-2",
};

const BACKGROUND: Record<BackgroundToken, string> = {
  default: "",
  white: "bg-white",
  accent: "bg-accent/50",
  navy: "bg-navy",
  soft: "bg-brand-soft/30",
  muted: "bg-muted/40",
};

const CONTENT_ALIGN = {
  start: "items-start",
  center: "items-center",
} as const;

type DeviceKey = "mobile" | "tablet" | "desktop";

/** القيمة الفعالة لخاصية في جهاز مع كشف الوراثة من الأساس */
export function effectiveValue<K extends keyof StyleSlot>(
  style: NodeStyle | undefined,
  device: DeviceKey,
  key: K
): { value: StyleSlot[K] | undefined; inherited: boolean } {
  const override = style?.[device]?.[key];
  if (override !== undefined) return { value: override, inherited: false };
  return { value: style?.base?.[key], inherited: true };
}

/** إعادة ضبط تجاوز جهاز لخاصية (الوراثة تعود للأساس) */
export function resetDeviceValue(style: NodeStyle | undefined, device: DeviceKey, key: keyof StyleSlot): NodeStyle {
  const next: NodeStyle = { ...style };
  if (style?.[device]) {
    const slot = { ...style[device] } as Record<string, unknown>;
    delete slot[key as string];
    next[device] = Object.keys(slot).length ? (slot as StyleSlot) : undefined;
  }
  return next;
}

interface Emit {
  cls: string;
  prefix: "" | "md:" | "lg:";
}

function emitFor(
  style: NodeStyle | undefined,
  key: keyof StyleSlot,
  map: Record<string, string>
): Emit[] {
  const sources: { device: DeviceKey; prefix: "" | "md:" | "lg:" }[] = [
    { device: "mobile", prefix: "" },
    { device: "tablet", prefix: "md:" },
    { device: "desktop", prefix: "lg:" },
  ];
  const out: Emit[] = [];
  let prevValue: string | undefined;
  for (const { device, prefix } of sources) {
    const { value } = effectiveValue(style, device, key);
    if (value === undefined) continue;
    const cls = map[value as string];
    if (!cls) continue;
    // قيمة مطابقة لآخر فاصل صادر — إعلان مكرر في الشلال، يُحذف
    if (prevValue === value) continue;
    out.push({ cls, prefix });
    prevValue = value;
  }
  return out;
}

function join(emits: Emit[]): string {
  return emits
    .map((e) => (e.prefix ? `${e.prefix}${e.cls}` : e.cls))
    .filter((c, i, arr) => arr.indexOf(c) === i)
    .join(" ");
}

/**
 * أصناف نمط عقدة (حاوية أو كتلة داخل حاوية) وفق النظام المدرك للأجهزة.
 * يعيد سلسلة أصناف جاهزة للدمج مع أصناف البنية (grid/flex).
 */
export function nodeStyleClasses(style: NodeStyle | undefined): string {
  const parts = [
    join(emitFor(style, "background", BACKGROUND)),
    join(emitFor(style, "paddingY", PADDING_Y)),
    join(emitFor(style, "paddingX", PADDING_X)),
    join(emitFor(style, "marginY", MARGIN_Y)),
    join(emitFor(style, "radius", RADIUS)),
    join(emitFor(style, "shadow", SHADOW)),
    join(emitFor(style, "borderWidth", BORDER_WIDTH)),
    join(emitFor(style, "gap", GAP)),
  ];
  return parts.filter(Boolean).join(" ");
}

/** صنف محاذاة محتوى العمود/الحاوية وفق الأجهزة */
export function nodeAlignClasses(style: NodeStyle | undefined): string {
  return join(emitFor(style, "contentAlign", CONTENT_ALIGN));
}

/** خلفية كتلة ورقية في الجذر (سلوك التوافق مع الصفحات القديمة) */
export function legacyBackgroundClass(token: string | undefined): string {
  return BACKGROUND[(token ?? "default") as BackgroundToken] ?? "";
}

/** حشوة كتلة ورقية في الجذر (سلوك التوافق) */
export function legacyPaddingClass(token: string | undefined): string {
  return PADDING_Y[(token ?? "md") as SpaceToken] ?? "py-12";
}

// ─── الأنماط المحفوظة (Presets) ───

export interface StylePreset {
  id: string;
  kind: "section" | "container" | "column";
  ar: string;
  en: string;
  /** رقعة نمط تُدمج فوق slot الأساس */
  base: StyleSlot;
}

/** أنماط محفوظة للأقسام والحاويات — تطبق على العقدة المحددة فقط (لا أثر عالمي) */
export const STYLE_PRESETS: StylePreset[] = [
  { id: "clean", kind: "section", ar: "نظيف", en: "Clean", base: { background: "white", paddingY: "md" } },
  { id: "soft", kind: "section", ar: "هادئ", en: "Soft", base: { background: "soft", paddingY: "lg" } },
  { id: "accent", kind: "section", ar: "مميز", en: "Accent", base: { background: "accent", paddingY: "lg" } },
  { id: "dark", kind: "section", ar: "داكن", en: "Dark", base: { background: "navy", paddingY: "xl" } },
  { id: "card", kind: "container", ar: "بطاقة", en: "Card", base: { background: "white", paddingY: "md", paddingX: "md", radius: "lg", shadow: "sm", borderWidth: "thin" } },
  { id: "outline", kind: "container", ar: "محدد", en: "Outlined", base: { borderWidth: "thin", radius: "md", paddingY: "sm", paddingX: "md" } },
  { id: "tinted", kind: "container", ar: "ملون هادئ", en: "Tinted", base: { background: "muted", radius: "md", paddingY: "sm", paddingX: "md" } },
  { id: "quiet", kind: "column", ar: "بلا زخرفة", en: "Quiet", base: {} },
  { id: "framed", kind: "column", ar: "إطار", en: "Framed", base: { borderWidth: "thin", radius: "md", paddingY: "sm", paddingX: "sm" } },
];

export function presetsForKind(kind: StylePreset["kind"]): StylePreset[] {
  return STYLE_PRESETS.filter((p) => p.kind === kind);
}
