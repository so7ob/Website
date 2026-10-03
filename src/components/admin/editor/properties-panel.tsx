"use client";

/**
 * لوحة الخصائص (اليمنى/الأخيرة) — عند تحديد عقدة:
 * - ترويسة بمسار العقدة من الجذر (breadcrumb قابل للنقر للانتقال للأسلاف)
 *   مع تكرار/حذف، وتبويبان: المحتوى (نموذج خصائص عام من سجل الحقول) والمظهر.
 * - المظهر: نظام الأنماط المدرك للأجهزة — تبويب «الأساس» + تجاوزات
 *   جوال/تابلت/حاسوب بوراثة صريحة (effectiveValue/resetDeviceValue من style.ts)،
 *   وأنماط جاهزة (STYLE_PRESETS) تطبق على العقدة المحددة فقط.
 * - للكتل الورقية: خلفية/حشوة على الأساس (سلوك التوافق مع الكتل في الجذر).
 */
import { ClipboardCopy, Copy, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getPortalContent } from "@/content/portal";
import {
  BACKGROUND_TOKENS,
  BORDER_WIDTH_TOKENS,
  GAP_TOKENS,
  RADIUS_TOKENS,
  SHADOW_TOKENS,
  SPACE_TOKENS,
  effectiveValue,
  presetsForKind,
  resetDeviceValue,
  type NodeStyle,
  type StyleSlot,
} from "@/lib/blocks/style";
import { BLOCK_REGISTRY, isContainerType, type ContentNode } from "@/lib/blocks/tree";
import type { Locale } from "@/lib/i18n";
import type { Me } from "@/components/admin/types";
import { bi, type Bi } from "./types";
import { cn } from "@/lib/utils";
import { PROP_FIELDS } from "./prop-fields";
import { PropFieldsForm } from "./props-form";

type DeviceTab = "base" | "mobile" | "tablet" | "desktop";

interface PropertiesPanelProps {
  node: ContentNode;
  /** المسار من الجذر حتى العقدة المحددة (شاملًا إياها) — للـbreadcrumb */
  path: ContentNode[];
  locale: Locale;
  me: Me;
  onPropsChange: (id: string, props: Record<string, unknown>) => void;
  onStyleChange: (id: string, style: NodeStyle) => void;
  onVisibilityChange: (id: string, key: "mobile" | "tablet" | "desktop", value: boolean) => void;
  onAnchorChange: (id: string, anchorId: string | undefined) => void;
  onSelectNode: (id: string) => void;
  onDuplicate: (id: string) => void;
  onCopy: (id: string) => void;
  onDelete: (id: string) => void;
}

// ─── تسميات التوكنز (أداة تحرير داخلية — ثنائية اللغة inline) ───

const L = (ar: string, en: string): Bi => ({ ar, en });

const BACKGROUND_LABELS: Record<(typeof BACKGROUND_TOKENS)[number], Bi> = {
  default: L("افتراضي", "Default"),
  white: L("أبيض", "White"),
  accent: L("لمسة", "Accent"),
  navy: L("كحلي", "Navy"),
  soft: L("ناعم", "Soft"),
  muted: L("هادئ", "Muted"),
};

const BACKGROUND_SWATCH: Record<(typeof BACKGROUND_TOKENS)[number], string> = {
  default: "bg-transparent border border-dashed border-border",
  white: "bg-white border border-border",
  accent: "bg-accent/60 border border-border",
  navy: "bg-navy border border-navy",
  soft: "bg-brand-soft/40 border border-border",
  muted: "bg-muted border border-border",
};

const SPACE_LABELS: Record<(typeof SPACE_TOKENS)[number], Bi> = {
  none: L("بلا", "None"),
  xs: L("ضئيل", "Extra small"),
  sm: L("صغير", "Small"),
  md: L("متوسط", "Medium"),
  lg: L("كبير", "Large"),
  xl: L("كبير جدًا", "Extra large"),
};

const RADIUS_LABELS: Record<(typeof RADIUS_TOKENS)[number], Bi> = {
  none: L("بلا", "None"),
  sm: L("صغير", "Small"),
  md: L("متوسط", "Medium"),
  lg: L("كبير", "Large"),
  xl: L("كبير جدًا", "Extra large"),
  full: L("دائري", "Full"),
};

