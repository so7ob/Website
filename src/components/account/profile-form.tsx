"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Loader2, Save, ShieldQuestion, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { localeMeta, type Locale } from "@/lib/i18n";
import type { PortalContent } from "@/content/portal/types";
import { apiFetch } from "./api";

/** الملف الشخصي: البريد للقراءة فقط (مع حالة التأكيد) والباقي قابل للتحديث */
export function ProfileForm({
  locale,
  t,
  authErrors,
  emailLabel,
  initial,
}: {
  locale: Locale;
  t: PortalContent["account"]["profile"];
  authErrors: PortalContent["auth"]["errors"];
  emailLabel: string;
  initial: {
    email: string;
    name: string;
    phone: string;
    company: string;
    userLocale: string;
    emailVerified: boolean;
  };
}) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [phone, setPhone] = useState(initial.phone);
  const [company, setCompany] = useState(initial.company);
  const [userLocale, setUserLocale] = useState<string>(initial.userLocale);
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; phone?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (saving) return;
    setFieldErrors({});
    setFormError(null);

    if (!name.trim()) {
      setFieldErrors({ name: authErrors.required });
      return;
    }

    setSaving(true);
    const result = await apiFetch<{ ok?: boolean; errors?: Record<string, string> }>("/api/account/profile", {
      method: "PATCH",
      body: JSON.stringify({
        name: name.trim(),
        phone: phone.trim(),
        company: company.trim(),
        locale: userLocale === "en" ? "en" : "ar",
      }),
    });
    setSaving(false);

    if (result.data.ok) {
      toast.success(t.saved);
      // تغيير لغة الواجهة المفضلة ينقل المستخدم لنسخة الصفحة نفسها باللغة الجديدة
      const newLocale: Locale = userLocale === "en" ? "en" : "ar";
      if (newLocale !== locale) {
        router.push(`/${newLocale}/account/profile`);
        router.refresh();
      }
      return;
    }

    const errors = result.data.errors ?? {};
    const mapped: { name?: string; phone?: string } = {};
    if (errors.name) mapped.name = authErrors.nameInvalid;
    if (errors.phone) mapped.phone = authErrors.invalid;
    setFieldErrors(mapped);
    if (Object.keys(mapped).length === 0) setFormError(authErrors.generic);
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-brand-strong">
          <User className="size-5" aria-hidden="true" />
        </span>
        <h1 className="text-2xl font-bold text-navy">{t.title}</h1>
      </header>

      <section className="max-w-2xl rounded-2xl border border-border bg-white p-6">
        {formError && (
          <div role="alert" className="mb-5 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
            {formError}
          </div>
        )}
        <form onSubmit={onSubmit} noValidate className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="profile-email" className="text-sm font-semibold text-navy">
              {emailLabel}
            </Label>
            <div className="flex flex-wrap items-center gap-3">
              <Input
                id="profile-email"
                value={initial.email}
                readOnly
                dir="ltr"
                className="min-h-11 flex-1 cursor-default bg-muted/50 text-start text-muted-foreground ltr-isolate focus-visible:ring-2 focus-visible:ring-ring/40"
                aria-readonly="true"
              />
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                  initial.emailVerified ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"
                }`}
              >
                {initial.emailVerified ? (
                  <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <ShieldQuestion className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                {initial.emailVerified ? t.verified : t.notVerified}
              </span>
            </div>
            <p className="text-xs leading-6 text-muted-foreground">{t.emailReadonly}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="profile-name" className="text-sm font-semibold text-navy">
              {t.name}
            </Label>
            <Input
              id="profile-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              maxLength={100}
              required
              aria-invalid={Boolean(fieldErrors.name)}
              aria-describedby={fieldErrors.name ? "profile-name-error" : undefined}
              className="min-h-11 focus-visible:ring-2 focus-visible:ring-ring/40"
            />
            {fieldErrors.name && (
              <p id="profile-name-error" role="alert" className="text-xs font-medium text-red-700">
                {fieldErrors.name}
              </p>
            )}
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="profile-phone" className="text-sm font-semibold text-navy">
                {t.phone}
              </Label>
              <Input
                id="profile-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="tel"
                dir="ltr"
                maxLength={20}
                aria-invalid={Boolean(fieldErrors.phone)}
                aria-describedby={fieldErrors.phone ? "profile-phone-error" : undefined}
                className={`min-h-11 text-start ltr-isolate focus-visible:ring-2 focus-visible:ring-ring/40 ${fieldErrors.phone ? "border-red-400" : ""}`}
              />
              {fieldErrors.phone && (
                <p id="profile-phone-error" role="alert" className="text-xs font-medium text-red-700">
                  {fieldErrors.phone}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-company" className="text-sm font-semibold text-navy">
                {t.company}
              </Label>
              <Input
                id="profile-company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                autoComplete="organization"
                maxLength={120}
                className="min-h-11 focus-visible:ring-2 focus-visible:ring-ring/40"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="profile-locale" className="text-sm font-semibold text-navy">
              {t.language}
            </Label>
            <Select value={userLocale} onValueChange={setUserLocale}>
              <SelectTrigger id="profile-locale" className="min-h-11 w-full sm:w-64" aria-label={t.language}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ar">{localeMeta.ar.label}</SelectItem>
                <SelectItem value="en">{localeMeta.en.label}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            type="submit"
            disabled={saving}
            className="h-12 rounded-full bg-primary px-8 text-base font-bold text-primary-foreground shadow-md shadow-brand/20 transition-all hover:bg-brand-strong"
          >
            {saving ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <Save className="h-5 w-5" aria-hidden="true" />}
            {t.save}
          </Button>
        </form>
      </section>
    </div>
  );
}
