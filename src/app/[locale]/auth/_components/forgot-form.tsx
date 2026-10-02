"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, MailCheck, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/lib/i18n";
import type { PortalContent } from "@/content/portal/types";
import { apiFetch } from "@/components/account/api";
import { DevLink } from "@/components/account/dev-link";
import { AuthCard } from "./auth-card";
import { TextField } from "./text-field";

type ForgotResponse = { ok?: boolean; devResetUrl?: string; code?: string };

/** استعادة كلمة المرور — الرد دائمًا عام؛ رابط التطوير يظهر في وضع dev فقط */
export function ForgotForm({ locale, t }: { locale: Locale; t: PortalContent["auth"] }) {
  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState<{ devResetUrl?: string } | null>(null);

  async function onSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (submitting) return;
    setError(null);
    setFieldError(null);

    if (!email.trim()) {
      setFieldError(t.errors.required);
      return;
    }

    setSubmitting(true);
    const result = await apiFetch<ForgotResponse>("/api/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    });
    setSubmitting(false);

    if (result.status === 429) {
      setError(t.errors.rateLimited);
      return;
    }
    if (result.status === 0) {
      setError(t.errors.generic);
      return;
    }
    // رد عام دائمًا — لا نكشف وجود الحساب
    setSent({ devResetUrl: result.data.devResetUrl });
  }

  if (sent) {
    return (
      <AuthCard title={t.forgotTitle}>
        <div className="mt-2 flex flex-col items-center text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-700">
            <MailCheck className="h-7 w-7" aria-hidden="true" />
          </span>
          <p className="mt-4 max-w-md leading-8 text-muted-foreground">{t.forgotSent}</p>
          {sent.devResetUrl && <DevLink url={sent.devResetUrl} hint={t.forgotSentDev} />}
          <Button asChild variant="outline" className="mt-6 h-12 w-full rounded-full sm:w-auto sm:px-10">
            <Link href={`/${locale}/auth/login`}>{t.backHome}</Link>
          </Button>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title={t.forgotTitle}
      subtitle={t.forgotHint}
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
        {error && (
          <div role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
            {error}
          </div>
        )}
        <TextField
          id="forgot-email"
          label={t.email}
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          dir="ltr"
          error={fieldError ?? undefined}
        />
        <Button
          type="submit"
          disabled={submitting}
          className="h-12 w-full rounded-full bg-primary text-base font-bold text-primary-foreground shadow-md shadow-brand/20 transition-all hover:bg-brand-strong"
        >
          {submitting ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <Send className="h-5 w-5" aria-hidden="true" />}
          {t.forgotButton}
        </Button>
      </form>
    </AuthCard>
  );
}
