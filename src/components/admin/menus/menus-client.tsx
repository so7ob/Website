"use client";

/**
 * محرر القوائم 2.0: تبويب الموقع (ترويسة/تذييل)، صفوف قابلة للتحرير والإضافة
 * والترتيب — **بالسحب والإفلات (dnd-kit)** مع إتاحة كاملة بلوحة المفاتيح
 * (الأزرار أعلى/أسفل تبقى بديلًا)، ومعاينة حية جانبية تعرض القائمة كما ستظهر
 * في الموقع وتتحدث فوريًا مع كل تعديل. الحفظ كامل للموقع المحدد
 * (الترتيب = ترتيب المصفوفة) — بلا أي تغيير باكند.
 */
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Plus, Trash2, ChevronUp, ChevronDown, Save, Loader2, RotateCcw, ListTree,
  GripVertical, MonitorSmartphone, Eye,
} from "lucide-react";
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor,
  closestCenter, useSensor, useSensors, type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext, arrayMove, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { getPortalContent } from "@/content/portal";
import { siteConfig } from "@/config/site";
import type { Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/admin/empty-state";
import { apiGet, apiSend, ApiError, apiErrorMessage } from "@/components/admin/helpers";
import type { Me, MenuItemRow, MenusResponse, PageOption } from "../types";

type Location = "header" | "footer";
type LinkType = "page" | "url";

interface EditableItem {
  /** معرف مستقر محلي — أساس فرز dnd-kit (لا يُرسل للخادم) */
  id: string;
  labelAr: string;
  labelEn: string;
  url: string;
  pageSlug: string | null;
  enabled: boolean;
  linkType: LinkType;
}

interface MenusClientProps {
  me: Me;
  locale: Locale;
}

const MAX_ITEMS = 12;

/** معرفات مستقرة محلية بلا تبعية خارجية */
let uidCounter = 0;
const uid = () => `m-${Date.now().toString(36)}-${(uidCounter++).toString(36)}`;

export function MenusClient({ me, locale }: MenusClientProps) {
  const t = getPortalContent(locale);
  const tm = t.admin.menus;

  const [location, setLocation] = useState<Location>("header");
  const [headerItems, setHeaderItems] = useState<EditableItem[]>([]);
  const [footerItems, setFooterItems] = useState<EditableItem[]>([]);
  const [pages, setPages] = useState<PageOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  /** "/" = الصفحة الرئيسية (slug فارغ في قاعدة البيانات) — قيمة وسيطة للواجهة فقط */
  const slugToValue = (slug: string | null) => (slug === null || slug === undefined ? null : slug || "/");
  const valueToSlug = (v: string) => v;

  const toEditable = (rows: MenuItemRow[]): EditableItem[] =>
    rows.map((row) => ({
      id: uid(),
      labelAr: row.labelAr,
      labelEn: row.labelEn,
      url: row.url ?? "",
      pageSlug: slugToValue(row.pageSlug),
      enabled: row.enabled,
      linkType: row.pageSlug !== null ? "page" : "url",
    }));

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<MenusResponse>("/api/admin/menus");
      setHeaderItems(toEditable(res.header));
      setFooterItems(toEditable(res.footer));
      setPages(res.pages);
    } catch (err) {
      if (err instanceof ApiError) setError(apiErrorMessage(err, t.auth.errors));
    } finally {
      setLoading(false);
    }
  }, [t.auth.errors]);

  useEffect(() => {
    void load();
  }, [load]);

  const items = location === "header" ? headerItems : footerItems;
  const setItems = (updater: (prev: EditableItem[]) => EditableItem[]) => {
    if (location === "header") setHeaderItems((prev) => updater(prev));
    else setFooterItems((prev) => updater(prev));
  };

  const updateItem = (index: number, patch: Partial<EditableItem>) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const moveItem = (index: number, direction: -1 | 1) => {
    setItems((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      return arrayMove(prev, index, target);
    });
  };

  const addItem = () => {
    setItems((prev) => {
      if (prev.length >= MAX_ITEMS) return prev;
      return [...prev, { id: uid(), labelAr: "", labelEn: "", url: "", pageSlug: null, enabled: true, linkType: "page" }];
    });
  };

  const onDragStart = (event: DragStartEvent) => setActiveId(String(event.active.id));

  const onDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setItems((prev) => {
      const from = prev.findIndex((item) => item.id === active.id);
      const to = prev.findIndex((item) => item.id === over.id);
      if (from === -1 || to === -1) return prev;
      return arrayMove(prev, from, to);
    });
  };

  const save = async () => {
    // تحقق محلي قبل الإرسال — القرار النهائي في الخادم
    const clean = items.filter((item) => item.labelAr.trim() || item.labelEn.trim());
    if (clean.length === 0) {
      toast.error(t.auth.errors.required);
      return;
    }
    for (const item of clean) {
      if (item.linkType === "page" && !item.pageSlug) {
        toast.error(tm.pagesPlaceholder);
        return;
      }
      if (item.linkType === "url" && !item.url.trim()) {
        toast.error(t.auth.errors.required);
        return;
      }
    }
    setSaving(true);
    try {
      await apiSend("/api/admin/menus", "PUT", {
        location,
        items: clean.map((item) => ({
          labelAr: item.labelAr,
          labelEn: item.labelEn,
          url: item.linkType === "url" ? item.url.trim() : undefined,
          pageSlug: item.linkType === "page" ? item.pageSlug : undefined,
          enabled: item.enabled,
        })),
      });
      toast.success(tm.saved);
      await load();
    } catch (err) {
      toast.error(apiErrorMessage(err, t.auth.errors));
    } finally {
      setSaving(false);
    }
  };

  const pageTitle = (page: PageOption) =>
    `${locale === "en" ? page.titleEn : page.titleAr} (${page.slug === "" ? "/" : page.slug})`;

  /** تسمية العنصر كما ستظهر في الموقع — بالتسمية حسب لغة اللوحة الحالية */
  const itemLabel = (item: EditableItem) => (locale === "en" ? item.labelEn : item.labelAr) || item.labelAr || item.labelEn;

  const activeItem = activeId ? items.find((item) => item.id === activeId) ?? null : null;
  const previewItems = items.filter((item) => item.enabled && (item.labelAr.trim() || item.labelEn.trim()));

  if (loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-40 rounded-xl" />
        <Skeleton className="h-11 w-64 rounded-full" />
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-32 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy">{tm.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{tm.subtitle}</p>
        </div>
        <Button onClick={save} disabled={saving} className="min-h-11 rounded-full">
          {saving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}
          {tm.save}
        </Button>
      </div>

      {error ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="icon" onClick={load} className="size-10 shrink-0" aria-label={tm.title}>
            <RotateCcw className="size-4" aria-hidden="true" />
          </Button>
        </div>
      ) : null}

      <Tabs value={location} onValueChange={(v) => setLocation(v as Location)}>
        <TabsList className="h-auto w-max flex-wrap gap-1 rounded-full bg-muted/60 p-1">
          <TabsTrigger
            value="header"
            className="min-h-9 rounded-full px-4 text-sm font-medium transition-colors data-[state=inactive]:hover:bg-muted data-[state=active]:bg-navy data-[state=active]:text-white data-[state=active]:shadow-none"
          >
            {tm.header}
          </TabsTrigger>
          <TabsTrigger
            value="footer"
            className="min-h-9 rounded-full px-4 text-sm font-medium transition-colors data-[state=inactive]:hover:bg-muted data-[state=active]:bg-navy data-[state=active]:text-white data-[state=active]:shadow-none"
          >
            {tm.footer}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div>
          {items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-white">
              <EmptyState icon={ListTree} title={t.admin.dashboard.noData} />
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onDragCancel={() => setActiveId(null)}
            >
              <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
                <ul className="space-y-3">
                  {items.map((item, index) => (
                    <SortableRow
                      key={item.id}
                      item={item}
                      index={index}
                      total={items.length}
                      locale={locale}
                      tm={tm}
                      t={t}
                      pages={pages}
                      isDragging={activeId === item.id}
                      pageTitle={pageTitle}
                      onLabel={(patch) => updateItem(index, patch)}
                      onLinkType={(v) => updateItem(index, { linkType: v })}
                      onPage={(v) => updateItem(index, { pageSlug: valueToSlug(v) })}
                      onUrl={(v) => updateItem(index, { url: v })}
                      onEnabled={(checked) => updateItem(index, { enabled: checked })}
                      onRemove={() => removeItem(index)}
                      onMove={(d) => moveItem(index, d)}
                      isFirst={index === 0}
                      isLast={index === items.length - 1}
                    />
                  ))}
                </ul>
              </SortableContext>
              <DragOverlay>
                {activeItem ? (
                  <div className="flex items-center gap-2 rounded-xl border border-brand/40 bg-white p-3 shadow-lg shadow-navy/10">
                    <GripVertical className="size-4 text-brand" aria-hidden="true" />
                    <span className="text-sm font-medium text-navy">{itemLabel(activeItem) || "—"}</span>
                    <span className="ms-2 rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-brand-strong ltr-isolate" dir="ltr">
                      {activeItem.linkType === "page" ? activeItem.pageSlug || "/" : activeItem.url}
                    </span>
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          )}

          <Button variant="outline" onClick={addItem} disabled={items.length >= MAX_ITEMS} className="mt-4 min-h-11 rounded-full">
            <Plus className="size-4" aria-hidden="true" />
            {tm.add}
          </Button>
        </div>

        {/* المعاينة الحية — شكل مصغر للقائمة كما ستظهر في الموقع */}
        <aside
          aria-label={tm.previewTitle}
          className="rounded-2xl border border-border bg-white lg:sticky lg:top-24"
        >
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-brand-strong">
              <Eye className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-navy">{tm.previewTitle}</p>
              <p className="truncate text-[11px] text-muted-foreground">{tm.previewHint}</p>
            </div>
          </div>

          {/* إطار متصفح مصغر */}
          <div className="p-4">
            <div className="overflow-hidden rounded-xl border border-border bg-muted/40">
              <div className="flex items-center gap-1.5 border-b border-border bg-white px-3 py-2" aria-hidden="true">
                <span className="size-2 rounded-full bg-rose-300" />
                <span className="size-2 rounded-full bg-amber-300" />
                <span className="size-2 rounded-full bg-emerald-300" />
                <span className="ms-2 h-4 flex-1 rounded-full bg-muted" />
              </div>
              <div className="bg-white px-3 py-3">
                {previewItems.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">{tm.previewEmpty}</p>
                ) : (
                  <nav aria-hidden="true">
                    {location === "header" ? (
                      <ul className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                        <li className="me-1 flex items-center gap-1">
                          <span className="size-2.5 rounded-full bg-gradient-to-br from-brand to-skydrop" />
                          <span className="text-xs font-bold text-navy">{locale === "en" ? siteConfig.nameEn : siteConfig.nameAr}</span>
                        </li>
                        {previewItems.map((item) => (
                          <li key={item.id} className="text-xs text-muted-foreground transition-colors hover:text-brand">
                            {itemLabel(item)}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5 sm:grid-cols-3">
                        {previewItems.map((item) => (
                          <li key={item.id} className="truncate text-xs text-muted-foreground transition-colors hover:text-brand" title={itemLabel(item)}>
                            {itemLabel(item)}
                          </li>
                        ))}
                      </ul>
                    )}
                  </nav>
                )}
              </div>
            </div>
            <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-5 text-muted-foreground">
              <MonitorSmartphone className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              {tm.dragHint}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

// ─── صف قابل للسحب ───

interface SortableRowProps {
  item: EditableItem;
  index: number;
  total: number;
  locale: Locale;
  tm: ReturnType<typeof getPortalContent>["admin"]["menus"];
  t: ReturnType<typeof getPortalContent>;
  pages: PageOption[];
  isDragging: boolean;
  pageTitle: (page: PageOption) => string;
  onLabel: (patch: { labelAr?: string; labelEn?: string }) => void;
  onLinkType: (v: LinkType) => void;
  onPage: (v: string) => void;
  onUrl: (v: string) => void;
  onEnabled: (checked: boolean) => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
  isFirst: boolean;
  isLast: boolean;
}

function SortableRow({
  item, index, total, locale, tm, t, pages, isDragging, pageTitle,
  onLabel, onLinkType, onPage, onUrl, onEnabled, onRemove, onMove, isFirst, isLast,
}: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "rounded-xl border border-border/70 bg-white p-4 transition-colors hover:bg-muted/50",
        isDragging && "opacity-40",
        !item.enabled && "bg-muted/30"
      )}
    >
      <div className="mb-3 flex items-center gap-2">
        {/* مقبض السحب — لوحة مفاتيح ولمس وسحب */}
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-roledescription="sortable"
          aria-label={`${tm.dragHandle} — ${index + 1}/${total}`}
          title={tm.dragHandle}
          className="inline-flex size-9 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 active:cursor-grabbing"
        >
          <GripVertical className="size-4" aria-hidden="true" />
        </button>
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-bold tabular-nums text-brand-strong">
          {index + 1}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-navy">
          {(locale === "en" ? item.labelEn : item.labelAr) || item.labelAr || item.labelEn || "—"}
        </span>
        {!item.enabled && <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{tm.enabled}: ✕</span>}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`label-ar-${item.id}`} className="text-xs text-muted-foreground">{tm.labelAr}</Label>
          <Input
            id={`label-ar-${item.id}`}
            value={item.labelAr}
            onChange={(e) => onLabel({ labelAr: e.target.value })}
            maxLength={120}
            dir="rtl"
            className="min-h-11"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`label-en-${item.id}`} className="text-xs text-muted-foreground">{tm.labelEn}</Label>
          <Input
            id={`label-en-${item.id}`}
            value={item.labelEn}
            onChange={(e) => onLabel({ labelEn: e.target.value })}
            maxLength={120}
            dir="ltr"
            className="min-h-11"
          />
        </div>
      </div>

      <div className="mt-3 space-y-2">
        <Label className="text-xs text-muted-foreground">{tm.linkType}</Label>
        <RadioGroup
          value={item.linkType}
          onValueChange={(v) => onLinkType(v as LinkType)}
          className="flex flex-wrap gap-4"
        >
          <div className="flex min-h-11 items-center gap-2">
            <RadioGroupItem value="page" id={`link-page-${item.id}`} />
            <Label htmlFor={`link-page-${item.id}`} className="cursor-pointer font-normal">{tm.pageLink}</Label>
          </div>
          <div className="flex min-h-11 items-center gap-2">
            <RadioGroupItem value="url" id={`link-url-${item.id}`} />
            <Label htmlFor={`link-url-${item.id}`} className="cursor-pointer font-normal">{tm.customUrl}</Label>
          </div>
        </RadioGroup>
      </div>

      {item.linkType === "page" ? (
        <div className="mt-2 space-y-1.5">
          <Label htmlFor={`page-slug-${item.id}`} className="text-xs text-muted-foreground">{tm.pageLink}</Label>
          <Select
            value={item.pageSlug ?? undefined}
            onValueChange={(v) => onPage(v)}
          >
            <SelectTrigger id={`page-slug-${item.id}`} className="min-h-11 focus-visible:ring-2 focus-visible:ring-ring/40">
              <SelectValue placeholder={tm.pagesPlaceholder} />
            </SelectTrigger>
            <SelectContent>
              {pages.map((page) => (
                <SelectItem key={page.slug || "home"} value={page.slug || "/"}>
                  {pageTitle(page)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <div className="mt-2 space-y-1.5">
          <Label htmlFor={`url-${item.id}`} className="text-xs text-muted-foreground">{tm.customUrl}</Label>
          <Input
            id={`url-${item.id}`}
            value={item.url}
            onChange={(e) => onUrl(e.target.value)}
            maxLength={200}
            dir="ltr"
            className="min-h-11 ltr-isolate"
            placeholder="/ar/services"
          />
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <div className="flex items-center gap-2">
          <Switch
            id={`enabled-${item.id}`}
            checked={item.enabled}
            onCheckedChange={onEnabled}
          />
          <Label htmlFor={`enabled-${item.id}`} className="cursor-pointer text-xs text-muted-foreground">{tm.enabled}</Label>
        </div>
        <div className="ms-auto flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="size-10"
            disabled={isFirst}
            onClick={() => onMove(-1)}
            aria-label={t.admin.editor.moveUp}
          >
            <ChevronUp className="size-4" aria-hidden="true" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-10"
            disabled={isLast}
            onClick={() => onMove(1)}
            aria-label={t.admin.editor.moveDown}
          >
            <ChevronDown className="size-4" aria-hidden="true" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-10 text-destructive hover:text-destructive"
            onClick={onRemove}
            aria-label={tm.remove}
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </li>
  );
}
