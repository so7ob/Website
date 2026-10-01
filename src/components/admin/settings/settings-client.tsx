"use client";

/**
 * إعدادات الموقع: بيانات التواصل + الروابط الاجتماعية + اسم الموقع
 * باللغتين. حفظ واحد يرسل المفاتيح المعدلة فقط.
 */
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Save, Loader2, RotateCcw, Mail, Phone, MapPin, Github, Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { getPortalContent } from "@/content/portal";
import type { Locale } from "@/lib/i18n";
import { apiGet, apiSend, ApiError, apiErrorMessage } from "@/components/admin/helpers";
import type { Me, SettingsResponse } from "../types";

const FIELDS = ["contact.email", "contact.phone", "contact.address", "social.github", "site.nameAr", "site.nameEn"] as const;
type FieldKey = (typeof FIELDS)[number];
type FormState = Record<FieldKey, string>;

const EMPTY_FORM: FormState = {
  "contact.email": "",
  "contact.phone": "",
  "contact.address": "",
  "social.github": "",
  "site.nameAr": "",
  "site.nameEn": "",
};

interface SettingsClientProps {
  me: Me;
  locale: Locale;
}

export function SettingsClient({ me, locale }: SettingsClientProps) {
  const t = getPortalContent(locale);
  const ts = t.admin.settings;

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [initial, setInitial] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<SettingsResponse>("/api/admin/settings");
      const next = { ...EMPTY_FORM };
      for (const key of FIELDS) next[key] = res.settings[key] ?? "";
      setForm(next);
      setInitial(next);
    } catch (err) {
      if (err instanceof ApiError) setError(apiErrorMessage(err, t.auth.errors));
    } finally {
      setLoading(false);
    }
  }, [t.auth.errors]);

  useEffect(() => {
    void load();
  }, [load]);

  const setField = (key: FieldKey, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const dirty = FIELDS.some((key) => form[key] !== initial[key]);

  const save = async () => {
    const updates: Record<string, string> = {};
    for (const key of FIELDS) {
      if (form[key] !== initial[key]) updates[key] = form[key].trim();
    }
    if (Object.keys(updates).length === 0) return;

    // تحقق محلي من الصيغ الأساسية — الخادم يتحقق نهائيًا
    if (updates["contact.email"] && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(updates["contact.email"])) {
      toast.error(t.auth.errors.emailInvalid);
      return;
    }
    if (updates["social.github"] && !/^https?:\/\//.test(updates["social.github"])) {
      toast.error(t.auth.errors.generic);
      return;
    }

    setSaving(true);
    try {
      await apiSend("/api/admin/settings", "PATCH", updates);
      toast.success(ts.saved);
      await load();
    } catch (err) {
      toast.error(apiErrorMessage(err, t.auth.errors));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-48 rounded-xl" />
        <Skeleton className="h-44 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy">{ts.title}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{ts.subtitle}</p>
        </div>
        <Button onClick={save} disabled={saving || !dirty} className="min-h-11 rounded-full">
          {saving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}
          {ts.save}
        </Button>
      </div>

      {error ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="icon" onClick={load} className="size-10 shrink-0" aria-label={ts.title}>
            <RotateCcw className="size-4" aria-hidden="true" />
          </Button>
        </div>
      ) : null}

      {/* بيانات التواصل */}
      <section className="rounded-2xl border border-border bg-white p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-navy">
          <Mail className="size-4 text-brand" aria-hidden="true" />
          {ts.contact}
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="contact-email" className="flex items-center gap-1.5 text-muted-foreground">
              <Mail className="size-3.5" aria-hidden="true" />
              {ts.email}
            </Label>
            <Input
              id="contact-email"
              type="email"
              dir="ltr"
              value={form["contact.email"]}
              onChange={(e) => setField("contact.email", e.target.value)}
              maxLength={300}
              className="min-h-11 ltr-isolate"
              placeholder="hello@so7ob.example"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact-phone" className="flex items-center gap-1.5 text-muted-foreground">
              <Phone className="size-3.5" aria-hidden="true" />
              {ts.phone}
            </Label>
            <Input
              id="contact-phone"
              dir="ltr"
              value={form["contact.phone"]}
              onChange={(e) => setField("contact.phone", e.target.value)}
              maxLength={300}
              className="min-h-11 ltr-isolate"
              placeholder="+9665XXXXXXXX"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="contact-address" className="flex items-center gap-1.5 text-muted-foreground">
              <MapPin className="size-3.5" aria-hidden="true" />
              {ts.address}
            </Label>
            <Input
              id="contact-address"
              value={form["contact.address"]}
              onChange={(e) => setField("contact.address", e.target.value)}
              maxLength={300}
              className="min-h-11"
            />
          </div>
        </div>
      </section>

      {/* الروابط الاجتماعية */}
      <section className="rounded-2xl border border-border bg-white p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-navy">
          <Github className="size-4 text-brand" aria-hidden="true" />
          {ts.social}
        </h2>
        <div className="mt-4 max-w-md space-y-2">
          <Label htmlFor="social-github" className="text-muted-foreground">{ts.github}</Label>
          <Input
            id="social-github"
            dir="ltr"
            value={form["social.github"]}
            onChange={(e) => setField("social.github", e.target.value)}
            maxLength={300}
            className="min-h-11 ltr-isolate"
            placeholder="https://github.com/so7ob"
          />
        </div>
      </section>

      {/* اسم الموقع باللغتين */}
      <section className="rounded-2xl border border-border bg-white p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-navy">
          <Languages className="size-4 text-brand" aria-hidden="true" />
          {t.account.profile.language}
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="site-name-ar" className="text-muted-foreground">{t.admin.editor.ar}</Label>
            <Input
              id="site-name-ar"
              value={form["site.nameAr"]}
              onChange={(e) => setField("site.nameAr", e.target.value)}
              maxLength={300}
              dir="rtl"
              className="min-h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="site-name-en" className="text-muted-foreground">{t.admin.editor.en}</Label>
            <Input
              id="site-name-en"
              value={form["site.nameEn"]}
              onChange={(e) => setField("site.nameEn", e.target.value)}
              maxLength={300}
              dir="ltr"
              className="min-h-11 ltr-isolate"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
