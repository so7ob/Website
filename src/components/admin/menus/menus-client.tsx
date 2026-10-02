"use client";

/**
 * محرر القوائم: تبويب الموقع (ترويسة/تذييل)، صفوف قابلة للتحرير والإضافة
 * والترتيب (أعلى/أسفل)، نوع الرابط صفحة محتوى أو رابط مخصص، مع حفظ كامل
 * للموقع المحدد (الترتيب = ترتيب المصفوفة).
 */
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, ChevronUp, ChevronDown, Save, Loader2, RotateCcw, ListTree } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { getPortalContent } from "@/content/portal";
import type { Locale } from "@/lib/i18n";
import { EmptyState } from "@/components/admin/empty-state";
import { apiGet, apiSend, ApiError, apiErrorMessage } from "@/components/admin/helpers";
import type { Me, MenuItemRow, MenusResponse, PageOption } from "../types";

type Location = "header" | "footer";
type LinkType = "page" | "url";

interface EditableItem {
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

  /** "/" = الصفحة الرئيسية (slug فارغ في قاعدة البيانات) — قيمة وسيطة للواجهة فقط */
  const slugToValue = (slug: string | null) => (slug === null || slug === undefined ? null : slug || "/");
  const valueToSlug = (v: string) => v;

  const toEditable = (rows: MenuItemRow[]): EditableItem[] =>
    rows.map((row) => ({
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
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const addItem = () => {
    setItems((prev) => {
      if (prev.length >= MAX_ITEMS) return prev;
      return [...prev, { labelAr: "", labelEn: "", url: "", pageSlug: null, enabled: true, linkType: "page" }];
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

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-white">
          <EmptyState icon={ListTree} title={t.admin.dashboard.noData} />
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((item, index) => (
            <li key={index} className="rounded-xl border border-border/70 bg-white p-4 transition-colors hover:bg-muted/50">
              <div className="mb-3 flex items-center gap-2" aria-hidden="true">
                <span className="font-mono text-xs tabular-nums text-muted-foreground">{index + 1}</span>
                <span className="h-px flex-1 bg-border/60" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor={`label-ar-${index}`} className="text-xs text-muted-foreground">{tm.labelAr}</Label>
                  <Input
                    id={`label-ar-${index}`}
                    value={item.labelAr}
                    onChange={(e) => updateItem(index, { labelAr: e.target.value })}
                    maxLength={120}
                    dir="rtl"
                    className="min-h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`label-en-${index}`} className="text-xs text-muted-foreground">{tm.labelEn}</Label>
                  <Input
                    id={`label-en-${index}`}
                    value={item.labelEn}
                    onChange={(e) => updateItem(index, { labelEn: e.target.value })}
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
                  onValueChange={(v) => updateItem(index, { linkType: v as LinkType })}
                  className="flex flex-wrap gap-4"
                >
                  <div className="flex min-h-11 items-center gap-2">
                    <RadioGroupItem value="page" id={`link-page-${index}`} />
                    <Label htmlFor={`link-page-${index}`} className="cursor-pointer font-normal">{tm.pageLink}</Label>
                  </div>
                  <div className="flex min-h-11 items-center gap-2">
                    <RadioGroupItem value="url" id={`link-url-${index}`} />
                    <Label htmlFor={`link-url-${index}`} className="cursor-pointer font-normal">{tm.customUrl}</Label>
                  </div>
                </RadioGroup>
              </div>

              {item.linkType === "page" ? (
                <div className="mt-2 space-y-1.5">
                  <Label htmlFor={`page-slug-${index}`} className="text-xs text-muted-foreground">{tm.pageLink}</Label>
                  <Select
                    value={item.pageSlug ?? undefined}
                    onValueChange={(v) => updateItem(index, { pageSlug: valueToSlug(v) })}
                  >
                    <SelectTrigger id={`page-slug-${index}`} className="min-h-11 focus-visible:ring-2 focus-visible:ring-ring/40">
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
                  <Label htmlFor={`url-${index}`} className="text-xs text-muted-foreground">{tm.customUrl}</Label>
                  <Input
                    id={`url-${index}`}
                    value={item.url}
                    onChange={(e) => updateItem(index, { url: e.target.value })}
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
                    id={`enabled-${index}`}
                    checked={item.enabled}
                    onCheckedChange={(checked) => updateItem(index, { enabled: checked })}
                  />
                  <Label htmlFor={`enabled-${index}`} className="cursor-pointer text-xs text-muted-foreground">{tm.enabled}</Label>
                </div>
                <div className="ms-auto flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-10"
                    disabled={index === 0}
                    onClick={() => moveItem(index, -1)}
                    aria-label={t.admin.editor.moveUp}
                  >
                    <ChevronUp className="size-4" aria-hidden="true" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-10"
                    disabled={index === items.length - 1}
                    onClick={() => moveItem(index, 1)}
                    aria-label={t.admin.editor.moveDown}
                  >
                    <ChevronDown className="size-4" aria-hidden="true" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-10 text-destructive hover:text-destructive"
                    onClick={() => removeItem(index)}
                    aria-label={tm.remove}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Button variant="outline" onClick={addItem} disabled={items.length >= MAX_ITEMS} className="min-h-11 rounded-full">
        <Plus className="size-4" aria-hidden="true" />
        {tm.add}
      </Button>
    </div>
  );
}
