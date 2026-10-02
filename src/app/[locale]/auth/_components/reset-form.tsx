"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { Locale } from "@/lib/i18n";
import type { PortalContent } from "@/content/portal/types";
import { apiFetch } from "@/components/account/api";
import { AuthCard } from "./auth-card";
import { TextField } from "./text-field";

type ResetResponse = { ok?: boolean; errors?: Record<string, string>; code?: string };

/** ضبط كلمة مرور جديدة برمز الاستعادة — بعد النجاح يعود للدخول */
export function ResetForm({ locale, t, token }: { locale: Locale; t: PortalContent["auth"]; token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ password?: string; confirm?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (submitting) return;
    setFormError(null);
    setFieldErrors({});

    const errors: typeof fieldErrors = {};
    if (!password) errors.password = t.errors.required;
    if (!confirm) errors.confirm = t.errors.required;
    if (password && confirm && password !== confirm) errors.confirm = t.errors.passwordMismatch;
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      return;
    }

    setSubmitting(true);
    const result = await apiFetch<ResetResponse>("/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    });
    setSubmitting(false);

    if (result.data.ok) {
      toast.success(t.resetSuccess);
      router.push(`/${locale}/auth/login`);
      return;
    }

    if (result.data.errors?.password) {
      setFieldErrors({ password: t.errors.passwordWeak });
    } else if (result.status === 429) {
      setFormError(t.errors.rateLimited);
    } else {
      // رمز منتهٍ أو مستخدم — بطاقة خطأ واضحة
      setFormError(t.verifyInvalidBody);
    }
  }

  // بلا رمز — رابط غير صالح من الأصل
  if (!token) {
    return (
      <AuthCard title={t.resetTitle}>
        <div className="mt-2 flex flex-col items-center text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-100 text-rose-800">
            <ShieldX className="h-7 w-7" aria-hidden="true" />
          </span>
          <p className="mt-4 font-semibold text-navy">{t.verifyInvalid}</p>
          <p className="mt-2 max-w-md leading-8 text-muted-foreground">{t.verifyInvalidBody}</p>
          <Button asChild variant="outline" className="mt-6 h-12 w-full rounded-full sm:w-auto sm:px-10">
            <Link href={`/${locale}/auth/login`}>{t.loginTitle}</Link>
          </Button>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      icon={
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-brand-strong">
          <KeyRound className="size-5" aria-hidden="true" />
        </span>
      }
      title={t.resetTitle}
      footer={
        <Link
          href={`/${locale}/auth/login`}
          className="font-semibold text-brand underline decoration-brand/40 underline-offset-4 hover:text-brand-strong"
        >
          {t.loginTitle}
        </Link>
      }
    >
      <form onSubmit={onSubmit} noValidate className="mt-6 space-y-5">
        {formError && (
          <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
            {formError}
          </div>
        )}
        <TextField
          id="reset-password"
          label={t.newPassword}
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          hint={t.passwordHint}
          error={fieldErrors.password}
        />
        <TextField
          id="reset-confirm"
          label={t.confirmPassword}
          type="password"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
          error={fieldErrors.confirm}
        />
        <Button
          type="submit"
          disabled={submitting}
          className="h-12 w-full rounded-full bg-primary text-base font-bold text-primary-foreground shadow-md shadow-brand/20 transition-all hover:bg-brand-strong"
        >
          {submitting ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <KeyRound className="h-5 w-5" aria-hidden="true" />}
          {t.resetButton}
        </Button>
      </form>
    </AuthCard>
  );
}