const SHADOW_LABELS: Record<(typeof SHADOW_TOKENS)[number], Bi> = {
  none: L("بلا", "None"),
  sm: L("خفيف", "Small"),
  md: L("متوسط", "Medium"),
  lg: L("بارز", "Large"),
};

const BORDER_LABELS: Record<(typeof BORDER_WIDTH_TOKENS)[number], Bi> = {
  none: L("بلا", "None"),
  thin: L("رفيع", "Thin"),
  md: L("سميك", "Thick"),
};

const GAP_LABELS: Record<(typeof GAP_TOKENS)[number], Bi> = {
  xs: L("ضئيل", "Extra small"),
  sm: L("صغير", "Small"),
  md: L("متوسط", "Medium"),
  lg: L("كبير", "Large"),
};

const ALIGN_LABELS: Record<"start" | "center", Bi> = {
  start: L("بداية", "Start"),
  center: L("وسط", "Center"),
};

/** خيارات جاهزة للانتقاء بلغة الواجهة */
function tokenOptions(
  tokens: readonly string[],
  labels: Record<string, Bi>,
  locale: Locale,
  dots?: Record<string, string>
): { value: string; label: string; dot?: string }[] {
  return tokens.map((v) => ({
    value: v,
    label: bi(labels[v], locale),
    dot: dots?.[v],
  }));
}

/** تطبيق قيمة على فتحة جهاز (أو حذفها) — يعيد NodeStyle جديدًا */
function setDeviceValue(
  style: NodeStyle | undefined,
  device: DeviceTab,
  key: keyof StyleSlot,
  value: string | undefined
): NodeStyle {
  const next: NodeStyle = { ...style };
  const slot = { ...(style?.[device] ?? {}) } as Record<string, unknown>;
  if (value === undefined) delete slot[key];
  else slot[key] = value;
  next[device] = Object.keys(slot).length ? (slot as StyleSlot) : undefined;
  return next;
}

function nodeLabel(type: ContentNode["type"], locale: Locale): string {
  const def = BLOCK_REGISTRY[type];
  return locale === "en" ? def.en : def.ar;
}

// ─── اختيار فتحة نمط واحدة (مع شارة الوراثة وزر الإعادة) ───

interface SlotSelectProps {
  id: string;
  label: string;
  node: ContentNode;
  style: NodeStyle | undefined;
  device: DeviceTab;
  slotKey: keyof StyleSlot;
  options: { value: string; label: string; dot?: string }[];
  emptyLabel: string;
  locale: Locale;
  onStyleChange: (id: string, style: NodeStyle) => void;
}

