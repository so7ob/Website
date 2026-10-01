"use client";

/**
 * لوحة الخصائص (اليمنى/الأخيرة) — عند تحديد كتلة: ترويسة باسم النوع
 * مع تكرار/حذف، وتبويبان: المحتوى (نموذج خصائص عام من سجل الحقول)
 * والمظهر (خلفية، حشوة عمودية، رؤية الأجهزة، معرف مرساة).
 */
import { Copy, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getPortalContent } from "@/content/portal";
import { BLOCK_LIBRARY, type Block, type BlockType } from "@/lib/blocks/types";
import type { Locale } from "@/lib/i18n";
import type { Me } from "@/components/admin/types";
import { cn } from "@/lib/utils";
import { PROP_FIELDS } from "./prop-fields";
import { PropFieldsForm } from "./props-form";

interface PropertiesPanelProps {
  block: Block;
  locale: Locale;
  me: Me;
  onPropsChange: (id: string, props: Record<string, unknown>) => void;
  onStyleChange: (id: string, patch: Partial<NonNullable<Block["style"]>>) => void;
  onVisibilityChange: (id: string, key: "mobile" | "tablet" | "desktop", value: boolean) => void;
  onAnchorChange: (id: string, anchorId: string | undefined) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}

const BACKGROUND_OPTIONS: { value: string; ar: string; en: string }[] = [
  { value: "default", ar: "افتراضي", en: "Default" },
  { value: "white", ar: "أبيض", en: "White" },
  { value: "accent", ar: "لمسة", en: "Accent" },
  { value: "navy", ar: "كحلي", en: "Navy" },
  { value: "soft", ar: "ناعم", en: "Soft" },
];

const PADDING_OPTIONS: { value: string; ar: string; en: string }[] = [
  { value: "none", ar: "بلا", en: "None" },
  { value: "sm", ar: "صغيرة", en: "Small" },
  { value: "md", ar: "متوسطة", en: "Medium" },
  { value: "lg", ar: "كبيرة", en: "Large" },
];

function blockLabel(type: BlockType, locale: Locale): string {
  const entry = BLOCK_LIBRARY.find((e) => e.type === type);
  return entry ? (locale === "en" ? entry.en : entry.ar) : type;
}

export function PropertiesPanel({
  block,
  locale,
  me,
  onPropsChange,
  onStyleChange,
  onVisibilityChange,
  onAnchorChange,
  onDuplicate,
  onDelete,
}: PropertiesPanelProps) {
  const t = getPortalContent(locale);
  const te = t.admin.editor;

  const fields = PROP_FIELDS[block.type];
  const style = block.style ?? {};
  const visibility = block.visibility ?? { mobile: true, tablet: true, desktop: true };

  return (
    <div className="flex h-full flex-col">
      {/* الترويسة */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
        <p className="min-w-0 flex-1 truncate text-sm font-bold text-navy" title={blockLabel(block.type, locale)}>
          {te.selectedBlock}: {blockLabel(block.type, locale)}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          onClick={() => onDuplicate(block.id)}
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
          onClick={() => onDelete(block.id)}
          title={te.delete}
          aria-label={te.delete}
        >
          <Trash2 className="size-4" aria-hidden="true" />
        </Button>
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
                  {blockLabel(block.type, locale)}
                </p>
              ) : (
                <PropFieldsForm
                  fields={fields}
                  value={block.props}
                  onChange={(next) => onPropsChange(block.id, next)}
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
              {/* الخلفية */}
              <div className="space-y-1.5">
                <Label htmlFor="pp-background" className="text-xs font-semibold text-navy">
                  {te.background}
                </Label>
                <Select
                  value={style.background ?? "default"}
                  onValueChange={(v) => onStyleChange(block.id, { background: v })}
                >
                  <SelectTrigger id="pp-background" className="min-h-9 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BACKGROUND_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {locale === "en" ? opt.en : opt.ar}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* الحشوة العمودية */}
              <div className="space-y-1.5">
                <Label htmlFor="pp-padding" className="text-xs font-semibold text-navy">
                  {te.padding}
                </Label>
                <Select
                  value={style.paddingY ?? "md"}
                  onValueChange={(v) => onStyleChange(block.id, { paddingY: v })}
                >
                  <SelectTrigger id="pp-padding" className="min-h-9 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PADDING_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {locale === "en" ? opt.en : opt.ar}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

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
                      onCheckedChange={(v) => onVisibilityChange(block.id, row.key, v)}
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
                  value={block.anchorId ?? ""}
                  onChange={(e) => onAnchorChange(block.id, e.target.value === "" ? undefined : e.target.value)}
                  placeholder="section-id"
                  dir="ltr"
                  className="min-h-9 font-mono text-xs"
                />
                <p className={cn("text-[11px] leading-5 text-muted-foreground", block.anchorId && !/^[a-zA-Z][\w-]{0,60}$/.test(block.anchorId) && "text-destructive")}>
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
