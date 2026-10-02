"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/lib/i18n";
import type { PortalContent } from "@/content/portal/types";
import { apiFetch } from "@/components/account/api";
import { DevLink } from "@/components/account/dev-link";
import { AuthCard } from "./auth-card";
import { TextField } from "./text-field";

type RegisterResponse = { ok?: boolean; emailStatus?: string; devVerifyUrl?: string; errors?: Record<string, string>; code?: string };

/** إنشاء حساب عميل — النجاح يعرض بطاقة التأكيد مع رابط التطوير في وضع dev */
export function RegisterForm({ locale, t, nameLabel }: { locale: Locale; t: PortalContent["auth"]; nameLabel: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; email?: string; password?: string; confirm?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ devVerifyUrl?: string } | null>(null);

  function mapFieldError(code: string | undefined, fallback: string): string {
    switch (code) {
      case "name_invalid":
        return t.errors.nameInvalid;
      case "email_invalid":
        return t.errors.emailInvalid;
      case "email_taken":
        return t.errors.emailTaken;
      case "password_short":
      case "password_weak":
      case "password_long":
        return t.errors.passwordWeak;
      default:
        return fallback;
    }
  }

  async function onSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (submitting) return;
    setFormError(null);
    setFieldErrors({});

    const errors: typeof fieldErrors = {};
    if (!name.trim()) errors.name = t.errors.required;
    if (!email.trim()) errors.email = t.errors.required;
    if (!password) errors.password = t.errors.required;
    if (!confirm) errors.confirm = t.errors.required;
    if (password && confirm && password !== confirm) errors.confirm = t.errors.passwordMismatch;
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      return;
    }

    setSubmitting(true);
    const result = await apiFetch<RegisterResponse>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ name: name.trim(), email: email.trim().toLowerCase(), password, locale }),
    });
    setSubmitting(false);

    if (result.status === 201 && result.data.ok) {
      setSuccess({ devVerifyUrl: result.data.devVerifyUrl });
      return;
    }

    const serverErrors = result.data.errors ?? {};
    const mapped: typeof fieldErrors = {};
    if (serverErrors.name) mapped.name = mapFieldError(serverErrors.name, t.errors.nameInvalid);
    if (serverErrors.email) mapped.email = mapFieldError(serverErrors.email, t.errors.emailInvalid);
    if (serverErrors.password) mapped.password = mapFieldError(serverErrors.password, t.errors.passwordWeak);
    setFieldErrors(mapped);

    if (result.status === 429) {
      setFormError(t.errors.rateLimited);
    } else if (Object.keys(mapped).length === 0) {
      setFormError(t.errors.generic);
    }
  }

  if (success) {
    return (
      <AuthCard title={t.registerSuccessTitle}>
        <div className="mt-2 flex flex-col items-center text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-800">
            <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
          </span>
          <p className="mt-4 max-w-md leading-8 text-muted-foreground">{t.registerSuccessBody}</p>
          {success.devVerifyUrl && <DevLink url={success.devVerifyUrl} hint={t.devOutboxHint} />}
          <Button asChild className="mt-6 h-12 w-full rounded-full bg-primary text-base font-bold text-primary-foreground shadow-md shadow-brand/20 transition-all hover:bg-brand-strong sm:w-auto sm:px-10">
            <Link href={`/${locale}/auth/login`}>{t.loginButton}</Link>
          </Button>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      icon={
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-brand-strong">
          <UserPlus className="size-5" aria-hidden="true" />
        </span>
      }
      title={t.registerTitle}
      subtitle={t.registerSubtitle}
      footer={
        <p className="text-muted-foreground">
          {t.haveAccount}{" "}
          <Link
            href={`/${locale}/auth/login`}
            className="font-semibold text-brand underline decoration-brand/40 underline-offset-4 hover:text-brand-strong"
          >
            {t.loginTitle}
          </Link>
        </p>
      }
    >
      <form onSubmit={onSubmit} noValidate className="mt-6 space-y-5">
        {formError && (
          <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
            {formError}
          </div>
        )}
        <TextField id="register-name" label={nameLabel} value={name} onChange={setName} autoComplete="name" error={fieldErrors.name} maxLength={100} />
        <TextField id="register-email" label={t.email} type="email" value={email} onChange={setEmail} autoComplete="email" dir="ltr" error={fieldErrors.email} />
        <TextField id="register-password" label={t.password} type="password" value={password} onChange={setPassword} autoComplete="new-password" hint={t.passwordHint} error={fieldErrors.password} />
        <TextField id="register-confirm" label={t.confirmPassword} type="password" value={confirm} onChange={setConfirm} autoComplete="new-password" error={fieldErrors.confirm} />
        <Button
          type="submit"
          disabled={submitting}
          className="h-12 w-full rounded-full bg-primary text-base font-bold text-primary-foreground shadow-md shadow-brand/20 transition-all hover:bg-brand-strong"
        >
          {submitting ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <UserPlus className="h-5 w-5" aria-hidden="true" />}
          {t.registerButton}
        </Button>
      </form>
    </AuthCard>
  );
}