function SlotSelect({
  id,
  label,
  node,
  style,
  device,
  slotKey,
  options,
  emptyLabel,
  locale,
  onStyleChange,
}: SlotSelectProps) {
  const te = getPortalContent(locale).admin.editor;
  const isBase = device === "base";
  const override = style?.[device]?.[slotKey] as string | undefined;
  const effective = isBase
    ? { value: (style?.base?.[slotKey] as string | undefined), inherited: false }
    : effectiveValue(style, device, slotKey);
  const current = effective.value as string | undefined;
  const inherited = !isBase && override === undefined;
  const hasOverride = override !== undefined;

  const currentOption = options.find((o) => o.value === current);

  return (
    <div className="space-y-1">
      <div className="flex min-h-5 items-center gap-1.5">
        <Label htmlFor={id} className="text-xs font-semibold text-navy">
          {label}
        </Label>
        {inherited && (
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] leading-4 text-muted-foreground">
            {te.inherited}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <Select
          value={current ?? "__unset__"}
          onValueChange={(v) =>
            onStyleChange(node.id, setDeviceValue(style, device, slotKey, v === "__unset__" ? undefined : v))
          }
        >
          <SelectTrigger id={id} className="min-h-9 w-full flex-1">
            <SelectValue placeholder="—" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__unset__">
              <span className="text-muted-foreground">— {emptyLabel} —</span>
            </SelectItem>
            {options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                <span className="flex items-center gap-2">
                  {opt.dot && (
                    <span className={cn("inline-block size-3 shrink-0 rounded-full", opt.dot)} aria-hidden="true" />
                  )}
                  {opt.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(hasOverride || (isBase && current !== undefined)) && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            onClick={() =>
              onStyleChange(
                node.id,
                isBase ? setDeviceValue(style, "base", slotKey, undefined) : resetDeviceValue(style, device, slotKey)
              )
            }
            title={te.reset}
            aria-label={te.reset}
          >
            <RotateCcw className="size-3.5" aria-hidden="true" />
          </Button>
        )}
      </div>
      {inherited && currentOption && (
        <p className="text-[10px] leading-4 text-muted-foreground">{currentOption.label}</p>
      )}
    </div>
  );
}

// ─── محرر المظهر حسب الجهاز ───

interface AppearanceEditorProps {
  node: ContentNode;
  locale: Locale;
  onStyleChange: (id: string, style: NodeStyle) => void;
}

function AppearanceEditor({ node, locale, onStyleChange }: AppearanceEditorProps) {
  const t = getPortalContent(locale);
  const te = t.admin.editor;
  const style = node.style;
  const isContainer = isContainerType(node.type);
  const [device, setDevice] = useState<DeviceTab>("base");

  const backgroundOptions = tokenOptions(BACKGROUND_TOKENS, BACKGROUND_LABELS, locale, BACKGROUND_SWATCH);
  const spaceOptions = tokenOptions(SPACE_TOKENS, SPACE_LABELS, locale);
  const radiusOptions = tokenOptions(RADIUS_TOKENS, RADIUS_LABELS, locale);
  const shadowOptions = tokenOptions(SHADOW_TOKENS, SHADOW_LABELS, locale);
  const borderOptions = tokenOptions(BORDER_WIDTH_TOKENS, BORDER_LABELS, locale);
  const gapOptions = tokenOptions(GAP_TOKENS, GAP_LABELS, locale);
  const alignOptions = tokenOptions(["start", "center"], ALIGN_LABELS, locale);

  // الأنماط الجاهزة — لنوع الحاوية المطابق فقط (row بلا قوالب)
  const presetKind =
    node.type === "section" ? "section" : node.type === "container" ? "container" : node.type === "column" ? "column" : null;
  const presets = presetKind ? presetsForKind(presetKind) : [];

  const applyPreset = (base: StyleSlot) => {
    onStyleChange(node.id, { ...style, base: { ...(style?.base ?? {}), ...base } });
  };

  const deviceTabs: { key: DeviceTab; label: string }[] = [
    { key: "base", label: te.deviceBase },
    { key: "mobile", label: te.deviceMobile },
    { key: "tablet", label: te.deviceTablet },
    { key: "desktop", label: te.deviceDesktop },
  ];

  const slotBase = { node, style, device, locale, onStyleChange } as const;

  return (
    <div className="space-y-3 rounded-xl border border-border p-3">
      <p className="text-xs font-bold text-navy">{te.appearance}</p>

      {/* تبويبات الأجهزة — للحاويات فقط؛ الكتل الورقية تحرر الأساس مباشرة */}
      {isContainer && (
        <div className="grid grid-cols-4 gap-0.5 rounded-xl bg-muted/60 p-1" role="group" aria-label={te.appearance}>
          {deviceTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setDevice(tab.key)}
              aria-pressed={device === tab.key}
              className={cn(
                "min-h-7 cursor-pointer rounded-lg px-1 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                device === tab.key ? "bg-white text-navy shadow-sm" : "text-muted-foreground hover:text-navy"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {isContainer ? (
        <div className="space-y-2.5">
          <SlotSelect
            {...slotBase}
            id={`st-background-${node.id}`}
            label={te.background}
            slotKey="background"
            options={backgroundOptions}
            emptyLabel={bi(BACKGROUND_LABELS.default, locale)}
          />
          <div className="grid grid-cols-2 gap-2">
            <SlotSelect {...slotBase} id={`st-py-${node.id}`} label={te.padding} slotKey="paddingY" options={spaceOptions} emptyLabel={bi(SPACE_LABELS.none, locale)} />
            <SlotSelect {...slotBase} id={`st-px-${node.id}`} label={bi(L("حشوة جانبية", "Side padding"), locale)} slotKey="paddingX" options={spaceOptions} emptyLabel={bi(SPACE_LABELS.none, locale)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <SlotSelect {...slotBase} id={`st-my-${node.id}`} label={bi(L("تباعد خارجي", "Outer margin"), locale)} slotKey="marginY" options={spaceOptions} emptyLabel={bi(SPACE_LABELS.none, locale)} />
            <SlotSelect {...slotBase} id={`st-radius-${node.id}`} label={bi(L("الزوايا", "Radius"), locale)} slotKey="radius" options={radiusOptions} emptyLabel={bi(RADIUS_LABELS.none, locale)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <SlotSelect {...slotBase} id={`st-shadow-${node.id}`} label={bi(L("الظل", "Shadow"), locale)} slotKey="shadow" options={shadowOptions} emptyLabel={bi(SHADOW_LABELS.none, locale)} />
            <SlotSelect {...slotBase} id={`st-border-${node.id}`} label={bi(L("الحدود", "Border"), locale)} slotKey="borderWidth" options={borderOptions} emptyLabel={bi(BORDER_LABELS.none, locale)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <SlotSelect {...slotBase} id={`st-gap-${node.id}`} label={bi(L("تباعد الأبناء", "Children gap"), locale)} slotKey="gap" options={gapOptions} emptyLabel={bi(GAP_LABELS.xs, locale)} />
            <SlotSelect {...slotBase} id={`st-align-${node.id}`} label={bi(L("محاذاة المحتوى", "Content align"), locale)} slotKey="contentAlign" options={alignOptions} emptyLabel={bi(ALIGN_LABELS.start, locale)} />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <SlotSelect
            {...slotBase}
            device="base"
            id={`st-background-${node.id}`}
            label={te.background}
            slotKey="background"
            options={backgroundOptions}
            emptyLabel={bi(BACKGROUND_LABELS.default, locale)}
          />
          <SlotSelect
            {...slotBase}
            device="base"
            id={`st-padding-${node.id}`}
            label={te.padding}
            slotKey="paddingY"
            options={spaceOptions}
            emptyLabel={bi(SPACE_LABELS.md, locale)}
          />
        </div>
      )}

      {/* الأنماط الجاهزة */}
      {presets.length > 0 && (
        <div className="space-y-1.5 border-t border-border pt-2.5">
          <p className="text-xs font-semibold text-navy">{te.presets}</p>
          <div className="flex flex-wrap gap-1.5">
            {presets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset.base)}
                title={locale === "en" ? preset.en : preset.ar}
                className="cursor-pointer rounded-full border border-border/70 bg-white px-2.5 py-1 text-[11px] font-medium text-navy transition-colors hover:border-brand hover:bg-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                {locale === "en" ? preset.en : preset.ar}
              </button>
            ))}
          </div>
          <p className="text-[11px] leading-4 text-muted-foreground">{te.presetScopeNote}</p>
        </div>
      )}
    </div>
  );
}

// ─── اللوحة ───

export function PropertiesPanel({
  node,
  path,
  locale,
  me,
  onPropsChange,
  onStyleChange,
  onVisibilityChange,
  onAnchorChange,
  onSelectNode,
  onDuplicate,
  onCopy,
  onDelete,
}: PropertiesPanelProps) {
  const t = getPortalContent(locale);
  const te = t.admin.editor;

  const fields = PROP_FIELDS[node.type];
  const visibility = node.visibility ?? { mobile: true, tablet: true, desktop: true };

  return (
    <div className="flex h-full flex-col">
      {/* الترويسة — مسار العقدة + الإجراءات */}
      <div className="border-b border-border px-3 py-2.5">
        <nav
          aria-label={te.pageRoot}
          className="mb-1.5 flex items-center gap-0.5 overflow-x-auto whitespace-nowrap text-[11px] leading-5"
          dir={locale === "ar" ? "rtl" : "ltr"}
        >
          <span className="shrink-0 font-semibold text-muted-foreground">{te.pageRoot}:</span>
          {path.map((p, i) => {
            const isLast = i === path.length - 1;
            return (
              <span key={p.id} className="flex shrink-0 items-center gap-0.5">
                {i > 0 && <ChevronSep locale={locale} />}
                {isLast ? (
                  <span className="font-bold text-navy">{nodeLabel(p.type, locale)}</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onSelectNode(p.id)}
                    className="cursor-pointer rounded text-muted-foreground underline-offset-2 transition-colors hover:text-brand-strong hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  >
                    {nodeLabel(p.type, locale)}
                  </button>
                )}
              </span>
            );
          })}
        </nav>
        <div className="flex items-center gap-2">
          <p className="min-w-0 flex-1 truncate text-sm font-bold text-navy" title={nodeLabel(node.type, locale)}>
            {te.selectedBlock}: {nodeLabel(node.type, locale)}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            onClick={() => onCopy(node.id)}
            title={te.copyToClipboard}
            aria-label={te.copyToClipboard}
          >
            <ClipboardCopy className="size-4" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            onClick={() => onDuplicate(node.id)}
            title={te.duplicate}
            aria-label={te.duplicate}
          >
            <Copy className="size-4" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 text-destructive hover:bg-red-50 hover:text-destructive"
            onClick={() => onDelete(node.id)}
            title={te.delete}
            aria-label={te.delete}
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      <Tabs defaultValue="content" className="flex min-h-0 flex-1 flex-col">
        <TabsList className="mx-3 mt-3 grid h-9 grid-cols-2">
          <TabsTrigger value="content" className="text-xs">
            {te.properties}
          </TabsTrigger>
          <TabsTrigger value="style" className="text-xs">
            {te.style}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="content" className="mt-3 min-h-0 flex-1">
          <ScrollArea className="h-full">
            <div className="px-3 pb-6">
              {fields.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                  {nodeLabel(node.type, locale)}
                </p>
              ) : (
                <PropFieldsForm
                  fields={fields}
                  value={node.props ?? {}}
                  onChange={(next) => onPropsChange(node.id, next)}
                  locale={locale}
                  me={me}
                />
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="style" className="mt-3 min-h-0 flex-1">
          <ScrollArea className="h-full">
            <div className="space-y-4 px-3 pb-6">
              {/* المظهر حسب الجهاز — key=node.id يعيد ضبط تبويب الجهاز عند تغيير التحديد */}
              <AppearanceEditor key={node.id} node={node} locale={locale} onStyleChange={onStyleChange} />

              {/* رؤية الأجهزة */}
              <div className="space-y-2 rounded-xl border border-border p-3">
                <p className="text-xs font-semibold text-navy">{t.admin.pages.visibility}</p>
                {(
                  [
                    { key: "mobile", label: te.deviceMobile, hint: te.hiddenOnMobile },
                    { key: "tablet", label: te.deviceTablet, hint: te.hiddenOnTablet },
                    { key: "desktop", label: te.deviceDesktop, hint: te.hiddenOnDesktop },
                  ] as const
                ).map((row) => (
                  <div key={row.key} className="flex items-center justify-between gap-3">
                    <Label htmlFor={`pp-vis-${row.key}`} className="text-xs font-medium text-foreground" title={row.hint}>
                      {row.label}
                    </Label>
                    <Switch
                      id={`pp-vis-${row.key}`}
                      checked={visibility[row.key] !== false}
                      onCheckedChange={(v) => onVisibilityChange(node.id, row.key, v)}
                    />
                  </div>
                ))}
              </div>

              {/* معرف المرساة */}
              <div className="space-y-1.5">
                <Label htmlFor="pp-anchor" className="text-xs font-semibold text-navy">
                  # anchor
                </Label>
                <Input
                  id="pp-anchor"
                  value={node.anchorId ?? ""}
                  onChange={(e) => onAnchorChange(node.id, e.target.value === "" ? undefined : e.target.value)}
                  placeholder="section-id"
                  dir="ltr"
                  className="min-h-9 font-mono text-xs"
                />
                <p className={cn("text-[11px] leading-5 text-muted-foreground", node.anchorId && !/^[a-zA-Z][\w-]{0,60}$/.test(node.anchorId) && "text-destructive")}>
                  a-z A-Z 0-9 _ -
                </p>
              </div>
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/** فاصل مسار باتجاه الواجهة الصحيح */
function ChevronSep({ locale }: { locale: Locale }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn("size-3 shrink-0 text-border", locale === "ar" ? "rotate-180" : "")}
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
