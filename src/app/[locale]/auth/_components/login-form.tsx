"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Loader2, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/lib/i18n";
import type { PortalContent } from "@/content/portal/types";
import { AuthCard } from "./auth-card";
import { TextField } from "./text-field";

/** صفحة تسجيل الدخول — بيانات الاعتماد عبر next-auth ثم توجيه حسب الدور */
export function LoginForm({ locale, t, next }: { locale: Locale; t: PortalContent["auth"]; next?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // هدف آمن داخلي فقط — نمنع الروابط الخارجية
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;

  async function onSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (submitting) return;
    setError(null);

    if (!email.trim() || !password) {
      setError(t.errors.required);
      return;
    }

    setSubmitting(true);
    try {
      const result = await signIn("credentials", {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
      });

      if (!result || !result.ok || result.error) {
        // بيانات غير صحيحة أو حساب مقفل/موقوف — رسالة عامة لا تكشف السبب
        setError(result?.error === "rateLimited" ? t.errors.rateLimited : t.errors.generic);
        setSubmitting(false);
        return;
      }

      // جلب الدور لاختيار الوجهة: الطاقم → لوحة الإدارة، العميل → البوابة
      let target = `/${locale}/account`;
      try {
        const res = await fetch("/api/auth/session");
        const session = (await res.json()) as { user?: { roleKey?: string } | null };
        const role = session?.user?.roleKey;
        if (role && role !== "client") target = `/${locale}/admin`;
      } catch {
        /* الاحتياط: بوابة العميل — الخادم يعيد التوجيه عند الحاجة */
      }

      router.push(safeNext ?? target);
      router.refresh();
    } catch {
      setError(t.errors.generic);
      setSubmitting(false);
    }
  }

  return (
    <AuthCard
      title={t.loginTitle}
      subtitle={t.loginSubtitle}
      footer={
        <div className="flex flex-col gap-3">
          <p className="text-muted-foreground">
            {t.noAccount}{" "}
            <Link
              href={`/${locale}/auth/register`}
              className="font-semibold text-brand underline decoration-brand/40 underline-offset-4 hover:text-brand-strong"
            >
              {t.registerTitle}
            </Link>
          </p>
          <Link
            href={`/${locale}/auth/forgot-password`}
            className="text-muted-foreground underline decoration-border underline-offset-4 hover:text-foreground"
          >
            {t.forgotTitle}
          </Link>
          <Link href={`/${locale}`} className="text-xs text-muted-foreground hover:text-foreground">
            {t.backHome}
          </Link>
        </div>
      }
    >
      <form onSubmit={onSubmit} noValidate className="mt-6 space-y-5">
        {error && (
          <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
            {error}
          </div>
        )}
        <TextField
          id="login-email"
          label={t.email}
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          dir="ltr"
        />
        <TextField
          id="login-password"
          label={t.password}
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
        />
        <Button
          type="submit"
          disabled={submitting}
          className="h-12 w-full rounded-full bg-primary text-base font-bold text-primary-foreground shadow-md shadow-brand/20 transition-all hover:bg-brand-strong"
        >
          {submitting ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <LogIn className="h-5 w-5" aria-hidden="true" />}
          {t.loginButton}
        </Button>
      </form>
    </AuthCard>
  );
}
