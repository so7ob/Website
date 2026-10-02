"use client";

/**
 * حوار إعدادات الصفحة — يعدّل إعدادات المسودة العامة (العنوان الظاهر، المسار، الترتيب،
 * الظهور والأدوار، SEO لكل لغة). كل هذه الحقول لا تصل الزوار إلا عند النشر،
 * والحفظ بقفل مراجعة (baseRevision) — التعارض يفتح حوار التعارض في المحرر.
 * العنوان الإداري الداخلي يبقى حقلا منفصلًا (غير علني).
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Info, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getPortalContent } from "@/content/portal";
import { isValidSlug } from "@/lib/blocks/types";
import { SYSTEM_ROLES } from "@/lib/auth/permissions";
import type { Locale } from "@/lib/i18n";
import { apiErrorMessage, apiSend, ApiError } from "@/components/admin/helpers";
import { roleLabel } from "@/components/admin/badges";
import type { Me } from "@/components/admin/types";
import { cn } from "@/lib/utils";
import type { PageDetail, PatchPageResponse } from "./types";

interface PageSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  page: PageDetail;
  locale: Locale;
  me: Me;
  baseRevision: number; // مراجعة المسودة التي بنينا عليها
  onSaved: (patch: { slug?: string; draftSettings?: PageDetail["draftSettings"]; draftRevision: number }) => void;
  onConflict: () => void;
}

export function PageSettingsDialog({ open, onOpenChange, page, locale, me, baseRevision, onSaved, onConflict }: PageSettingsDialogProps) {
  const t = getPortalContent(locale);
  const tp = t.admin.pages;
  const te = t.admin.editor;
  const s = page.draftSettings;

  const [titleAr, setTitleAr] = useState(s.titleAr);
  const [titleEn, setTitleEn] = useState(s.titleEn);
  const [slug, setSlug] = useState(s.slug);
  const [order, setOrder] = useState(String(s.order));
  const [visibility, setVisibility] = useState(s.visibility);
  const [allowedRoles, setAllowedRoles] = useState<string[]>(s.allowedRoles);
  const [seoTitleAr, setSeoTitleAr] = useState(s.seoTitleAr ?? "");
  const [seoTitleEn, setSeoTitleEn] = useState(s.seoTitleEn ?? "");
  const [seoDescAr, setSeoDescAr] = useState(s.seoDescAr ?? "");
  const [seoDescEn, setSeoDescEn] = useState(s.seoDescEn ?? "");
  const [adminTitleAr, setAdminTitleAr] = useState(page.titleAr);
  const [adminTitleEn, setAdminTitleEn] = useState(page.titleEn);
  const [saving, setSaving] = useState(false);

  // مزامنة الحالة عند فتح الحوار (قد تكون الصفحة أعيد تحميلها)
  useEffect(() => {
    if (!open) return;
    setTitleAr(s.titleAr);
    setTitleEn(s.titleEn);
    setSlug(s.slug);
    setOrder(String(s.order));
    setVisibility(s.visibility);
    setAllowedRoles(s.allowedRoles);
    setSeoTitleAr(s.seoTitleAr ?? "");
    setSeoTitleEn(s.seoTitleEn ?? "");
    setSeoDescAr(s.seoDescAr ?? "");
    setSeoDescEn(s.seoDescEn ?? "");
    setAdminTitleAr(page.titleAr);
    setAdminTitleEn(page.titleEn);
  }, [open, s, page.titleAr, page.titleEn]);

  const slugValid = isValidSlug(slug);
  const slugChanged = slug !== s.slug;
  const orderNumber = Math.trunc(Number(order));
  const publishedSettings = page.publishedSettings;
  const willApplyAtPublish =
    publishedSettings && (slug !== publishedSettings.slug || visibility !== publishedSettings.visibility);

  const toggleRole = (key: string, checked: boolean) => {
    setAllowedRoles((prev) => (checked ? [...prev, key] : prev.filter((r) => r !== key)));
  };

  const save = async () => {
    if (!slugValid) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        baseRevision,
        titleAr: adminTitleAr,
        titleEn: adminTitleEn,
        draftSettings: {
          slug,
          visibility,
          allowedRoles,
          titleAr,
          titleEn,
          seoTitleAr: seoTitleAr || null,
          seoTitleEn: seoTitleEn || null,
          seoDescAr: seoDescAr || null,
          seoDescEn: seoDescEn || null,
          order: Number.isFinite(orderNumber) ? Math.max(0, Math.min(999, orderNumber)) : s.order,
        },
      };

      const res = await apiSend<PatchPageResponse>(`/api/admin/pages/${page.id}`, "PATCH", body);
      onSaved({ slug: res.page.slug, draftSettings: res.page.draftSettings, draftRevision: res.page.draftRevision });
      onOpenChange(false);
      toast.success(t.admin.users.saved);
    } catch (err) {
      if (err instanceof ApiError && (err.code === "conflict" || err.code === "revision_required")) {
        onConflict(); // يفتح حوار التعارض في المحرر — إعادة التحميل تجلب الأحدث
      } else if (err instanceof ApiError && err.code === "slug_taken") {
        toast.error(tp.slugTaken);
      } else if (err instanceof ApiError && err.code === "invalid_slug") {
        toast.error(tp.slugInvalid);
      } else {
        toast.error(apiErrorMessage(err, t.auth.errors));
      }
    } finally {
      setSaving(false);
    }
  };

  const staffRoles = SYSTEM_ROLES.filter((r) => r.key !== "client");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto rounded-2xl sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-navy">{te.pageSettings}</DialogTitle>
          <DialogDescription>
            {tp.slug} — {tp.slugHint}
          </DialogDescription>
        </DialogHeader>

        {willApplyAtPublish && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {te.settingsDraftOnly}
          </div>
        )}

        <div className="space-y-5">
          {/* العنوانان الظاهران (عامان — يصلان الزوار عند النشر) */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ps-title-ar">{te.publicTitleAr}</Label>
              <Input id="ps-title-ar" value={titleAr} onChange={(e) => setTitleAr(e.target.value)} dir="rtl" className="min-h-9 focus-visible:ring-2 focus-visible:ring-ring/40" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ps-title-en">{te.publicTitleEn}</Label>
              <Input id="ps-title-en" value={titleEn} onChange={(e) => setTitleEn(e.target.value)} dir="ltr" className="min-h-9 focus-visible:ring-2 focus-visible:ring-ring/40" />
            </div>
          </div>

          {/* العنوان الإداري الداخلي */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ps-admin-title-ar">{te.adminTitleAr}</Label>
              <Input id="ps-admin-title-ar" value={adminTitleAr} onChange={(e) => setAdminTitleAr(e.target.value)} dir="rtl" className="min-h-9 focus-visible:ring-2 focus-visible:ring-ring/40" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ps-admin-title-en">{te.adminTitleEn}</Label>
              <Input id="ps-admin-title-en" value={adminTitleEn} onChange={(e) => setAdminTitleEn(e.target.value)} dir="ltr" className="min-h-9 focus-visible:ring-2 focus-visible:ring-ring/40" />
            </div>
          </div>

          {/* المسار والترتيب */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ps-slug">{tp.slug}</Label>
              <Input
                id="ps-slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase())}
                dir="ltr"
                className={cn("min-h-9 font-mono text-xs focus-visible:ring-2 focus-visible:ring-ring/40", !slugValid && "border-destructive focus-visible:ring-destructive")}
                placeholder="about"
              />
              <p className={cn("text-[11px] leading-5", slugValid ? "text-muted-foreground" : "text-destructive")}>
                {page.isHome ? tp.homeSlugHint : slugChanged ? te.slugDraftHint : tp.slugHint}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ps-order">{tp.order}</Label>
              <Input
                id="ps-order"
                type="number"
                inputMode="numeric"
                value={order}
                onChange={(e) => setOrder(e.target.value)}
                className="min-h-9 focus-visible:ring-2 focus-visible:ring-ring/40"
              />
            </div>
          </div>

          {/* الظهور والأدوار */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="ps-visibility">{tp.visibility}</Label>
              <Select value={visibility} onValueChange={setVisibility}>
                <SelectTrigger id="ps-visibility" className="min-h-9 w-full focus-visible:ring-2 focus-visible:ring-ring/40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">{tp.visibilityPublic}</SelectItem>
                  <SelectItem value="authenticated">{tp.visibilityAuth}</SelectItem>
                  <SelectItem value="role">{tp.visibilityRole}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {visibility === "role" && (
              <fieldset className="rounded-xl border border-border p-3">
                <legend className="px-1 text-xs font-semibold text-navy">{te.allowedRoles}</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {staffRoles.map((role) => (
                    <label key={role.key} className="flex min-h-9 cursor-pointer items-center gap-2.5 rounded-lg px-2 hover:bg-muted/50">
                      <Checkbox checked={allowedRoles.includes(role.key)} onCheckedChange={(v) => toggleRole(role.key, v === true)} />
                      <span className="text-sm text-foreground">{roleLabel(role.key, locale)}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
          </div>

          {/* SEO */}
          <div className="space-y-3 rounded-xl border border-border p-3">
            <p className="text-xs font-semibold text-navy">{te.seo}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ps-seo-title-ar">{te.seoTitle} — {te.ar}</Label>
                <Input id="ps-seo-title-ar" value={seoTitleAr} onChange={(e) => setSeoTitleAr(e.target.value)} dir="rtl" className="min-h-9 focus-visible:ring-2 focus-visible:ring-ring/40" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ps-seo-title-en">{te.seoTitle} — {te.en}</Label>
                <Input id="ps-seo-title-en" value={seoTitleEn} onChange={(e) => setSeoTitleEn(e.target.value)} dir="ltr" className="min-h-9 focus-visible:ring-2 focus-visible:ring-ring/40" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ps-seo-desc-ar">{te.seoDescription} — {te.ar}</Label>
                <Textarea id="ps-seo-desc-ar" value={seoDescAr} onChange={(e) => setSeoDescAr(e.target.value)} rows={2} dir="rtl" className="focus-visible:ring-2 focus-visible:ring-ring/40" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ps-seo-desc-en">{te.seoDescription} — {te.en}</Label>
                <Textarea id="ps-seo-desc-en" value={seoDescEn} onChange={(e) => setSeoDescEn(e.target.value)} rows={2} dir="ltr" className="focus-visible:ring-2 focus-visible:ring-ring/40" />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t.admin.users.cancel}
          </Button>
          <Button type="button" onClick={() => void save()} disabled={saving || !slugValid}>
            {saving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}
            {t.admin.users.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
